from collections import defaultdict
from datetime import date
from decimal import Decimal
import uuid
from uuid import UUID
from sqlalchemy.orm import Session

from models.financial_record import FinancialRecord
from models.property import Property
from models.unit import Unit
from schemas.property import (
    PropertyCategoryTotal,
    PropertyCreate,
    PropertyMonthlyTotal,
    PropertyPatch,
    PropertyPortfolioSummaryItem,
    PropertyPortfolioSummaryRead,
    PropertyRead,
    PropertyTaxReportRead,
)
from schemas.unit import UnitRead
from services.validators import require_organization


DEDUCTIBLE_EXPENSE_TYPES = {'expense', 'repair', 'maintenance', 'insurance', 'tax', 'utility', 'hoa', 'legal', 'professional'}


def _list_units_for_property(db: Session, property_id: UUID):
    return (
        db.query(Unit)
        .filter(Unit.property_id == property_id)
        .order_by(Unit.created_at.asc(), Unit.unit_code.asc())
        .all()
    )



def _serialize_property(db: Session, property_obj: Property):
    units = [UnitRead.model_validate(unit) for unit in _list_units_for_property(db, property_obj.id)]
    payload = PropertyRead.model_validate(property_obj).model_dump()
    payload['units'] = [unit.model_dump() for unit in units]
    return payload



def list_properties(db: Session, organization_id: UUID | None = None):
    query = db.query(Property)
    if organization_id:
        query = query.filter(Property.organization_id == organization_id)
    properties = query.order_by(Property.created_at.desc()).all()
    return [_serialize_property(db, property_obj) for property_obj in properties]



def get_property_row(db: Session, property_id: UUID):
    return db.query(Property).filter(Property.id == property_id).first()



def get_property(db: Session, property_id: UUID):
    property_obj = get_property_row(db, property_id)
    if not property_obj:
        return None
    return _serialize_property(db, property_obj)



def create_property(db: Session, payload: PropertyCreate):
    require_organization(db, payload.organization_id)
    obj = Property(id=uuid.uuid4(), **payload.model_dump())
    db.add(obj)
    db.flush()

    total_units = max(1, int(payload.total_units or 1))
    if total_units > 1:
        for index in range(1, total_units + 1):
            db.add(
                Unit(
                    id=uuid.uuid4(),
                    property_id=obj.id,
                    unit_code=f'Unit {index}',
                    is_active=True,
                )
            )

    db.commit()
    db.refresh(obj)
    return _serialize_property(db, obj)



def patch_property(db: Session, obj: Property, payload: PropertyPatch):
    previous_total_units = obj.total_units or 1
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)

    next_total_units = max(1, int(obj.total_units or 1))
    existing_units = _list_units_for_property(db, obj.id)

    if next_total_units > 1 and len(existing_units) < next_total_units:
        existing_codes = {unit.unit_code for unit in existing_units}
        for index in range(1, next_total_units + 1):
            code = f'Unit {index}'
            if code in existing_codes:
                continue
            db.add(
                Unit(
                    id=uuid.uuid4(),
                    property_id=obj.id,
                    unit_code=code,
                    is_active=True,
                )
            )

    if next_total_units <= 1 and previous_total_units > 1 and existing_units:
        for unit in existing_units:
            unit.is_active = False

    db.commit()
    db.refresh(obj)
    return _serialize_property(db, obj)



def _query_property_rows_for_year(db: Session, property_id: UUID, year: int):
    return (
        db.query(FinancialRecord)
        .filter(FinancialRecord.property_id == property_id)
        .filter(FinancialRecord.record_date >= date(year, 1, 1))
        .filter(FinancialRecord.record_date <= date(year, 12, 31))
        .order_by(FinancialRecord.record_date.asc())
        .all()
    )



def build_property_tax_report(db: Session, property_obj: Property, year: int):
    rows = _query_property_rows_for_year(db, property_obj.id, year)

    income_total = Decimal('0.00')
    expense_total = Decimal('0.00')
    deductible_expense_total = Decimal('0.00')
    category_map: dict[str, Decimal] = defaultdict(lambda: Decimal('0.00'))
    monthly_map: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {
            'income': Decimal('0.00'),
            'expense': Decimal('0.00'),
            'net': Decimal('0.00'),
        }
    )

    for row in rows:
        amount = Decimal(str(row.amount))
        month_key = row.record_date.strftime('%Y-%m')
        category_key = row.category_code or row.type or 'uncategorized'
        normalized_type = (row.type or '').lower()

        if normalized_type == 'income':
            income_total += amount
            monthly_map[month_key]['income'] += amount
            monthly_map[month_key]['net'] += amount
        else:
            expense_total += amount
            monthly_map[month_key]['expense'] += amount
            monthly_map[month_key]['net'] -= amount
            if normalized_type in DEDUCTIBLE_EXPENSE_TYPES or category_key != 'income':
                deductible_expense_total += amount

        category_map[category_key] += amount

    category_totals = [
        PropertyCategoryTotal(category_code=key, amount=value)
        for key, value in sorted(category_map.items(), key=lambda item: item[0])
    ]
    monthly_totals = [
        PropertyMonthlyTotal(
            month=key,
            income=value['income'],
            expense=value['expense'],
            net=value['net'],
        )
        for key, value in sorted(monthly_map.items(), key=lambda item: item[0])
    ]

    return PropertyTaxReportRead(
        property_id=property_obj.id,
        property_name=property_obj.name,
        organization_id=property_obj.organization_id,
        year=year,
        record_count=len(rows),
        income_total=income_total,
        expense_total=expense_total,
        net_total=income_total - expense_total,
        deductible_expense_total=deductible_expense_total,
        category_totals=category_totals,
        monthly_totals=monthly_totals,
    )



def build_portfolio_summary(db: Session, organization_id: UUID, year: int):
    properties = (
        db.query(Property)
        .filter(Property.organization_id == organization_id)
        .order_by(Property.created_at.desc())
        .all()
    )
    items: list[PropertyPortfolioSummaryItem] = []
    income_total = Decimal('0.00')
    expense_total = Decimal('0.00')

    for property_obj in properties:
        report = build_property_tax_report(db, property_obj, year)
        income_total += report.income_total
        expense_total += report.expense_total
        items.append(
            PropertyPortfolioSummaryItem(
                property_id=property_obj.id,
                property_name=property_obj.name,
                property_type=property_obj.property_type,
                city=property_obj.city,
                state=property_obj.state,
                total_units=property_obj.total_units,
                record_count=report.record_count,
                income_total=report.income_total,
                expense_total=report.expense_total,
                net_total=report.net_total,
            )
        )

    items.sort(key=lambda item: (-item.net_total, item.property_name))

    return PropertyPortfolioSummaryRead(
        organization_id=organization_id,
        year=year,
        property_count=len(properties),
        income_total=income_total,
        expense_total=expense_total,
        net_total=income_total - expense_total,
        properties=items,
    )
