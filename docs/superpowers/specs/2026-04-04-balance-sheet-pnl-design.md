# Design: Balance Sheet & P&L Page (replaces Total Profit)

**Date:** 2026-04-04
**Status:** Approved

---

## Problem

The current `TotalProfit` page shows an all-time cumulative profit number but has no period breakdown. It also has a confusing intermediate calculation (willExpense cancels itself out). There is no way to ask "how much did the club earn this week?"

---

## Accounting Model

The club's equity (accumulated rake) is derived from the balance sheet identity:

```
Gross Rake (all time) = Bank Deposits + Open Credits − Active Chips
Net Profit            = Gross Rake − Total Expenses
```

**Assets:**
- Bank deposits = sum of all confirmed DEPOSIT transactions
- Open credits = net sum of credit transactions (given − repaid)

**Liabilities:**
- Active chips = latest `chipsTotal` from most recent XLS upload (Report entity)

**Equity:**
- Gross rake = Assets − Liabilities (the "plug" — what the house kept)
- Net profit = Gross rake − all expenses

For a **period** [start → end]:

```
Period Rake = (deposits in period)
            + (net credit change in period)
            − (chips_end − chips_start)

Period Net Profit = Period Rake − expenses in period
```

Where `chips_start` and `chips_end` are the nearest `Report.chipsTotal` at or before each boundary date.

---

## Data Sources (all existing — no schema changes)

| Data | Source | Has date? |
|---|---|---|
| Bank deposits | `transactions` table, DEPOSIT type | ✓ |
| Credit changes | `transactions` table: DEPOSIT where sourceRef=SCREEN:CREDIT (given) minus WITHDRAWAL where sourceRef=SCREEN:CREDIT (repaid) | ✓ |
| Chips snapshot | `Report.chipsTotal` + `Report.periodEnd` | ✓ |
| Expenses | `AdminExpense.amount` + `AdminExpense.expenseDate` | ✓ |

No new tables or schema changes required.

---

## Page Structure

**Route:** `/total-profit` (replaces existing TotalProfit page)
**Nav link:** "Total Profit" (unchanged)
**File:** `src/pages/TotalProfit.jsx` (rewritten)

### Card 1 — Balance Sheet (current snapshot)

Always visible, no date filter. Shows state as of today.

| Row | Value |
|---|---|
| Bank Deposits | Sum of all DEPOSIT transactions |
| + Open Credits | Net credit transactions (all time) |
| − Active Chips | Latest Report.chipsTotal |
| **= Gross Rake** | Assets − Liabilities |
| − Total Expenses | Sum of all AdminExpense |
| **= Net Profit** | Gross Rake − Expenses |

### Card 2 — Period P&L

Date range inputs (from / to). Defaults to current month on load. Re-fetches on change.

| Row | Value |
|---|---|
| Deposits in period | Sum DEPOSIT transactions in range |
| + Net credit change | Credit given − repaid in range |
| − Chip change | chips(end) − chips(start) |
| **= Period Rake** | calculated |
| − Expenses in period | Sum AdminExpense in range |
| **= Net Profit for period** | calculated |

Also shows: chip snapshot dates used for start/end (so user knows which XLS upload was used).

---

## Backend

### New endpoint: `GET /api/balance-sheet`

**Query params:**
- `from` (optional, ISO date) — start of period
- `to` (optional, ISO date) — end of period

**Response:**
```json
{
  "snapshot": {
    "bankDeposits": 150000,
    "openCredits": 45000,
    "activeChips": 180000,
    "grossRake": 15000,
    "totalExpenses": 8000,
    "netProfit": 7000,
    "chipsAsOf": "2026-04-04"
  },
  "period": {
    "from": "2026-04-01",
    "to": "2026-04-04",
    "deposits": 12000,
    "netCreditChange": 3000,
    "chipsStart": 170000,
    "chipsStartDate": "2026-03-31",
    "chipsEnd": 180000,
    "chipsEndDate": "2026-04-04",
    "chipDelta": 10000,
    "periodRake": 5000,
    "expenses": 2000,
    "netProfit": 3000
  }
}
```

If no `from`/`to` params provided, `period` is null.

### Implementation location
New method in `ReportController` or a new `BalanceSheetController`.

### Snapshot queries
- `bankDeposits`: `transactionRepository.sumAllDeposits()`
- `openCredits`: `transactionRepository.sumNetCredits()`
- `activeChips`: latest `Report.chipsTotal` ordered by `periodEnd DESC`
- `totalExpenses`: `adminExpenseRepository.sumAll()`

### Period queries
- `deposits`: `transactionRepository.sumDepositsBetween(from, to)`
- `netCreditChange`: `transactionRepository.sumNetCreditsBetween(from, to)`
- `chipsStart`: nearest `Report.chipsTotal` where `periodEnd <= from`
- `chipsEnd`: nearest `Report.chipsTotal` where `periodEnd <= to`
- `expenses`: `adminExpenseRepository.sumBetween(from, to)`

---

## What Does NOT Change

- Route stays `/total-profit`, nav label stays "Total Profit"
- All other pages untouched
- No DB schema changes
- `TotalProfit.jsx` is rewritten in place (old logic removed)
- The `getProfitSummary()` API call in current TotalProfit is replaced by new `getBalanceSheet(from, to)` call
