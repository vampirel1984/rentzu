# Technical Specification

This is the technical specification for the spec detailed in .agent-os/specs/2026-07-03-dark-theme-ui-polish/spec.md

## Current State (verified)

- The dark theme is already applied across all screens: backgrounds use `#0a0e1a`, cards use `rgba(17,24,39,0.8)` with `rgba(55,65,81,0.5)` borders, and accents are `#3b82f6` (blue), `#22c55e` (green/income), `#ef4444` (red/expense), `#8b5cf6` (purple/repair). Text uses `#f1f5f9` / `#94a3b8` / `#64748b`.
- These values are **hardcoded and duplicated** in each screen's local `StyleSheet.create` block and in `App.tsx` (73+ `backgroundColor` occurrences across 7 screens).
- There is **no shared theme module** and no shared style helpers today.
- Redesign elements already present: quick-record shortcut circles (`HomeScreen`), org pill selectors, dark Login/Verify, dark forms.

## Technical Requirements

### Design tokens module

- Create `app/src/theme/tokens.ts` exporting typed constants:
  - `colors`: `background`, `card`, `cardBorder`, `accent`/`accentSoft`, `income`, `expense`, `repair`, `textPrimary`, `textSecondary`, `textMuted`, plus input/surface shades currently in use (`rgba(255,255,255,0.06|0.08)`, `#1e293b`).
  - `spacing`: scale (e.g. `xs:4, sm:8, md:12, lg:16, xl:20, xxl:24`) matching current padding/margins.
  - `radius`: (e.g. `sm:8, md:14, lg:16, xl:20`) matching current `borderRadius` usage.
  - `typography`: reusable text style fragments (title, cardTitle, body, muted, moneyLarge, badge) matching current font sizes/weights.
- Values MUST match the current rendered appearance exactly (no visual change) — this is a refactor, not a redesign.

### Shared style helpers

- Create `app/src/theme/styles.ts` (or co-locate) exporting the most-repeated composite styles used by 3+ screens: `card`, `primaryButton` + `primaryButtonText`, `pill`/`pillActive` (org/tax chips), `sectionTitle`, `screenContainer`, `inputField`.
- Screens compose these with `StyleSheet.create` locally for screen-specific overrides; do not force every style into the shared module.

### Screen refactor

- Update each screen to import tokens/shared styles and replace literal hex/rgba/number values:
  - `app/App.tsx`
  - `app/src/screens/SummaryScreen.tsx`
  - `app/src/screens/HomeScreen.tsx`
  - `app/src/screens/TaxReadyScreen.tsx`
  - `app/src/screens/LoginScreen.tsx`
  - `app/src/screens/VerifyEmailScreen.tsx`
  - `app/src/screens/NewPropertyScreen.tsx`
  - `app/src/screens/RecordFormScreen.tsx`
- Preserve existing component structure, props, and layout. Changes are limited to styling values and their source.
- Keep edits surgical per repo policy; do not rename components or restructure files.

### Consistency & polish pass

- Normalize across screens: card `borderRadius` and border color/opacity, primary/secondary button styles, chip/pill styles, muted text shades, section spacing, and `StatusBar` style (`light`).
- Resolve any one-off values that deviate from the token scale by snapping them to the nearest token (only where it produces no meaningful visual change).
- Ensure the Account tab Language card, Plan card, and Organizations card share the standardized card/button styles.

### UI/UX specifications

- Dark theme only; no light-mode toggle.
- Reuse existing logo PNG assets in `app/assets`; do not add new icon libraries.
- Maintain existing accessibility of tap targets (min ~44px height already used by buttons/nav).

### Constraints & validation

- TypeScript is `strict`; tokens must be typed (`as const` / explicit types) and pass `npx tsc --noEmit`.
- No new runtime dependencies (see External Dependencies — none).
- Validate by running `npx expo start -c` and visually diffing each screen against its pre-refactor appearance and the mocks in the repo (`home-mock.html`, `property-detail-mock.html`, `property-year-summary-mock.html`).

## External Dependencies

None. This spec uses only existing React Native `StyleSheet` primitives and current assets; no new libraries are required.
