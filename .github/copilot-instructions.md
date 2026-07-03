# Rentzu — Copilot Coding Agent Instructions

Trust these instructions first. Only search the codebase if something here is missing or proves incorrect.

## What this repository is

Rentzu is a landlord / property-finance application. Its core value is **tax-ready bookkeeping for small landlords**: capturing rental income and expenses as they happen, categorizing them, and producing year-end / tax-ready summaries and reports. Billing is unit-based (Stripe). Voice capture (speak a record → transcribe) is a secondary feature.

It is a **two-part project** in one repo:

- **Backend** — Python **FastAPI** REST API (`server/src`), **SQLAlchemy 2.x** ORM, **PostgreSQL** database, JWT auth, Stripe billing, and `faster-whisper` voice transcription.
- **Frontend** — **Expo / React Native** mobile app in TypeScript (`app/`).

Size: small/medium. Backend is the primary area of active work. There are **no automated tests and no CI/CD workflows** in this repo (no `.github/workflows`, no pytest suite, no lint config). Do not assume a build pipeline will validate your change — validate manually as described below.

## Current goal and project organization expectations

- **Primary goal: a fast rollout to production.** Prioritize changes that move the app toward a shippable, production-ready state. Prefer pragmatic, working solutions over speculative abstractions or large rewrites. Keep changes scoped, low-risk, and easy to review so they can ship quickly.
- **Beautify the current UI.** When touching frontend screens, improve the visual polish and consistency of the existing UI rather than redesigning from scratch. Reuse the **nicer, already-built components in the repo** (see `app/src/screens` and shared UI in `app/src`, plus the polished patterns in the HTML mocks such as `home-mock.html`, `property-detail-mock.html`, and `property-year-summary-mock.html`, and the dark-theme direction in `implementation_plan.md`). Favor existing styled components and design tokens over introducing new one-off styles or new UI libraries.
- **Keep the project organized.** Follow the established folder structure and conventions (backend: `models/` + `schemas/` + `services/` + `routers/`; frontend: `screens/` + `services/` + `hooks/`). Put new code where similar code already lives; do not create parallel structures. Avoid leaving temporary/scratch files in the repo root (several `tmp_*.py` and mock files already exist there — do not add more).

## Runtimes and versions

- **Python** 3.11+ (FastAPI 0.115+, SQLAlchemy 2.0+, Pydantic 2.7+). Dependencies: [requirements.txt](requirements.txt).
- **Node** v24 / **npm** 11 for the Expo app (Expo SDK 51, React Native 0.74, React 18, TypeScript 5.3 `strict`).
- **PostgreSQL** must be running for the backend to start (tables are auto-created at startup via `Base.metadata.create_all`).

## Building and running

### Backend (primary)

The repo root holds `requirements.txt`; the runnable source lives in `server/src`. **The backend uses flat (non-package) imports** (e.g. `from db import ...`, `from models import ...`), so **uvicorn must be launched from inside `server/src`** or those imports fail.

Always follow this sequence from the repo root:

```pwsh
python -m venv .venv
.venv\Scripts\Activate.ps1        # PowerShell (or .venv\Scripts\activate in cmd)
pip install -r requirements.txt   # installs faster-whisper etc. — first run is slow
Copy-Item .env.example .env       # only if .env does not exist
cd server\src
python -m uvicorn main:app --reload
```

- API docs: `http://127.0.0.1:8000/docs`. Root health check: `GET /` returns `{"ok": true, "service": "rentzu-api"}`.
- If startup fails with a missing `email-validator`, run `pip install email-validator` (already in requirements, but note it if using an old venv).
- **The backend will not start without a reachable PostgreSQL** matching `DATABASE_URL` (default `postgresql+psycopg://postgres:password@localhost:5432/rentzu`). Set env vars via `.env` — see [.env.example](.env.example).
- `RENTZU_FIXED_VERIFICATION_CODE=123456` bypasses email for dev verification.

**Do not use `run-server.cmd` / `run-app.cmd` / `START_FASTAPI.txt` paths verbatim** — they hardcode `D:\apps\rentzu`, which is not this repo's location (`c:\repo\rentzu`). Use the repo-root sequence above instead. The scripts are useful only as a reference for env/port behavior (port 8000, host 0.0.0.0).

### Frontend (Expo app)

```pwsh
cd app
npm install
npx expo start -c --port 8081
```

