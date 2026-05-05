# Rentzu MVP Pricing Note

## Recommended MVP pricing

Keep it simple, understandable, and hard to argue with.

### Core rule
- First property is free.
- Each additional property is **$1/month**.

### Multi-unit adjustment
To avoid undercharging large multi-unit buildings, count properties by unit bands:
- **1–4 units** = counts as **1 property**
- **5–8 units** = counts as **2 properties**
- **9–16 units** = counts as **3 properties**
- continue scaling in simple bands as needed

## Why this works for MVP
- Very easy for users to understand
- Keeps single-property landlords free
- Keeps small landlords low-friction
- Prevents obvious underpricing for 8-unit and larger properties
- Avoids complicated usage-based/token-based billing early on

## Positioning
Do not frame this as "AI transcription pricing."
Frame it as a landlord/productivity plan for managing multiple properties.

Suggested user-facing line:
- **Your first property is free. Add more properties for $1/month each. Multi-unit properties may count as more than one property based on unit count.**

## Product note
Internally, use the platform's canonical object name consistently:
- If the app uses `property`, say property.
- If it uses `unit` in billing logic, keep the user-facing wording simple.

## Why not pure per-unit pricing right now
Pure per-unit pricing is more precise, but it adds friction and complexity too early for MVP. This hybrid model keeps pricing simple while reducing the worst edge cases.
