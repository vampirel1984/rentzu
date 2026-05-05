"""Fix financial_records type CHECK constraint to include 'improvement'."""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE financial_records DROP CONSTRAINT financial_records_type_check"))
    conn.execute(text(
        "ALTER TABLE financial_records ADD CONSTRAINT financial_records_type_check "
        "CHECK (type IN ('expense', 'income', 'improvement'))"
    ))
    conn.commit()
    print("Updated financial_records_type_check to include 'improvement'")

    # Verify
    rows = conn.execute(text(
        "SELECT conname, pg_get_constraintdef(c.oid) "
        "FROM pg_constraint c "
        "WHERE conrelid = 'financial_records'::regclass AND contype = 'c'"
    )).fetchall()
    print("\nCurrent CHECK constraints:")
    for name, definition in rows:
        print(f"  {name}: {definition}")
