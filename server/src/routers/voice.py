from __future__ import annotations

import json
import logging
import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db import get_db
from dependencies import CurrentUser, get_current_user
from services.whisper_transcribe import transcribe_audio as whisper_transcribe_audio
from services.financial_records import (
    build_financial_record_insert_statement,
    execute_financial_record_insert_script,
    prepare_financial_record_insert_rows,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class VoiceTextPayload(BaseModel):
    text: str | None = None
    extracted_records: list[dict[str, Any]] = []
    organization_id: str | None = None
    property_id: str | None = None
    created_by: str | None = None
    auto_insert: bool = True


DEBUG_AUDIO_DIR = Path(r"D:\apps\rentzu\server\debug_audio")
VOICE_LOG_PATH = Path(r"D:\apps\rentzu\server\voice_requests.log")
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_RESPONSES_MODEL = os.getenv('OPENAI_RESPONSES_MODEL', 'gpt-4.1-mini')
EXTRACTION_PROMPT = """You extract financial records from landlord app user input.
Return JSON only.
Return an array of objects.
Each object must have exactly these fields:
- date: YYYY-MM-DD or null
- amount: number or null
- description: string or null
- type: \"expense\" or \"income\" or \"improvement\" or null
- counterparty: string or null
- category_code: for income use \"rent\" by default unless it is clearly another income, then use \"additional_income\"; for expense prefer one of \"other\", \"maintenance\", \"repair\", \"utility\"; for uncommon expense types like legal or management, return \"other\"; for improvement use \"improvement\"; use null when unknown
Return one object per financial record mentioned.
If the user mentions multiple records, return multiple objects.
Use null when unknown.
Do not explain.
Do not invent facts."""


def _coerce_record(item: dict[str, Any]) -> dict[str, Any]:
    type_value = item.get('type')
    if type_value not in {'expense', 'income', 'improvement'}:
        type_value = None
    amount = item.get('amount')
    try:
        amount = float(amount) if amount is not None else None
    except (TypeError, ValueError):
        amount = None
    category_code = str(item.get('category_code') or '').strip().lower().replace('-', '_').replace(' ', '_') or None
    if type_value == 'income' and not category_code:
        category_code = 'rent'
    elif type_value == 'expense' and category_code in {'legal', 'management'}:
        category_code = 'other'
    elif type_value == 'expense' and category_code == 'repairs':
        category_code = 'repair'
    elif type_value == 'improvement' and not category_code:
        category_code = 'improvement'
    if category_code not in {'rent', 'additional_income', 'other', 'maintenance', 'repair', 'utility', 'improvement'}:
        category_code = 'rent' if type_value == 'income' else 'improvement' if type_value == 'improvement' else None
    return {
        'type': type_value,
        'amount': amount,
        'counterparty': item.get('counterparty') or None,
        'description': item.get('description') or None,
        'date': item.get('date') or None,
        'category_code': category_code,
    }


def _extract_json_records(text: str) -> list[dict[str, Any]]:
    cleaned = text.strip()
    if not cleaned:
        return []
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find('[')
        end = cleaned.rfind(']')
        if start != -1 and end != -1 and end > start:
            payload = json.loads(cleaned[start : end + 1])
        else:
            start = cleaned.find('{')
            end = cleaned.rfind('}')
            if start == -1 or end == -1 or end <= start:
                raise
            payload = json.loads(cleaned[start : end + 1])
    if isinstance(payload, dict):
        payload = payload.get('records', payload)
    if isinstance(payload, dict):
        payload = [payload]
    if not isinstance(payload, list):
        return []
    return [_coerce_record(item) for item in payload if isinstance(item, dict)]


def _append_voice_log(event: dict[str, Any]) -> None:
    VOICE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with VOICE_LOG_PATH.open('a', encoding='utf-8') as fh:
        fh.write(json.dumps(event, ensure_ascii=False, default=str) + '\n')


def _extract_output_text(data: dict[str, Any]) -> str:
    output_text = data.get('output_text')
    if output_text:
        return output_text.strip()
    chunks: list[str] = []
    for item in data.get('output', []):
        for content in item.get('content', []):
            text = content.get('text')
            if text:
                chunks.append(text)
    return '\n'.join(chunks).strip()


def _transcribe_with_whisper(audio_path: Path) -> str:
    """Transcribe audio locally using faster-whisper."""
    logger.info('[WHISPER] Starting transcription: %s', audio_path)
    try:
        transcript = whisper_transcribe_audio(audio_path)
        logger.info('[WHISPER] Transcription result (%d chars): "%s"', len(transcript), transcript[:300])
        if not transcript:
            logger.warning('[WHISPER] Transcription returned EMPTY text for %s', audio_path)
        return transcript
    except Exception as exc:
        logger.error('[WHISPER] Transcription FAILED for %s: %s', audio_path, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f'Whisper transcription failed: {exc}') from exc


def _extract_records_from_text(transcript: str) -> tuple[list[dict[str, Any]], str, dict[str, Any]]:
    if not OPENAI_API_KEY:
        logger.error('[LLM] OPENAI_API_KEY is not configured — cannot extract records')
        raise HTTPException(status_code=500, detail='OPENAI_API_KEY is not configured')
    logger.info('[LLM] Sending transcript to %s for extraction (%d chars): "%s"', OPENAI_RESPONSES_MODEL, len(transcript), transcript[:200])
    response = requests.post(
        'https://api.openai.com/v1/responses',
        headers={
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'model': OPENAI_RESPONSES_MODEL,
            'input': [
                {
                    'role': 'system',
                    'content': [{ 'type': 'input_text', 'text': EXTRACTION_PROMPT }],
                },
                {
                    'role': 'user',
                    'content': [{ 'type': 'input_text', 'text': transcript }],
                },
            ],
        },
        timeout=90,
    )
    logger.info('[LLM] OpenAI response status: %d', response.status_code)
    if response.status_code >= 400:
        logger.error('[LLM] OpenAI extraction FAILED (HTTP %d): %s', response.status_code, response.text[:800])
        raise HTTPException(status_code=500, detail=f'OpenAI extraction failed ({response.status_code}): {response.text[:600]}')
    data = response.json()
    output_text = _extract_output_text(data)
    logger.info('[LLM] Raw LLM output text: "%s"', output_text[:500])
    records = _extract_json_records(output_text)
    logger.info('[LLM] Parsed %d record tuple(s): %s', len(records), json.dumps(records, default=str))
    if not records:
        logger.warning('[LLM] No records parsed from LLM output! Raw output was: "%s"', output_text)
    return records, output_text, data


@router.post('/transcribe-text')
def voice_transcribe_text(
    payload: VoiceTextPayload,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    request_id = datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    extracted_records = [_coerce_record(item) for item in payload.extracted_records]
    insert_rows = []
    insert_statement = ''
    insert_params: dict[str, Any] = {}
    inserted_records: list[dict[str, Any]] = []

    if payload.auto_insert and payload.organization_id and payload.property_id:
        insert_rows = prepare_financial_record_insert_rows(
            organization_id=payload.organization_id,
            property_id=payload.property_id,
            records=extracted_records,
            transcript=payload.text,
            created_by=payload.created_by,
        )
        insert_statement, insert_params = build_financial_record_insert_statement(insert_rows)
        inserted_records = execute_financial_record_insert_script(db, insert_statement, insert_params)

    response_payload = {
        'ok': True,
        'filename': None,
        'transcript': payload.text or '',
        'raw_output': payload.text or '',
        'voice_router_marker': 'debug-audio-v4-text',
        'extracted_records': extracted_records,
        'extraction_raw_output': payload.text,
        'insert_script_row_count': len(insert_rows),
        'insert_script_sql': insert_statement,
        'inserted_records': inserted_records,
        'openai_responses_model': OPENAI_RESPONSES_MODEL,
        'openai_api_key_configured': bool(OPENAI_API_KEY),
    }
    _append_voice_log({
        'request_id': request_id,
        'route': '/voice/transcribe-text',
        'timestamp': datetime.now().isoformat(),
        'request': payload.model_dump(),
        'response': response_payload,
    })
    return response_payload


@router.post('/transcribe')
async def voice_transcribe(
    audio: UploadFile = File(...),
    organization_id: str | None = Form(default=None),
    property_id: str | None = Form(default=None),
    created_by: str | None = Form(default=None),
    auto_insert: bool = Form(default=False),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    suffix = Path(audio.filename or 'recording.wav').suffix or '.wav'
    debug_copy_path: Path | None = None

    request_id = datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    logger.info('[VOICE] ── Request %s ── file=%s, size_hint=%s, org=%s, prop=%s, auto_insert=%s',
                request_id, audio.filename, audio.size, organization_id, property_id, auto_insert)

    try:
        DEBUG_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=DEBUG_AUDIO_DIR) as temp_file:
            temp_path = Path(temp_file.name)
            while True:
                chunk = await audio.read(1024 * 1024)
                if not chunk:
                    break
                temp_file.write(chunk)

        debug_name = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}_{audio.filename or temp_path.name}"
        debug_copy_path = DEBUG_AUDIO_DIR / debug_name
        shutil.copy2(temp_path, debug_copy_path)
        size_bytes = temp_path.stat().st_size if temp_path.exists() else 0
        logger.info('[VOICE] Audio saved: %s (%d bytes), debug copy: %s', temp_path, size_bytes, debug_copy_path)

        transcript = _transcribe_with_whisper(temp_path)
        extracted_records, extraction_raw_output, openai_response = _extract_records_from_text(transcript)
        raw_output = extraction_raw_output
        insert_rows = []
        insert_statement = ''
        insert_params: dict[str, Any] = {}
        inserted_records: list[dict[str, Any]] = []

        if auto_insert and organization_id and property_id:
            insert_rows = prepare_financial_record_insert_rows(
                organization_id=organization_id,
                property_id=property_id,
                records=extracted_records,
                transcript=transcript,
                created_by=created_by,
            )
            insert_statement, insert_params = build_financial_record_insert_statement(insert_rows)
            inserted_records = execute_financial_record_insert_script(db, insert_statement, insert_params)
            logger.info('[DB] Inserted %d record(s) into financial_records: %s',
                        len(inserted_records), json.dumps(inserted_records, default=str)[:500])
        else:
            logger.info('[DB] Skipping auto-insert (auto_insert=%s, org=%s, prop=%s)',
                        auto_insert, organization_id, property_id)

        response_payload = {
            'ok': True,
            'filename': audio.filename,
            'transcript': transcript,
            'raw_output': raw_output,
            'debug_saved_path': str(debug_copy_path) if debug_copy_path else None,
            'debug_size_bytes': size_bytes,
            'voice_router_marker': 'debug-audio-v6-local-whisper',
            'extracted_records': extracted_records,
            'extraction_raw_output': extraction_raw_output,
            'insert_script_row_count': len(insert_rows),
            'insert_script_sql': insert_statement,
            'inserted_records': inserted_records,
            'whisper_transcription': True,
            'openai_responses_model': OPENAI_RESPONSES_MODEL,
            'openai_response_preview': json.dumps(openai_response)[:2000],
            'openai_api_key_configured': bool(OPENAI_API_KEY),
        }
        _append_voice_log({
            'request_id': request_id,
            'route': '/voice/transcribe',
            'timestamp': datetime.now().isoformat(),
            'request': {
                'filename': audio.filename,
                'organization_id': organization_id,
                'property_id': property_id,
                'created_by': created_by,
                'auto_insert': auto_insert,
                'debug_saved_path': str(debug_copy_path) if debug_copy_path else None,
                'size_bytes': size_bytes,
            },
            'response': response_payload,
        })
        logger.info('[VOICE] ── Request %s complete ── transcript=%d chars, extracted=%d, inserted=%d',
                    request_id, len(transcript), len(extracted_records), len(inserted_records))
        return response_payload
    finally:
        try:
            if 'temp_path' in locals() and temp_path.exists():
                temp_path.unlink()
        except OSError:
            pass
