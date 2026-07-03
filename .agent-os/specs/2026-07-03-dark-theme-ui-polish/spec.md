# Spec Requirements Document

> Spec: Dark Theme UI Polish & Design Tokens
> Created: 2026-07-03
> Status: Planning

## Overview

Consolidate the already-applied dark cityscape theme into a single shared design-token/style module and run a consistency + polish pass across all mobile screens. The dark theme colors are currently duplicated and hardcoded in every screen; centralizing them will remove drift, make future UI work faster, and let us perfect spacing, typography, and component consistency ahead of production release.

## User Stories

### Consistent, polished visual experience

As a landlord using the Rentzu app, I want every screen to look and feel consistent — the same card styling, spacing, colors, and typography — so that the app feels finished and trustworthy when I manage my rental finances.

The user moves between the Summary, Property Detail, Tax Ready, and Account tabs, plus Login/Verify and the property/record forms. Today each screen re-declares its own copies of the dark palette, so subtle differences (border opacity, card radius, muted text shades, button styles) creep in. After this work, all screens draw from one theme source and present a uniform, polished dark UI.

### Faster, safer UI iteration for the team

As a developer, I want a single source of truth for theme colors, spacing, radii, and text styles, so that I can build and adjust screens quickly without hunting for hex values or introducing inconsistencies.

## Spec Scope

1. **Shared design tokens** - Create one theme module exporting color, spacing, radius, and typography tokens that match the existing dark palette in [implementation_plan.md](../../../implementation_plan.md).
2. **Screen refactor to tokens** - Replace hardcoded color/spacing values across all screens and `App.tsx` with references to the shared tokens, preserving current layouts.
3. **Consistency & polish pass** - Normalize card styling, borders, button styles, muted-text shades, spacing, and status-bar handling so screens are visually uniform.
4. **Reusable style helpers (light-touch)** - Extract the most-repeated style objects (card, primary button, pill/chip, section title) into shared styles used by multiple screens.
5. **Verification of redesign elements** - Confirm the intended redesign pieces (cash-flow section, quick-record shortcuts, deduction summary, reports placeholders, org pill selectors) are present and styled consistently; fill any small visual gaps.

## Out of Scope

- New backend endpoints, data model, or API changes.
- New product features (exports/PDFs, year-over-year, depreciation) — those are separate roadmap phases.
- Full UI text internationalization (i18n) — only the existing language toggle stays; screen copy translation is a later phase.
- Introducing a new UI component library or navigation library.
- Light-theme support (the product direction is dark theme only).

## Expected Deliverable

1. A single shared theme/tokens module exists and all screens (`SummaryScreen`, `HomeScreen`, `TaxReadyScreen`, `LoginScreen`, `VerifyEmailScreen`, `NewPropertyScreen`, `RecordFormScreen`) plus `App.tsx` reference it instead of hardcoded values, with no visual regressions.
2. Running the app (`npx expo start -c`) shows a visually consistent dark UI across every screen and tab, with uniform cards, buttons, chips, spacing, and typography.
3. `npx tsc --noEmit` passes clean with the refactor in place.
