import sys
sys.path.insert(0, r'D:\apps\rentzu\server\src')
from dotenv import load_dotenv
load_dotenv(r'D:\apps\rentzu\.env')
from db import engine
from sqlalchemy import text

ORG_ID = 'cd138a09-0d62-44a1-bbb3-cd8dc58d3a17'

with engine.connect() as conn:
    row = conn.execute(text("SELECT * FROM organization_billing WHERE organization_id = :oid"), {"oid": ORG_ID}).mappings().fetchone()
    print("CURRENT:", dict(row))
    events = conn.execute(text("""
        SELECT id, created_at, event_type, raw_payload
        FROM billing_event
        WHERE organization_id = :oid
        ORDER BY created_at DESC LIMIT 5
    """), {"oid": ORG_ID}).mappings().fetchall()
    for e in events:
        print("EVENT:", e['created_at'], e['event_type'])
