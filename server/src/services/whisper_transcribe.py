"""Local Whisper transcription using faster-whisper.

The WhisperModel is loaded once (singleton) on first use so that
subsequent transcription calls reuse the same model instance.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from threading import Lock

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

# ── Configuration via env vars (with sensible defaults) ──────────────
# Modified by AI on 07/03/2026. Edit #1.
WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL_NAME", "tiny")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
# Optional forced language (e.g. "zh" for Chinese, "en" for English). Empty =
# let Whisper auto-detect. Forcing the language greatly improves accuracy and
# speed on short clips where auto-detection is unreliable.
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "").strip() or None
# Optional initial prompt to bias transcription. For Chinese this both improves
# accuracy and steers Whisper toward Simplified characters, e.g.
# WHISPER_INITIAL_PROMPT="以下是普通话的句子。"
WHISPER_INITIAL_PROMPT = os.getenv("WHISPER_INITIAL_PROMPT", "").strip() or None

# ── Singleton model management ───────────────────────────────────────
_model: WhisperModel | None = None
_model_lock = Lock()


def _get_model() -> WhisperModel:
    """Return the shared WhisperModel instance, creating it on first call."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                logger.info(
                    "Loading faster-whisper model: %s (device=%s, compute_type=%s)",
                    WHISPER_MODEL_NAME,
                    WHISPER_DEVICE,
                    WHISPER_COMPUTE_TYPE,
                )
                _model = WhisperModel(
                    WHISPER_MODEL_NAME,
                    device=WHISPER_DEVICE,
                    compute_type=WHISPER_COMPUTE_TYPE,
                )
    return _model


def transcribe_audio(audio_path: Path, language: str | None = None) -> str:
    """Transcribe an audio file and return the full text.

    Uses VAD filtering and beam_size=1 for speed (matching
    the standalone ``transcribe_file.py`` configuration).

    ``language`` (e.g. "zh" or "en") overrides ``WHISPER_LANGUAGE`` for this
    call; when omitted the env default (or auto-detect) is used.
    """
    import time

    file_size = audio_path.stat().st_size if audio_path.exists() else 0
    logger.info("[WHISPER] transcribe_audio called: %s (%d bytes)", audio_path, file_size)

    model = _get_model()

    # Modified by AI on 07/03/2026. Edit #2.
    # Prefer the per-call language, then the env default. Only pass language /
    # initial_prompt when set so the default behavior (auto-detect) is unchanged.
    effective_language = (language or WHISPER_LANGUAGE) or None
    transcribe_kwargs: dict[str, object] = {
        "vad_filter": True,
        "beam_size": 1,
    }
    if effective_language:
        transcribe_kwargs["language"] = effective_language
    if WHISPER_INITIAL_PROMPT:
        transcribe_kwargs["initial_prompt"] = WHISPER_INITIAL_PROMPT

    start = time.monotonic()
    segments, info = model.transcribe(str(audio_path), **transcribe_kwargs)

    texts: list[str] = []
    for seg in segments:
        text = (seg.text or "").strip()
        if text:
            texts.append(text)

    elapsed = time.monotonic() - start
    transcript = " ".join(texts).strip()
    logger.info(
        "[WHISPER] Done in %.2fs — lang=%s, segments=%d, length=%d chars",
        elapsed,
        info.language,
        len(texts),
        len(transcript),
    )
    if not transcript:
        logger.warning("[WHISPER] Transcript is EMPTY (file=%s, %d bytes, %.2fs elapsed)", audio_path, file_size, elapsed)
    return transcript

