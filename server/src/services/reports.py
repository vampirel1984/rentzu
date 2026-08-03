"""PDF report generation for tax-ready reports."""
# Modified by AI on 07/18/2026. Edit #1.

import io
from collections import defaultdict
from datetime import date
from decimal import Decimal
from uuid import UUID

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.orm import Session

from models.financial_record import FinancialRecord
from services.properties import build_portfolio_summary, build_property_tax_report, get_property_row


BRAND_DARK = colors.HexColor('#0a0e1a')
BRAND_BLUE = colors.HexColor('#3b82f6')
BRAND_GREEN = colors.HexColor('#22c55e')
BRAND_RED = colors.HexColor('#ef4444')
HEADER_BG = colors.HexColor('#111827')
ROW_ALT = colors.HexColor('#f8fafc')


def _fmt(value) -> str:
    amount = float(value or 0)
    sign = '-' if amount < 0 else ''
    return f'{sign}${abs(amount):,.2f}'


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(
        'ReportTitle', parent=ss['Heading1'],
        fontSize=20, textColor=BRAND_DARK, spaceAfter=6,
    ))
    ss.add(ParagraphStyle(
        'ReportSubtitle', parent=ss['Normal'],
        fontSize=11, textColor=colors.gray, spaceAfter=12,
    ))
    ss.add(ParagraphStyle(
        'SectionHead', parent=ss['Heading2'],
        fontSize=14, textColor=BRAND_BLUE, spaceBefore=18, spaceAfter=8,
    ))
    return ss


def _table_style():
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_ALT]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ])


TAX_CATEGORY_LABELS = {
    'rent': 'Rents Received',
    'rental_income': 'Rents Received',
    'additional_income': 'Additional Income',
    'other_income': 'Other Income',
    'legal': 'Legal & Professional',
    'professional': 'Legal & Professional',
    'accounting': 'Legal & Professional',
    'utility': 'Utilities',
    'utilities': 'Utilities',
    'water': 'Utilities',
    'electric': 'Utilities',
    'gas': 'Utilities',
    'internet': 'Utilities',
    'trash': 'Utilities',
    'cleaning': 'Cleaning & Turnover',
    'turnover': 'Cleaning & Turnover',
    'management': 'Management Fees',
    'property_management': 'Management Fees',
    'maintenance': 'Repairs & Maintenance',
    'repair': 'Repairs & Maintenance',
    'repairs': 'Repairs & Maintenance',
    'travel': 'Travel',
    'mileage': 'Travel',
    'insurance': 'Insurance',
    'tax': 'Taxes',
    'property_tax': 'Taxes',
    'taxes': 'Taxes',
    'interest': 'Mortgage Interest',
    'mortgage_interest': 'Mortgage Interest',
    'mortgage': 'Mortgage Principal (non-deductible)',
    'mortgage_principal': 'Mortgage Principal (non-deductible)',
    'hoa': 'HOA / Association',
    'condo': 'HOA / Association',
    'association': 'HOA / Association',
    'improvement': 'Capital Improvements',
    'improvements': 'Capital Improvements',
    'capital_improvement': 'Capital Improvements',
    'other': 'Other Expenses',
}


def _group_categories(category_totals):
    """Group raw category totals into display groups."""
    grouped: dict[str, Decimal] = {}
    for item in category_totals:
        label = TAX_CATEGORY_LABELS.get(
            (item.category_code or '').lower().strip(),
            'Other Expenses',
        )
        grouped[label] = grouped.get(label, Decimal('0')) + item.amount
    return sorted(grouped.items(), key=lambda x: x[0])


