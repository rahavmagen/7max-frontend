# Expenses-Only XLS Upload Mode

**Date:** 2026-03-28
**Status:** Approved

## Problem

Uploading a full ClubGG XLS file to production updates everything: players, game sessions, chip balances, rake, and expenses. When the goal is only to update the Admin Expenses report (הוצאות tab), the full upload is risky — it could overwrite player data, create duplicate game sessions, or affect chip balances.

## Solution

Add an **"Expenses Only"** toggle to the existing Upload page. When enabled, the same XLS file is sent to a new dedicated backend endpoint that reads **only** the הוצאות tab and saves AdminExpense records — touching nothing else.

---

## Frontend (Upload.jsx)

- Add a toggle switch above the drop zone labeled **"Expenses Only Mode"**
- When unchecked (default): existing behavior, full upload to `POST /import/report`
- When checked:
  - Drop zone border turns **amber** as a visual warning
  - Warning text: "Only updates the הוצאות tab — does not touch players, games, or balances"
  - File is sent to `POST /import/expenses-only`
  - Result message shows: `Imported: X new expense rows (Y already existed)`
- A new `uploadExpensesOnly(file)` function added to `api.js`
- Existing upload flow is not changed in any way

---

## Backend

### New endpoint
`POST /import/expenses-only` in `ImportController`

### New service method
`importExpensesOnly(MultipartFile file)` in `ImportService`

**Logic:**
1. Open the XLS workbook
2. Find the sheet whose name contains `"הוצאות"`
3. If sheet not found → return 400 with error message
4. Parse rows: col A = admin username, col C/E/G = per-admin amounts, col J = wheel total — identical parsing to existing full import
5. For each expense row: check `expenseRepository.existsBySourceRef(uniqueRef)` — skip if already exists (same deduplication as today)
6. Save new `AdminExpense` records with `sourceRef = XLS:{admin}:{row}:{col}`
7. Handle wheel total (col J) the same way as full import: delete existing `XLS:WHEEL` record and recreate
8. Return `{ imported: N, skipped: M }`

**What is NOT touched:**
- Players
- GameSession / GameResult
- Credits / Transactions
- ImportSummary
- Chip balances
- Reports table

### Existing import
`ImportService.importReport()` is not modified.

---

## Error Handling

| Scenario | Response |
|---|---|
| File has no הוצאות sheet | 400: "הוצאות sheet not found in this file" |
| Sheet found but empty | 200: `{ imported: 0, skipped: 0 }` |
| File is not a valid xlsx | 400: existing error handling |

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/Upload.jsx` | Add expenses-only toggle + amber visual mode |
| `src/api.js` | Add `uploadExpensesOnly(file)` |
| `ImportController.java` | Add `POST /import/expenses-only` endpoint |
| `ImportService.java` | Add `importExpensesOnly()` method |
