# Design: XLS Grouping-Based Pending Match Algorithm + Tests

**Date:** 2026-04-03
**Status:** Approved

---

## Problem

Current XLS matching tries to match individual pending transactions one-by-one against individual XLS Trade Record rows. This breaks for mixed scenarios — e.g. a transfer where one player reduces credit instead of giving chips, or a transfer that is partially offset by a credit reduction. These get stuck in pending forever.

---

## Solution: Group-Based Matching

Instead of 1-to-1 matching, group all pending activities per player, compute the **expected net chip delta**, and compare to the **actual net chip delta** from the XLS. If they match → confirm all pending for that player.

---

## Activity → Expected Chip Delta

Every website activity has a known expected chip effect:

| Activity | DB type | sourceRef | Expected chip delta for player |
|---|---|---|---|
| Add Credit +X | `DEPOSIT` | `SCREEN:CREDIT` | +X (club sends chips) |
| Remove Credit -X (chips) | `WITHDRAWAL` | `SCREEN:CREDIT` | −X (club claims chips) |
| Remove Credit -X (bookkeeping) | `WITHDRAWAL` | `SCREEN:CREDIT` | 0 (no chips, new checkbox) |
| Transfer A→B — payer A | `REPAYMENT` | `TRANSFER:x` | +X (A paid cash, gets chips back) |
| Transfer A→B — receiver B | `CREDIT` | `TRANSFER:x` | −X (B got cash, chips claimed) |
| Promotion | `DEPOSIT` | `SCREEN:PROMO` | +X (club sends chips) |
| Wheel Expense | `WHEEL_EXPENSE` | any | −X (negative Send Chips in XLS) |

---

## Matching Algorithm (per XLS upload, per player)

```
xls_net = sum(Send Chips) − sum(Claim Chips)   [from Trade Record for this player]

pending = all pending transactions for this player

expected_net = sum of chip delta for each pending transaction (table above)

if xls_net == expected_net:
    confirm all pending transactions for this player ✓
else:
    leave pending, flag as unresolved ✗
```

**Note on "bookkeeping-only" credits:** When `noChipChange = true` (new checkbox), the transaction is auto-confirmed at creation time and never enters pending. It does not appear in the XLS. The algorithm never sees it.

---

## Scenarios

| # | Website activity | XLS Trade Record | Expected net | Match? |
|---|---|---|---|---|
| 1 | Add Credit +1000 | Send Chips +1000 | +1000 | ✓ |
| 2 | Remove Credit −1000 (chips) | Claim Chips +1000 | −1000 | ✓ |
| 3 | Remove Credit −1000 (bookkeeping) | nothing | auto-confirmed | n/a |
| 4 | Transfer A→B 1000 (full chips) | Send +1000 to A, Claim +1000 from B | A: +1000, B: −1000 | ✓ |
| 5 | Transfer A→B 1000, B reduces credit (no chips for B) | Send +1000 to A, nothing for B | A: +1000, B: 0 | ✓ |
| 6 | Transfer A→B 1000, B reduces credit 300 + chips 700 | Send +1000 to A, Claim +700 from B | A: +1000, B: −700 | ✓ |
| 7 | Wheel Expense −500 | Send Chips −500 (negative) | −500 | ✓ |
| 8 | Promotion +500 | Send Chips +500 | +500 | ✓ |

---

## Tests

### Setup
- Local PostgreSQL `poker_tracker` (localhost:5432)
- Tests **commit** real data — visible in local UI
- Test players named `TEST_S1` through `TEST_S8` (easy to identify and delete from UI when done)
- One hand-crafted `test-scenarios.xlsx` with Trade Record entries for all 8 test players

### Test structure (Java, Spring Boot)

```
src/test/java/com/sevenmax/tracker/
  matching/
    XlsGroupMatchingTest.java     ← 8 integration test methods, one per scenario

src/test/resources/
  application.properties          ← local DB config (localhost poker_tracker)
  test-xls/
    test-scenarios.xlsx           ← all 8 scenarios, one player each
```

### Per test method
1. Create test player (`TEST_Sx`)
2. Seed pending transactions for that player matching the scenario
3. Call `ReportService.processTradeRecord()` directly with the test XLS
4. Assert: pending transactions are confirmed (`pendingConfirmation = false`)
5. Assert: no duplicate transactions created
6. Assert: transaction type and notes are correct for the transaction page

### Unit tests (matching logic only)
- `XlsMatchingUnitTest.java` — no DB, no XLS file
- Pass mock pending transaction lists and mock XLS chip deltas
- Assert the grouping logic returns correct confirm/reject decisions

---

## What Does NOT Change
- XLS parsing logic (Trade Record reading)
- Transaction creation
- Player balance updates
- Existing confirmed transactions
- Railway production — never touched by tests