def generate_schedule_e_pdf(
    db: Session,
    organization_id: UUID,
    year: int,
    organization_name: str = 'Portfolio',
) -> bytes:
    """Generate a Schedule E Summary PDF for all properties in the organization."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    ss = _styles()
    story = []

    story.append(Paragraph(f'Schedule E Summary — {year}', ss['ReportTitle']))
    story.append(Paragraph(f'{organization_name} · Generated for tax preparation', ss['ReportSubtitle']))
    story.append(Spacer(1, 12))

    summary = build_portfolio_summary(db, organization_id=organization_id, year=year)

    # Portfolio overview table
    story.append(Paragraph('Portfolio Overview', ss['SectionHead']))
    overview_data = [
        ['Metric', 'Amount'],
        ['Total Properties', str(summary.property_count)],
        ['Gross Rental Income', _fmt(summary.income_total)],
        ['Total Expenses', _fmt(summary.expense_total)],
        ['Net Income / (Loss)', _fmt(summary.net_total)],
    ]
    t = Table(overview_data, colWidths=[4 * inch, 2.5 * inch])
    t.setStyle(_table_style())
    story.append(t)
    story.append(Spacer(1, 16))

    # Per-property breakdown
    for prop_summary in summary.properties:
        prop_row = get_property_row(db, prop_summary.property_id)
        if not prop_row:
            continue
        report = build_property_tax_report(db, prop_row, year)

        story.append(Paragraph(f'{prop_summary.property_name}', ss['SectionHead']))

        prop_overview = [
            ['Line Item', 'Amount'],
            ['Gross Rents Received', _fmt(report.income_total)],
            ['Total Expenses', _fmt(report.expense_total)],
            ['Net Income / (Loss)', _fmt(report.net_total)],
        ]
        t = Table(prop_overview, colWidths=[4 * inch, 2.5 * inch])
        t.setStyle(_table_style())
        story.append(t)
        story.append(Spacer(1, 8))

        # Category breakdown
        grouped = _group_categories(report.category_totals)
        if grouped:
            cat_data = [['Category', 'Amount']]
            for label, amount in grouped:
                cat_data.append([label, _fmt(amount)])
            t = Table(cat_data, colWidths=[4 * inch, 2.5 * inch])
            t.setStyle(_table_style())
            story.append(t)

        story.append(Spacer(1, 16))

    doc.build(story)
    return buf.getvalue()


def _list_records_for_property_year(db: Session, property_id: UUID, year: int):
    return (
        db.query(FinancialRecord)
        .filter(FinancialRecord.property_id == property_id)
        .filter(FinancialRecord.record_date >= date(year, 1, 1))
        .filter(FinancialRecord.record_date <= date(year, 12, 31))
        .order_by(FinancialRecord.record_date.asc(), FinancialRecord.created_at.asc())
        .all()
    )


def _normalize_tax_category(record: FinancialRecord) -> str:
    raw = (record.category_code or record.type or 'other').lower().strip()
    return TAX_CATEGORY_LABELS.get(raw, 'Other Expenses')


def _build_property_support_tables(records: list[FinancialRecord]):
    expense_totals: dict[str, Decimal] = defaultdict(lambda: Decimal('0.00'))
    improvements: list[FinancialRecord] = []

    for record in records:
        record_type = (record.type or '').lower().strip()
        category_label = _normalize_tax_category(record)
        amount = Decimal(str(record.amount or 0))

        if record_type == 'income':
            continue
        # Mortgage principal is a cash outflow but not a deductible expense; exclude from Schedule E totals.
        if (record.category_code or '').lower().strip() == 'mortgage':
            continue
        if category_label == 'Capital Improvements' or record_type == 'improvement':
            improvements.append(record)
            continue
        expense_totals[category_label] += amount

    expense_rows = sorted(expense_totals.items(), key=lambda item: item[0])
    improvements.sort(key=lambda r: (r.record_date, r.created_at or r.record_date, str(r.id)))
    return expense_rows, improvements


def generate_property_expense_pdf(
    db: Session,
    organization_id: UUID,
    year: int,
    organization_name: str = 'Portfolio',
    property_id: UUID | None = None,
) -> bytes:
    """Generate a property tax support PDF with income total, expense category totals, and improvement detail."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    ss = _styles()
    story = []

    story.append(Paragraph(f'Property Tax Support Summary — {year}', ss['ReportTitle']))
    story.append(Paragraph(f'{organization_name} · Tax support data by property', ss['ReportSubtitle']))
    story.append(Spacer(1, 12))

    summary = build_portfolio_summary(db, organization_id=organization_id, year=year)

    properties_to_report = summary.properties
    if property_id:
        properties_to_report = [p for p in properties_to_report if p.property_id == property_id]

    for prop_summary in properties_to_report:
        prop_row = get_property_row(db, prop_summary.property_id)
        if not prop_row:
            continue

        report = build_property_tax_report(db, prop_row, year)
        records = _list_records_for_property_year(db, prop_summary.property_id, year)
        expense_groups, improvements = _build_property_support_tables(records)
        improvement_total = sum((Decimal(str(r.amount or 0)) for r in improvements), Decimal('0.00'))

        story.append(Paragraph(f'{prop_summary.property_name}', ss['SectionHead']))

        overview_data = [
            ['Line Item', 'Amount'],
            ['Gross Income', _fmt(report.income_total)],
            ['Total Expenses', _fmt(report.expense_total)],
            ['Capital Improvements', _fmt(improvement_total)],
            ['Net Income / (Loss)', _fmt(report.net_total)],
        ]
        overview = Table(overview_data, colWidths=[4 * inch, 2.5 * inch])
        overview_style = _table_style()
        overview_style.add('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold')
        overview.setStyle(overview_style)
        story.append(overview)
        story.append(Spacer(1, 10))

        story.append(Paragraph('Expense Category Summary', ss['SectionHead']))
        if expense_groups:
            cat_data = [['Expense Category', 'Amount']]
            grouped_total = Decimal('0.00')
            for label, amount in expense_groups:
                cat_data.append([label, _fmt(amount)])
                grouped_total += amount
            cat_data.append(['Total Categorized Expenses', _fmt(grouped_total)])
            t = Table(cat_data, colWidths=[4 * inch, 2.5 * inch])
            style = _table_style()
            style.add('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold')
            style.add('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#374151'))
            t.setStyle(style)
            story.append(t)
        else:
            story.append(Paragraph('No expense records for this property.', ss['Normal']))

        story.append(Spacer(1, 10))
        story.append(Paragraph('Capital Improvement Detail', ss['SectionHead']))
        if improvements:
            imp_data = [['Date', 'Description', 'Amount']]
            for record in improvements:
                desc = (record.description or record.notes or record.counterparty or '').strip() or 'Improvement'
                imp_data.append([
                    record.record_date.isoformat(),
                    desc,
                    _fmt(record.amount),
                ])
            imp_table = Table(imp_data, colWidths=[1.25 * inch, 3.95 * inch, 1.3 * inch])
            imp_table.setStyle(_table_style())
            story.append(imp_table)
        else:
            story.append(Paragraph('No capital improvement records for this property.', ss['Normal']))

        story.append(Spacer(1, 20))

    doc.build(story)
    return buf.getvalue()
