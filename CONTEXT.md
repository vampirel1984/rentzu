# Rentzu Context

## What Rentzu is
Rentzu is a landlord/property-finance app focused on helping small landlords capture income and expenses as they happen, stay tax-ready year-round, and hand cleaner records to accountants.

## Current stack
- Frontend: Expo / React Native app in `D:\apps\rentzu\app`
- Backend: FastAPI in the Rentzu repo (`src` / `server` related layout exists in repo)
- Database: PostgreSQL

## Current product direction
- Strongest value prop: tax-ready bookkeeping for small landlords, not full tax prep
- Unit-based billing fits better than property-count billing
- Voice/data capture can exist, but should not be the main pricing dimension

## Important current UX decisions
- Records UX should emphasize the current tax year, not all-time history
- Main records section should show the most recent 5 items with edit/delete
- Prefer a separate all-records view over a huge inline expanded list
- Showing a read-only category badge on records is acceptable
- Avoid compact-list inline category editing for now
- `Uncategorized` is an acceptable fallback badge label

## Records behavior already established
- Backend `list_financial_records` sorts by:
  1. `record_date desc`
  2. `created_at desc`
  3. `id desc`
- If a record date changes, the record can move position after refresh

## Billing/backend notes already established
- `organization_billing` stores workspace billing state
  - Stripe customer/subscription ids
  - price/product ids
  - billed/free unit counts
  - status
  - `current_period_end`
- `billing_events` exists to persist Stripe webhook history
- Webhook flow is intended around `POST /billing/webhook`
- `GET /billing/webhook` returning Method Not Allowed is expected and confirms route presence
- Stripe secret key (`sk_...`) and webhook signing secret (`whsec_...`) are different things

## Frontend redesign plan in flight
A dark theme redesign plan already exists in `implementation_plan.md`, covering:
- Summary screen redesign
- Property detail redesign
- Tax Ready redesign
- Login/verify screens dark theme
- App shell / bottom navigation refresh
- Quick record shortcuts
- Cash flow section
- Reports placeholders

## Backend/dev notes
FastAPI startup basics from existing repo notes:
- Create venv: `python -m venv .venv`
- Activate: `.venv\Scripts\activate`
- Install deps: `pip install -r requirements.txt`
- If needed: `pip install email-validator`
- Start from `src`: `uvicorn main:app --reload`
- Docs: `http://127.0.0.1:8000/docs`

Current starter routes from existing notes:
- `/properties`
- `/units`
- `/renters`
- `/financial-records`

## Known useful repo files
- `implementation_plan.md` — UI redesign/spec direction
- `NEXTTODO.txt` — short next-step note
- `mvp-pricing-note.md` — pricing thinking
- `2026-04-07-rentzu-llc-year-end-tax-forms-and-efile-report.md` — tax/report positioning research
- `START_FASTAPI.txt` — local backend startup steps

## Near-term likely priorities
From current repo notes and recent work, likely next valuable tasks are:
- organizations router
- minimal `users/me` logic
- seed/test data scripts
- README / project structure documentation
- auth placeholder cleanup

## How to use this file
When starting Rentzu-related work, read this file first for cheap context, then inspect code only for the specific area being changed or verified.
