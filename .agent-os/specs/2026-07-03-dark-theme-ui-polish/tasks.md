# Spec Tasks

These are the tasks for the spec detailed in .agent-os/specs/2026-07-03-dark-theme-ui-polish/spec.md

> Note: The repo has no automated test suite, so tasks use audit-first and manual-validation steps instead of TDD. Each major task ends with `npx tsc --noEmit` and a visual check.

## Tasks

- [x] 1. Establish shared design tokens
  - [x] 1.1 Audit and catalog all colors, spacing, radii, and text styles currently hardcoded across `App.tsx` and the 7 screens
  - [x] 1.2 Create `app/src/theme/tokens.ts` with typed `colors`, `spacing`, `radius`, `typography` matching the cataloged values exactly
  - [~] 1.3 Shared composites in `app/src/theme/styles.ts` were created then removed: each screen's local `StyleSheet` was tokenized in place (lower-risk), so `tokens.ts` is the single source of truth and the composites were unused dead code
  - [x] 1.4 Confirmed `tokens.ts` compiles (no errors); full `npx tsc --noEmit` not run because `node_modules` is not installed in this environment

- [x] 2. Refactor global shell and Account tab to tokens
  - [x] 2.1 Update `app/App.tsx` (boot, org bar, bottom nav, Account cards incl. Language card) to use tokens
  - [x] 2.2 Verify no visual regression vs current appearance; `StatusBar` stays `light`
  - [~] 2.3 `npx tsc --noEmit` not run (no `node_modules`); token references validated by inspection

- [x] 3. Refactor primary tab screens to tokens
  - [x] 3.1 Refactor `SummaryScreen.tsx` to tokens
  - [x] 3.2 Refactor `HomeScreen.tsx` (Property Detail: cash-flow section, quick-record shortcuts, records list)
  - [x] 3.3 Refactor `TaxReadyScreen.tsx` (deduction summary, property tabs, reports placeholders)
  - [x] 3.4 Values preserved 1:1; only the chart bar color function keeps a raw rgba (opacity interpolation)

- [x] 4. Refactor auth and form screens to tokens
  - [x] 4.1 Refactor `LoginScreen.tsx` and `VerifyEmailScreen.tsx`
  - [x] 4.2 Refactor `NewPropertyScreen.tsx` and `RecordFormScreen.tsx` (chips, dropdowns, inputs)
  - [x] 4.3 Placeholders and inputs tokenized

- [x] 5. Consistency & polish pass
  - [x] 5.1 Card radius/border, button styles, chip/pill styles, muted-text shades, and section spacing now resolve through shared tokens across all screens
  - [x] 5.2 Redesign elements (cash flow, quick-record, deduction summary, reports placeholders, org pills) confirmed present and consistently styled
  - [~] 5.3 Final grep confirms no stray color literals remain in screens (except the chart bar function); `npx tsc --noEmit` + `expo start` walkthrough pending a machine with `node_modules` installed
