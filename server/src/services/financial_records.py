import base64
import uuid
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from models.financial_record import FinancialRecord
from schemas.financial_record import FinancialRecordCreate, FinancialRecordPatch
from services.validators import (
    ensure_property_belongs_to_organization,
    ensure_unit_belongs_to_property,
    require_organization,
    require_property,
    require_unit,
)


def _encode_cursor(record: FinancialRecord) -> str:
    raw = f"{record.record_date.isoformat()}|{record.created_at.isoformat()}|{record.id}"
    return base64.urlsafe_b64encode(raw.encode('utf-8')).decode('utf-8')


def _decode_cursor(cursor: str) -> tuple[date, datetime, UUID] | None:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode('utf-8')).decode('utf-8')
        record_date_str, created_at_str, record_id = decoded.split('|', 2)
        return date.fromisoformat(record_date_str), datetime.fromisoformat(created_at_str), UUID(record_id)
    except Exception:
        return None


def list_financial_records(db: Session, organization_id: UUID | None = None, property_id: UUID | None = None, unit_id: UUID | None = None, limit: int = 5, cursor: str | None = None):
    query = db.query(FinancialRecord)
    if organization_id:
        query = query.filter(FinancialRecord.organization_id == organization_id)
    if property_id:
        query = query.filter(FinancialRecord.property_id == property_id)
    if unit_id:
        query = query.filter(FinancialRecord.unit_id == unit_id)

    total = query.count()

    if cursor:
        decoded = _decode_cursor(cursor)
        if decoded:
            record_date_value, created_at_value, record_id = decoded
            query = query.filter(
                or_(
                    FinancialRecord.record_date < record_date_value,
                    (FinancialRecord.record_date == record_date_value) & (FinancialRecord.created_at < created_at_value),
                    (FinancialRecord.record_date == record_date_value) & (FinancialRecord.created_at == created_at_value) & (FinancialRecord.id < record_id),
                )
            )

    query = query.order_by(FinancialRecord.record_date.desc(), FinancialRecord.created_at.desc(), FinancialRecord.id.desc())
    items = query.limit(limit + 1).all()
    has_more = len(items) > limit
    visible_items = items[:limit]
    next_cursor = _encode_cursor(visible_items[-1]) if has_more and visible_items else None
    return {'items': visible_items, 'total': total, 'limit': limit, 'next_cursor': next_cursor}


def get_financial_record(db: Session, record_id: UUID):
    return db.query(FinancialRecord).filter(FinancialRecord.id == record_id).first()


def create_financial_record(db: Session, payload: FinancialRecordCreate):
    require_organization(db, payload.organization_id)
    property_obj = require_property(db, payload.property_id)
    ensure_property_belongs_to_organization(property_obj, payload.organization_id)

    if payload.unit_id:
        unit = require_unit(db, payload.unit_id)
        ensure_unit_belongs_to_property(unit, payload.property_id)

    obj = FinancialRecord(id=uuid.uuid4(), **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def patch_financial_record(db: Session, obj: FinancialRecord, payload: FinancialRecordPatch):
    updates = payload.model_dump(exclude_unset=True)
    property_id = updates.get('property_id', obj.property_id)
    unit_id = updates.get('unit_id', obj.unit_id)

    property_obj = require_property(db, property_id)
    ensure_property_belongs_to_organization(property_obj, obj.organization_id)

    if unit_id:
        unit = require_unit(db, unit_id)
        ensure_unit_belongs_to_property(unit, property_id)

    for key, value in updates.items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


def prepare_financial_record_insert_rows(
    organization_id: UUID,
    property_id: UUID,
    records: list[dict],
    transcript: str | None = None,
    created_by: UUID | None = None,
):
    rows = []
    for item in records:
        amount = item.get('amount')
        if amount is None:
            continue
        rows.append({
            'id': uuid.uuid4(),
            'organization_id': organization_id,
            'extracted_record_id': None,
            'type': item.get('type') or 'expense',
            'amount': Decimal(str(amount)),
            'currency': 'USD',
            'record_date': item.get('date') or date.today(),
            'counterparty': item.get('counterparty'),
            'description': item.get('description') or transcript or 'Voice record',
            'property_id': property_id,
            'unit_id': None,
            'lease_id': None,
            'category_code': item.get('category_code'),
            'sub_type': None,
            'notes': f'Voice transcript: {transcript}' if transcript else None,
            'source': 'voice',
            'created_by': created_by,
        })
    return rows


def build_financial_record_insert_statement(rows: list[dict]):
    if not rows:
        return '', []

    columns = [
        'id',
        'organization_id',
        'extracted_record_id',
        'type',
        'amount',
        'currency',
        'record_date',
        'counterparty',
        'description',
        'property_id',
        'unit_id',
        'lease_id',
        'category_code',
        'sub_type',
        'notes',
        'source',
        'created_by',
    ]
    values_sql = []
    params = {}
    for index, row in enumerate(rows):
        placeholders = []
        for column in columns:
            key = f'{column}_{index}'
            placeholders.append(f':{key}')
            params[key] = row[column]
        values_sql.append(f"({', '.join(placeholders)})")
    statement = f"""
        INSERT INTO financial_records ({', '.join(columns)})
        VALUES {', '.join(values_sql)}
        RETURNING id, type, amount, description, record_date, counterparty
    """
    return statement, params


def execute_financial_record_insert_script(db: Session, statement: str, params: dict):
    if not statement:
        return []
    result = db.execute(text(statement), params)
    db.commit()
    return [dict(row._mapping) for row in result]
