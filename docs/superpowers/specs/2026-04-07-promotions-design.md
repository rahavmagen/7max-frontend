# Promotions Feature Design
**Date:** 2026-04-07

## Problem

Two types of promotions need tracking:

1. **Chip promos** (rakeback, tournament fill, wheel prizes) — club gives chips to a player in ClubGG. Profit auto-reduces via chip count. Needs documentation only.
2. **Balance write-offs** — player played on club's cost, lost, has negative balance. Club forgives the debt. No chips involved. Profit does NOT auto-reduce — must be explicitly deducted.

## Profit Formula

> Profit = (Credits collected + Bank deposits) − Chips outstanding

- Chip promos: chips go up in ClubGG → profit auto-reduces → **no extra deduction needed**
- Write-offs: no chip movement → profit unchanged → **must be explicitly deducted**

## Solution

### Two new transaction types (added to `Transaction.Type` enum)

| Type | Balance effect | Profit deduction | XLS matching |
|---|---|---|---|
| `CHIP_PROMO` | None (chips come via ClubGG import) | None (auto via chips) | No |
| `PROMOTION` | +amount (closes negative balance) | Yes — summed and deducted | No |

### UI — Transfers page

New "Promotions" section with two buttons:
- **Chip Promo**: player picker, amount, free-text notes
- **Write Off**: player picker, amount (pre-filled with abs of player's negative balance, editable), free-text notes

Neither goes through pending/confirmation flow.

### Expenses tab

New **Promotions** group alongside existing Admin Expenses and Wheel Expenses groups.
Shows all `CHIP_PROMO` and `PROMOTION` transactions: player / amount / notes / date.

### Profit report

Adds "Promotions" expense line = `SUM(amount) WHERE type = 'PROMOTION'`.
`CHIP_PROMO` transactions are shown in expenses tab only — not deducted from profit.

## Files Affected

**Backend:**
- `Transaction.java` — add `CHIP_PROMO`, `PROMOTION` to enum
- `TransactionService.java` — handle `PROMOTION` as balance-adding type (like DEPOSIT)
- `XlsMatchingService.java` — exclude new types from chip delta calc
- New endpoint `POST /api/transactions/promo` (or reuse existing transaction endpoint)
- Expenses endpoint — return new types grouped as "Promotions"
- Profit summary endpoint — include PROMOTION total as deduction

**Frontend:**
- `Transfers.jsx` — new Promotions section
- `AdminExpenses.jsx` (or equivalent expenses tab) — new Promotions group
- `TotalProfit.jsx` (or profit summary) — new Promotions deduction line
- `api.js` — new API call for creating promos