- `app/src/services/api.ts` sets `API_BASE_URL = 'http://10.0.2.2:8000'` (the Android emulator alias for the host's `localhost`). Change this constant when targeting a device/simulator on a different host.
- Type-check with `npx tsc --noEmit` from `app/` (TypeScript is `strict`). There is no separate lint or test script — `package.json` only defines `start`/`android`/`ios`/`web`.
- Optional OpenAI key for voice comes from `RENTZU_OPENAI_API_KEY` env or `app/app.local.json` (git-ignored; see `app.local.example.json`). App builds fine without it.

## Repository-specific rules you MUST follow

These live in `.github/instructions/` and apply to edits:

- **AI attribution comments are mandatory.** When creating a file/function add a header comment `Generated by AI on MM/DD/YYYY`; when editing add `Modified by AI on MM/DD/YYYY. Edit #N.` (increment N per edit). Use the language's comment syntax: `#` for Python, `//` for TS/JS, `--` for SQL, `<!-- -->` for HTML. Use today's date.
- **Minimal, surgical changes only.** Do not refactor, rename, reformat, or restructure unrelated code. Follow existing patterns. See [.github/instructions/code-modification-policy.instructions.md](.github/instructions/code-modification-policy.instructions.md).
- **Every API endpoint must enforce auth.** Existing routers depend on `get_current_user` and call `current_user.require_org_access(organization_id)`. New endpoints must do the same unless explicitly public.
- Note: `api-standards.instructions.md` and parts of `critical-rules.instructions.md` are written for C#/.NET and largely do not apply to this Python/TS codebase — apply their *intent* (auth on all endpoints, UTC timestamps, no blocking on async) rather than the C#-specific syntax.

## Project layout

```
requirements.txt            # backend Python deps (at repo ROOT, not in server/)
.env.example                # backend env template (DATABASE_URL, Stripe, SMTP)
CONTEXT.md                  # product direction & established behaviors — read for domain context
implementation_plan.md      # UI redesign spec
financial_records_schema.sql, schema_updates/*.sql  # DB schema + incremental SQL migrations
server/src/
  main.py                   # FastAPI app; registers all routers; create_all at startup
  db.py                     # engine, SessionLocal, Base, get_db()
  dependencies.py           # CurrentUser, get_current_user
  models/                   # SQLAlchemy ORM models (one file per table)
  schemas/                  # Pydantic request/response schemas
  routers/                  # FastAPI routers: auth, organizations, properties, units,
                            #   renters, financial_records, voice, billing, reports
  services/                 # business logic (properties, billing, reports, jwt_auth,
                            #   passwords, whisper_transcribe, email_delivery, ...)
app/
  App.tsx, app.json, app.config.js, tsconfig.json, package.json
  src/screens/              # React Native screens
  src/services/             # api.ts (fetch + token), auth, billing, properties, ...
  src/hooks/useVoiceRecorder.ts
```

### Backend conventions

- **Routers** are thin: they declare routes, resolve `db: Session = Depends(get_db)` and `current_user = Depends(get_current_user)`, call `current_user.require_org_access(...)`, then delegate to a function in `services/`. Put business logic in `services/`, not routers.
- Registering a new resource = add `models/<x>.py`, `schemas/<x>.py`, `services/<x>.py`, `routers/<x>.py`, then import the model in `main.py` and `app.include_router(...)` with a `prefix` and `tags`.
- Models use `UUID` primary keys, `Text` columns, and `DateTime(timezone=True)` with `server_default=func.now()`. Match this style.
- `list_financial_records` sorts by `record_date desc, created_at desc, id desc` (see CONTEXT.md) — preserve when touching record ordering.

## Validating a change (do this before finishing)

Because there is no CI, validate manually:

- **Backend:** activate `.venv`, `cd server\src`, run `python -m uvicorn main:app --reload`, confirm it boots with no import/SQLAlchemy errors, and hit `http://127.0.0.1:8000/docs` (or `GET /`) to confirm routes load. Requires PostgreSQL running.
- **Frontend:** from `app/`, run `npx tsc --noEmit` to confirm the TypeScript build is clean, then optionally `npx expo start -c`.
- Do not introduce new dependencies unless required; if you must, add backend deps to `requirements.txt` and frontend deps via `npm install <pkg>` inside `app/`.

## Common pitfalls (already observed)

- Launching uvicorn from the repo root instead of `server/src` → `ModuleNotFoundError` on flat imports (`db`, `models`, `routers`). Always `cd server\src` first.
- Using the `.cmd`/`START_FASTAPI.txt` `D:\apps\rentzu` paths → wrong directory. Use repo-root commands above.
- Forgetting PostgreSQL is running → backend crashes on startup during `create_all`.
- Omitting AI attribution comments on edits → violates repo instruction files.
