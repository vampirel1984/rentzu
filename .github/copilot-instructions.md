# Copilot instructions — Rentzu

## Always: maintain the AI work log

**Log file:** `D:\worklog\WORK_LOG.md`

At the end of **every** task, or after completing any meaningful section of work, **append a
new entry** to that file. This is not optional and does not need to be requested — treat it as
part of finishing the work.

### Rules

1. **Newest entry first.** Insert directly under the `## Entries` heading, above older entries.
2. **Never rewrite, condense, or delete existing entries.** The log is append-only history.
   Only correct a previous entry if it recorded something factually wrong, and say so.
3. **One entry per task**, headed `### YYYY-MM-DD — <short title>`. If several entries land on
   the same day, keep them as separate entries rather than merging.
4. Create the file (and `D:\worklog\`) if missing, using the same structure.

### Entry contents

Cover these, briefly — skip a section if genuinely not applicable:

- **Asked** — what the user requested, in one or two lines.
- **Outcome** — did it work; the headline result.
- **Bugs found and fixed** — root cause, not just the symptom, and the fix. Use a table when
  there are several.
- **Verified** — what was actually tested and the evidence (command output, DB row, UI state).
  Distinguish *verified* from *assumed*.
- **Files changed** — real paths, with a short note on what changed in each.
- **Still open** — known issues, deferred items, and anything the user owns.

### Style

- Be specific and factual. Prefer real values (paths, ids, DB rows, error text) over summary
  adjectives — the log's value is that a future session can act on it without re-investigating.
- Record **failed approaches and dead ends** too, with why they failed. Those save the most
  time later.
- Keep it terse; this is an engineering log, not a narrative.

## Project reference

- `pricing_research.md` — source of truth for the pricing/tier design.
- `BILLING_STATUS.md` — current billing implementation status (Stripe + RevenueCat).
- `PRICING_IMPLEMENTATION_TESTING.md` — billing setup/testing walkthrough.
- `.agents/skills/rentzu-manual-testing/` — how to drive the app on the Android emulator.
- `schema_updates/*.sql` — **the app uses `Base.metadata.create_all()`, which never adds
  columns to existing tables.** Schema changes go in a dated SQL file here and must be applied
  to each database manually. Check for unapplied files when a query fails on a missing column.
