# Design: "No Chip Change" Checkbox on Manual Credit

**Date:** 2026-04-03
**Status:** Approved

---

## Problem

Manual Credit supports two fundamentally different operations:

1. **Chip-changing credit** — club physically sends or takes back chips. The XLS trade record will have a matching "Send Chips" or "Claim Chips" row. The transaction must go to pending so it can be reconciled against the XLS.

2. **Bookkeeping-only credit** — no chips move. Examples: forgiving a debt when a player quits, correcting a credit total. The XLS will never have a matching row. The transaction must NOT go to pending — it would stay there forever unmatched.

Currently both operations create a pending transaction, so bookkeeping-only credits get stuck in the pending table indefinitely.

---

## Solution — Option A: "No chip change" checkbox

Add a checkbox to the existing Manual Credit form. When checked, the transaction is auto-confirmed (not pending). When unchecked, behaviour is unchanged.

---

## Changes

### Frontend — `Transfers.jsx`

- Add state: `const [noChipChange, setNoChipChange] = useState(false)`
- Reset `noChipChange` to `false` on successful submit (alongside other field resets)
- Add checkbox below the Notes field in the Manual Credit form:
  - Label: `"No chip change (bookkeeping only — will not appear in pending)"`
  - When checked, show a subtle hint that this will be instantly confirmed
- Pass `noChipChange` flag to `updateCredit` API call

### API — `api.js`

- `updateCredit(playerId, delta, notes, noChipChange)` — include `noChipChange` in the PATCH request body

### Backend — `PlayerController`

- Read `noChipChange` boolean from request body (default: `false` if absent — fully backwards compatible)
- Pass to `PlayerService.updateCredit()`

### Backend — `PlayerService.updateCredit()`

- Add `boolean noChipChange` parameter
- When `noChipChange = true`: set `tx.setPendingConfirmation(false)`
- When `noChipChange = false`: keep existing behaviour (`tx.setPendingConfirmation(true)`)
- All other logic unchanged: balance, creditTotal, sourceRef, notes, audit trail

---

## What does NOT change

- Player transactions page — shows transaction as "Credit Added" / "Credit Removed" regardless
- XLS matching logic — untouched
- Pending table — bookkeeping-only transactions simply never appear there
- Existing pending transactions — unaffected

---

## Backwards Compatibility

The `noChipChange` field defaults to `false` on the backend if not present in the request body. No existing behaviour changes.
