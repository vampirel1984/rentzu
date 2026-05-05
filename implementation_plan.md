# RentZu Dark Theme UI Redesign

Complete UI overhaul from light (#eef4ff) theme to the dark cityscape-themed design shown in the prototype. All 3 main screens (Summary, Property Detail, Tax Ready) plus supporting screens (Login, Boot, Bottom Nav) will be rewritten.

## User Review Required

> [!IMPORTANT]
> **Logo Mapping from Assets**
> Based on examining all 17 logo files, here's how I'll map them to the UI:
> - **logo_1.png** — RentZu text logo (dark bg) → Login screen branding
> - **logo_2.png** — Cityscape hero banner → Summary screen header background (as requested)
> - **logo_3.png** — "RentZu" text only → Small inline branding
> - **logo_5.png** — Blue building icon → Property type icon (apartment/multi-family)
> - **logo_6.png** — House at night → Property thumbnail for single family homes
> - **logo_7.png** — Microphone icon → Voice recording button
> - **logo_8.png** — Bell notification icon → Notification bell in header
> - **logo_9.png** — Document icon → Documents tab
> - **logo_10.png** — Edit/pencil icon → Edit property button
> - **logo_12.png** — Tax document with calculator → Tax Ready header illustration
> - **logo_13.png** — Red dollar sign → Expense icon
> - **logo_14.png** — Summary house icon → Summary tab nav icon
> - **logo_15.png** — House with chart → Property tab nav icon
> - **logo_16.png** — Clipboard/records icon → Records icon
> - **logo_17.png** — Wrench/repair icon → Repair quick-record icon

> [!WARNING]
> **New features from the prototype that require UI-only implementation (no new backend work):**
> 1. **Cash Flow section** on Property Detail — shows Net cash flow (YTD) with a bar chart visualization and vs-last-year comparison. The chart will be implemented as a simple SVG-like bar chart using React Native Views since we don't have a charting library.
> 2. **Quick Record shortcuts** — Rent, Expense, Repair, More buttons on Property Detail screen
> 3. **All Properties Summary tab** on Tax Ready screen — horizontal scrollable property tabs
> 4. **Deduction Summary** section on Tax Ready — category-based deduction breakdown with icons
> 5. **Reports section** on Tax Ready — Schedule E Summary and Property Expense Summary with PDF download buttons (non-functional placeholders for now)
> 6. **Organization dropdown** styled as a pill selector on Property Detail and Tax Ready screens

## Proposed Changes

### Design System & Color Tokens

The dark theme uses these colors consistently across the prototype:
- **Background**: `#0a0e1a` (deep navy-black)
- **Card background**: `#111827` / `rgba(17, 24, 39, 0.8)` (dark cards with subtle transparency)
- **Card border**: `rgba(55, 65, 81, 0.5)` (subtle gray borders)
- **Primary accent**: `#3b82f6` (bright blue)
- **Green accent**: `#22c55e` (income/positive)
- **Red accent**: `#ef4444` (expense/negative)
- **Purple accent**: `#8b5cf6` (repair/secondary)
- **Primary text**: `#f1f5f9` (near-white)
- **Secondary text**: `#94a3b8` (muted gray)
- **Muted text**: `#64748b` (darker gray)

---

### Summary Screen (Screen 1)

#### [MODIFY] [SummaryScreen.tsx](file:///d:/apps/rentzu/app/src/screens/SummaryScreen.tsx)

Complete rewrite with:
- **Header section**: logo_2.png as background image in top-left, "RentZu" brand text overlaid, notification bell (logo_8.png), greeting text "Good morning, [User] 👋"
- **Organization dropdown**: Styled as a dark pill with dropdown arrow
- **Net year-to-date card**: Dark gradient card showing net amount, "vs last year" with colored percentage arrow, "Across N properties" subtitle, Income/Expenses row with green/red values and percentage changes
- **Plan/billing card**: Shows "Pro" badge, "$2.99 / month", "Manage billing" green gradient button
- **Properties list**: Each property card shows property image (logo_6.png for houses, logo_5.png for apartments), name, type, unit count, record count badge, voice mic button (logo_7.png)
- All backgrounds changed to dark theme colors

---

### Property Detail Screen (Screen 2 — HomeScreen)

#### [MODIFY] [HomeScreen.tsx](file:///d:/apps/rentzu/app/src/screens/HomeScreen.tsx)

Complete rewrite with:
- **Header**: Back arrow, property name centered, "..." menu button
- **Organization pill**: Dropdown selector
- **Property info card**: Property image, name, type, unit count, edit button (logo_10.png)
- **Tab bar**: Overview | Records | Documents tabs
- **Cash Flow section** (NEW): "Net cash flow (YTD)" with large dollar amount, "vs last year ↑ X.X%" indicator, bar chart visualization using Views, month labels (Jan, Apr, Jul, Oct)
- **Income/Expenses/Records summary row**: Three metric boxes showing totals
- **Quick record section**: 4 circular icon buttons — Rent (green house), Expense (red dollar/logo_13.png), Repair (logo_17.png), More (dots). "Add transaction" link
- **Recent records**: Date-sorted list with amounts (green for income, red for expense), "View all" link, chevron arrows

---

### Tax Ready Screen (Screen 3)

#### [MODIFY] [TaxReadyScreen.tsx](file:///d:/apps/rentzu/app/src/screens/TaxReadyScreen.tsx)

Complete rewrite with:
- **Header**: "Tax Ready" centered, info icon
- **Organization + Tax Year dropdowns**: Two pill selectors
- **Property tabs**: "All Properties Summary" | "33 Selye" | "44 Hawkins" — horizontal scrollable, underlined active state
- **Estimated tax impact card**: Large negative dollar amount, Tax illustration (logo_12.png), "Total deductions" amount in green
- **Deduction summary section**: "All Properties" scope, "2026 YTD" label, category breakdown with icons: Rent, Legal & Professional, Taxes, Utilities, Maintenance & Repairs, Other Expenses — each with green dollar amounts
- **Total Deductions and Net Tax Impact rows**: Bold summary totals
- **Reports section**: "View all" link, "Schedule E Summary" and "Property Expense Summary" items with PDF badges and download icons

---

### App Shell & Navigation

#### [MODIFY] [App.tsx](file:///d:/apps/rentzu/app/App.tsx)

- Dark theme for boot screen, org bar, bottom navigation
- Bottom nav icons replaced with logo assets: logo_14.png (Summary), logo_15.png (Property), logo_12.png (Tax Ready), account icon
- Active tab indicator with blue color
- StatusBar style changed to "light" for dark backgrounds
- Bottom bar background: dark semi-transparent with border

---

### Login & Verify Screens

#### [MODIFY] [LoginScreen.tsx](file:///d:/apps/rentzu/app/src/screens/LoginScreen.tsx)

- Dark background (#0a0e1a)
- logo_1.png for branding
- Dark input fields
- Blue primary button with gradient feel
- Consistent dark card styling

#### [MODIFY] [VerifyEmailScreen.tsx](file:///d:/apps/rentzu/app/src/screens/VerifyEmailScreen.tsx)

- Match dark theme colors

---

### Supporting Files

#### [MODIFY] [NewPropertyScreen.tsx](file:///d:/apps/rentzu/app/src/screens/NewPropertyScreen.tsx)
- Dark theme colors for form

#### [MODIFY] [RecordFormScreen.tsx](file:///d:/apps/rentzu/app/src/screens/RecordFormScreen.tsx)
- Dark theme colors for form

#### [MODIFY] [logos-index.js](file:///d:/apps/rentzu/app/assets/logos-index.js)
- Add logo_17.png to the arrays

## Open Questions

> [!IMPORTANT]
> 1. The prototype shows a **"vs last year"** comparison with percentage changes (↓12.4%, ↑8.2%, etc.). Since there's no backend endpoint for year-over-year comparison yet, should I show these as **static placeholder values** or **hide them entirely** until the backend supports it?
> 2. The **bar chart** on the Property Detail screen — the app doesn't have a charting library installed. I'll build a simple bar chart using plain React Native `View` elements with heights proportional to values from the `monthly_totals` data in the tax report API. Is that acceptable, or would you prefer I install a charting library like `react-native-chart-kit`?
> 3. The **Reports section** with Schedule E PDF and Property Expense PDF — these aren't implemented on the backend. Should I show them as **visual placeholders** with non-functional PDF/download buttons?

## Verification Plan

### Manual Verification
- Run `npx expo start` from the app directory
- Visually verify each screen matches the dark prototype:
  - Summary screen with logo_2.png header, dark cards, property list
  - Property Detail with cash flow chart, quick record buttons
  - Tax Ready with deduction summary, reports section
- Verify all existing functionality still works (navigation, data loading, voice recording, record CRUD)
- Check bottom navigation styling and active states
