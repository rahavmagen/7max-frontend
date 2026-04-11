# Club Expenses — Design Spec
**Date:** 2026-04-11
**Status:** Approved

## Overview

A new "Club Expense" activity on the Transfers page that lets admins record operational expenses for the club. Feeds directly into the P&L (הוצאות) and tracks outstanding debts to admins on the balance sheet (חייבים לאדמינים).

## Two Cases

### Case 1: Admin Paid From Pocket
Admin spent personal money on behalf of the club (e.g., parking, accountant). The club owes that admin the money back.

- Creates a `club_expense` record with `paid_by=ADMIN`, `admin_user=<username>`, `settled=false`
- Immediately appears in P&L as הוצאות
- Appears as a liability (חייבים לאדמינים) on the balance sheet until settled
- When the club pays the admin back: mark `settled=true`, record `settled_at` date and `bank_account_id`

### Case 2: Club Paid Directly
Club paid directly from bank account (e.g., direct debit, standing order).

- Creates a `club_expense` record with `paid_by=CLUB`, `bank_account_id=<id>`, `settled=true` (immediately)
- Immediately appears in P&L as הוצאות
- No liability created — already settled

## Data Model

### New Table: `club_expenses`

| Field | Type | Notes |
|-------|------|-------|
| id | bigint PK | auto |
| amount | decimal(12,2) | ₪ amount |
| description | text | free text (parking, accountant, etc.) |
| expense_date | date | when expense occurred |
| paid_by | enum(ADMIN, CLUB) | who paid initially |
| admin_user | varchar (nullable) | admin username (ADMIN case only) |
| bank_account_id | FK → bank_accounts (nullable) | which bank (CLUB case, or settlement bank for ADMIN case) |
| settled | boolean | false for unsettled ADMIN case, true for CLUB case and after repayment |
| settled_at | date (nullable) | when repaid |
| settled_by | varchar (nullable) | who marked settled |
| created_by | varchar | who entered this record |
| created_at | timestamp | auto |

## Backend

**New files:**
- `entity/ClubExpense.java` — JPA entity
- `repository/ClubExpenseRepository.java` — JPA repository
- `controller/ClubExpenseController.java` — REST endpoints

**Endpoints:**
- `POST /api/club-expenses` — create new expense
- `GET /api/club-expenses` — list all (ordered by date desc)
- `GET /api/club-expenses/unsettled` — only unsettled ADMIN expenses (for balance sheet)
- `PATCH /api/club-expenses/{id}/settle` — mark settled, body: `{ bankAccountId, settledAt }`
- `DELETE /api/club-expenses/{id}` — admin only

**Security:** All endpoints require ADMIN or MANAGER role.

## Frontend

**Location:** New tab in `Transfers.jsx` — button label: `🧾 Club Expense`

**Form fields (ADMIN case):**
- Amount ₪ (number, required)
- Date (date picker, default today)
- Description (text, required)
- Paid By toggle: [Admin paid] [Club paid directly]
- Admin username (dropdown of admin users — reuses `getAdminUsers()` already called on page)

**Form fields (CLUB case):**
- Amount ₪ (number, required)
- Date (date picker, default today)
- Description (text, required)
- Paid By toggle: [Admin paid] [Club paid directly]
- Bank Account (dropdown of bank accounts — reuses `getBankAccounts()` already called on page)

**List section** (shown below the form, same card or separate card):
- Shows all club expenses, newest first
- Columns: Date | Description | Paid By | Amount | Status
- ADMIN unsettled rows highlighted in amber — "Settle" button opens inline: date + bank account picker → confirm
- CLUB rows and settled rows show green "✓ Paid"

**New API function in `api.js`:**
```js
export const createClubExpense = (data) => api.post('/club-expenses', data);
export const getClubExpenses = () => api.get('/club-expenses');
export const settleClubExpense = (id, data) => api.patch(`/club-expenses/${id}/settle`, data);
export const deleteClubExpense = (id) => api.delete(`/club-expenses/${id}`);
```

## Accounting Impact

| Scenario | הוצאות (P&L) | חייבים לאדמינים (Balance Sheet) |
|----------|-------------|--------------------------------|
| Admin paid, unsettled | ₪ amount | ₪ amount (liability) |
| Admin paid, settled | ₪ amount | — (cleared) |
| Club paid directly | ₪ amount | — (no liability) |

## Out of Scope (Phase 1)
- Expense categories / chart of accounts (future)
- Receipts/attachment upload (future)
- Approval workflow (future)
- Integration with full מאזן / רווח והפסד report pages (future — these will query `club_expenses` table)
