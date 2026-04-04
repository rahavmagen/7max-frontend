# Balance Sheet & P&L Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the TotalProfit page with a two-section Balance Sheet + Period P&L page that uses existing DB data with no schema changes.

**Architecture:** New `GET /api/balance-sheet` endpoint in `ReportController` queries existing tables (transactions, reports, admin_expenses) for both an all-time snapshot and an optional date-range P&L. Frontend `TotalProfit.jsx` is fully rewritten to display both sections.

**Tech Stack:** Spring Boot / JPA (backend), React (frontend), existing axios api.js pattern.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/main/java/com/sevenmax/tracker/repository/TransactionRepository.java` | Modify | Add 6 new query methods |
| `src/main/java/com/sevenmax/tracker/repository/AdminExpenseRepository.java` | Modify | Add 2 new query methods |
| `src/main/java/com/sevenmax/tracker/controller/ReportController.java` | Modify | Add `/balance-sheet` endpoint |
| `src/poker-frontend/src/api.js` | Modify | Add `getBalanceSheet(from, to)` |
| `src/poker-frontend/src/pages/TotalProfit.jsx` | Rewrite | New two-card Balance Sheet + P&L layout |

---

## Task 1: Add transaction queries to TransactionRepository

**Files:**
- Modify: `src/main/java/com/sevenmax/tracker/repository/TransactionRepository.java`

- [ ] **Step 1: Add 6 new query methods** after the existing `sumWheelExpensesSince` method:

```java
@Query(value = "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.type = 'DEPOSIT' AND (t.source_ref IS NULL OR t.source_ref NOT LIKE 'SCREEN:%')", nativeQuery = true)
BigDecimal sumAllBankDeposits();

@Query(value = "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.type = 'DEPOSIT' AND t.source_ref = 'SCREEN:CREDIT'", nativeQuery = true)
BigDecimal sumAllCreditsGiven();

@Query(value = "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.type = 'WITHDRAWAL' AND t.source_ref = 'SCREEN:CREDIT'", nativeQuery = true)
BigDecimal sumAllCreditWithdrawals();

@Query(value = "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.type = 'DEPOSIT' AND (t.source_ref IS NULL OR t.source_ref NOT LIKE 'SCREEN:%') AND t.created_at >= :from AND t.created_at < :to", nativeQuery = true)
BigDecimal sumBankDepositsBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

@Query(value = "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.type = 'DEPOSIT' AND t.source_ref = 'SCREEN:CREDIT' AND t.created_at >= :from AND t.created_at < :to", nativeQuery = true)
BigDecimal sumCreditsGivenBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

@Query(value = "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.type = 'WITHDRAWAL' AND t.source_ref = 'SCREEN:CREDIT' AND t.created_at >= :from AND t.created_at < :to", nativeQuery = true)
BigDecimal sumCreditWithdrawalsBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
```

- [ ] **Step 2: Build the tracker project to confirm no compile errors**

Run from `c:\projects\tracker`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS, no errors.

- [ ] **Step 3: Commit**

```bash
cd c:\projects\tracker
git add src/main/java/com/sevenmax/tracker/repository/TransactionRepository.java
git commit -m "feat: add all-time and period transaction query methods for balance sheet"
```

---

## Task 2: Add expense queries to AdminExpenseRepository

**Files:**
- Modify: `src/main/java/com/sevenmax/tracker/repository/AdminExpenseRepository.java`

- [ ] **Step 1: Add 2 new query methods** — add these after `sumExcludingAdminUsername`. Also add `import org.springframework.data.repository.query.Param;` and `import java.time.LocalDate;` if not present:

```java
@Query("SELECT COALESCE(SUM(e.amount), 0) FROM AdminExpense e")
BigDecimal sumAllExpenses();

@Query("SELECT COALESCE(SUM(e.amount), 0) FROM AdminExpense e WHERE e.expenseDate >= :from AND e.expenseDate <= :to")
BigDecimal sumExpensesBetween(@Param("from") java.time.LocalDate from, @Param("to") java.time.LocalDate to);
```

- [ ] **Step 2: Build**

```bash
cd c:\projects\tracker
./mvnw compile -q
```
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/sevenmax/tracker/repository/AdminExpenseRepository.java
git commit -m "feat: add sumAllExpenses and sumExpensesBetween to AdminExpenseRepository"
```

---

## Task 3: Add `/balance-sheet` endpoint to ReportController

**Files:**
- Modify: `src/main/java/com/sevenmax/tracker/controller/ReportController.java`

- [ ] **Step 1: Add the `AdminExpenseRepository` field** — the controller already imports and uses `importSummaryRepository`. Add the new field after the existing repository fields:

In the class fields, add:
```java
private final AdminExpenseRepository adminExpenseRepository;
```

`@RequiredArgsConstructor` will inject it automatically.

Also add import at the top if not present:
```java
import com.sevenmax.tracker.repository.AdminExpenseRepository;
```

- [ ] **Step 2: Add the endpoint** — add this method before the `deleteReport` endpoint:

```java
@GetMapping("/balance-sheet")
public ResponseEntity<Map<String, Object>> balanceSheet(
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to,
        Authentication auth) {
    if (isPlayer(auth)) return ResponseEntity.status(403).build();

    Map<String, Object> result = new LinkedHashMap<>();

    // --- SNAPSHOT ---
    java.math.BigDecimal bankDeposits = transactionRepository.sumAllBankDeposits();
    java.math.BigDecimal creditsGiven = transactionRepository.sumAllCreditsGiven();
    java.math.BigDecimal creditWithdrawals = transactionRepository.sumAllCreditWithdrawals();
    java.math.BigDecimal openCredits = creditsGiven.subtract(creditWithdrawals);

    List<Report> allReports = reportRepository.findAll();
    java.util.Optional<Report> latestReport = allReports.stream()
        .filter(r -> r.getPeriodEnd() != null && r.getChipsTotal() != null)
        .max(java.util.Comparator.comparing(Report::getPeriodEnd));

    java.math.BigDecimal activeChips = latestReport.map(Report::getChipsTotal).orElse(java.math.BigDecimal.ZERO);
    String chipsAsOf = latestReport.map(r -> r.getPeriodEnd().toString()).orElse(null);

    java.math.BigDecimal grossRake = bankDeposits.add(openCredits).subtract(activeChips);
    java.math.BigDecimal totalExpenses = adminExpenseRepository.sumAllExpenses();
    java.math.BigDecimal snapshotNetProfit = grossRake.subtract(totalExpenses);

    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("bankDeposits", bankDeposits);
    snapshot.put("openCredits", openCredits);
    snapshot.put("activeChips", activeChips);
    snapshot.put("chipsAsOf", chipsAsOf);
    snapshot.put("grossRake", grossRake);
    snapshot.put("totalExpenses", totalExpenses);
    snapshot.put("netProfit", snapshotNetProfit);
    result.put("snapshot", snapshot);

    // --- PERIOD ---
    if (from != null && to != null) {
        java.time.LocalDate fromDate = java.time.LocalDate.parse(from);
        java.time.LocalDate toDate = java.time.LocalDate.parse(to);
        java.time.LocalDateTime fromDt = fromDate.atStartOfDay();
        java.time.LocalDateTime toDt = toDate.plusDays(1).atStartOfDay();

        java.math.BigDecimal deposits = transactionRepository.sumBankDepositsBetween(fromDt, toDt);
        java.math.BigDecimal creditsGivenPeriod = transactionRepository.sumCreditsGivenBetween(fromDt, toDt);
        java.math.BigDecimal creditWithdrawalsPeriod = transactionRepository.sumCreditWithdrawalsBetween(fromDt, toDt);
        java.math.BigDecimal netCreditChange = creditsGivenPeriod.subtract(creditWithdrawalsPeriod);

        java.util.Optional<Report> startReport = allReports.stream()
            .filter(r -> r.getPeriodEnd() != null && r.getChipsTotal() != null && !r.getPeriodEnd().isAfter(fromDate))
            .max(java.util.Comparator.comparing(Report::getPeriodEnd));
        java.util.Optional<Report> endReport = allReports.stream()
            .filter(r -> r.getPeriodEnd() != null && r.getChipsTotal() != null && !r.getPeriodEnd().isAfter(toDate))
            .max(java.util.Comparator.comparing(Report::getPeriodEnd));

        java.math.BigDecimal chipsStart = startReport.map(Report::getChipsTotal).orElse(java.math.BigDecimal.ZERO);
        String chipsStartDate = startReport.map(r -> r.getPeriodEnd().toString()).orElse(null);
        java.math.BigDecimal chipsEnd = endReport.map(Report::getChipsTotal).orElse(java.math.BigDecimal.ZERO);
        String chipsEndDate = endReport.map(r -> r.getPeriodEnd().toString()).orElse(null);

        java.math.BigDecimal chipDelta = chipsEnd.subtract(chipsStart);
        java.math.BigDecimal periodRake = deposits.add(netCreditChange).subtract(chipDelta);
        java.math.BigDecimal periodExpenses = adminExpenseRepository.sumExpensesBetween(fromDate, toDate);
        java.math.BigDecimal periodNetProfit = periodRake.subtract(periodExpenses);

        Map<String, Object> period = new LinkedHashMap<>();
        period.put("from", from);
        period.put("to", to);
        period.put("deposits", deposits);
        period.put("netCreditChange", netCreditChange);
        period.put("chipsStart", chipsStart);
        period.put("chipsStartDate", chipsStartDate);
        period.put("chipsEnd", chipsEnd);
        period.put("chipsEndDate", chipsEndDate);
        period.put("chipDelta", chipDelta);
        period.put("periodRake", periodRake);
        period.put("expenses", periodExpenses);
        period.put("netProfit", periodNetProfit);
        result.put("period", period);
    } else {
        result.put("period", null);
    }

    return ResponseEntity.ok(result);
}
```

- [ ] **Step 3: Build**

```bash
cd c:\projects\tracker
./mvnw compile -q
```
Expected: BUILD SUCCESS.

- [ ] **Step 4: Start the backend and test the endpoint manually**

```bash
./mvnw spring-boot:run
```

Then in a new terminal:
```bash
curl -H "Authorization: Bearer <your-token>" http://localhost:8080/api/balance-sheet
```
Expected: JSON with `snapshot` object containing `bankDeposits`, `openCredits`, `activeChips`, `grossRake`, `totalExpenses`, `netProfit`.

```bash
curl -H "Authorization: Bearer <your-token>" "http://localhost:8080/api/balance-sheet?from=2026-04-01&to=2026-04-04"
```
Expected: JSON with both `snapshot` and `period` objects.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/sevenmax/tracker/controller/ReportController.java
git commit -m "feat: add GET /balance-sheet endpoint with snapshot and period P&L"
```

---

## Task 4: Add API call to frontend

**Files:**
- Modify: `src/poker-frontend/src/api.js`

- [ ] **Step 1: Add `getBalanceSheet` export** — add after `getProfitSummary`:

```js
export const getBalanceSheet = (from, to) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return api.get('/balance-sheet', { params });
};
```

- [ ] **Step 2: Commit**

```bash
cd c:\projects\poker-frontend
git add src/api.js
git commit -m "feat: add getBalanceSheet API call"
```

---

## Task 5: Rewrite TotalProfit.jsx

**Files:**
- Rewrite: `src/poker-frontend/src/pages/TotalProfit.jsx`

- [ ] **Step 1: Replace the full file contents** with the following:

```jsx
import { useState, useEffect } from 'react';
import { getBalanceSheet } from '../api';

export default function TotalProfit() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  const [snapshot, setSnapshot] = useState(null);
  const [period, setPeriod] = useState(null);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (Number(n) < 0 ? '-' : '') + '₪' + abs;
  };

  const cls = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : '';

  // Load snapshot on mount
  useEffect(() => {
    getBalanceSheet().then(r => {
      setSnapshot(r.data.snapshot);
      setLoading(false);
    });
  }, []);

  // Load period whenever dates change
  useEffect(() => {
    if (!from || !to) return;
    setPeriodLoading(true);
    getBalanceSheet(from, to).then(r => {
      setPeriod(r.data.period);
      setPeriodLoading(false);
    });
  }, [from, to]);

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Total Profit</h1>
        {snapshot?.chipsAsOf && (
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Chips as of: {snapshot.chipsAsOf}
          </span>
        )}
      </div>

      {/* Card 1: Balance Sheet Snapshot */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Balance Sheet — Current Snapshot</h2>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ color: '#94a3b8' }}>Bank Deposits</td>
              <td className="positive"><strong>{fmt(snapshot?.bankDeposits)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Cash received from players (all time)</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>+ Open Credits</td>
              <td className="positive"><strong>{fmt(snapshot?.openCredits)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Net credit outstanding (owed to club)</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>− Active Chips</td>
              <td className="negative"><strong>({fmt(snapshot?.activeChips)})</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Chips held by players</td>
            </tr>
            <tr style={{ borderTop: '2px solid #334155' }}>
              <td><strong style={{ color: '#e2e8f0' }}>= Gross Rake (all time)</strong></td>
              <td><strong className={cls(snapshot?.grossRake)} style={{ fontSize: '1.1rem' }}>{fmt(snapshot?.grossRake)}</strong></td>
              <td></td>
            </tr>
            <tr style={{ paddingTop: '0.75rem' }}>
              <td style={{ color: '#94a3b8', paddingTop: '1rem' }}>− Total Expenses</td>
              <td className="negative" style={{ paddingTop: '1rem' }}><strong>({fmt(snapshot?.totalExpenses)})</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem', paddingTop: '1rem' }}>Admin + wheel expenses (all time)</td>
            </tr>
            <tr style={{ borderTop: '1px solid #334155' }}>
              <td><strong style={{ color: '#e2e8f0' }}>= Net Profit</strong></td>
              <td><strong className={cls(snapshot?.netProfit)} style={{ fontSize: '1.2rem' }}>{fmt(snapshot?.netProfit)}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Card 2: Period P&L */}
      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Period P&L</h2>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ color: '#94a3b8', fontSize: '0.85rem' }}>From</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ color: '#94a3b8', fontSize: '0.85rem' }}>To</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          </div>
          {periodLoading && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading...</span>}
        </div>

        {period && (
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ color: '#94a3b8' }}>Deposits in period</td>
                <td className="positive"><strong>{fmt(period.deposits)}</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Bank deposits {period.from} → {period.to}</td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8' }}>+ Net credit change</td>
                <td className={cls(period.netCreditChange)}><strong>{Number(period.netCreditChange) >= 0 ? fmt(period.netCreditChange) : `(${fmt(period.netCreditChange)})`}</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Credits given minus repaid</td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8' }}>− Chip change</td>
                <td className={Number(period.chipDelta) > 0 ? 'negative' : 'positive'}>
                  <strong>{Number(period.chipDelta) >= 0 ? `(${fmt(period.chipDelta)})` : fmt(period.chipDelta)}</strong>
                </td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                  {period.chipsStartDate || '—'} → {period.chipsEndDate || '—'}
                </td>
              </tr>
              <tr style={{ borderTop: '2px solid #334155' }}>
                <td><strong style={{ color: '#e2e8f0' }}>= Period Rake</strong></td>
                <td><strong className={cls(period.periodRake)} style={{ fontSize: '1.1rem' }}>{fmt(period.periodRake)}</strong></td>
                <td></td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8', paddingTop: '1rem' }}>− Expenses in period</td>
                <td className="negative" style={{ paddingTop: '1rem' }}><strong>({fmt(period.expenses)})</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem', paddingTop: '1rem' }}>Admin + wheel expenses</td>
              </tr>
              <tr style={{ borderTop: '1px solid #334155' }}>
                <td><strong style={{ color: '#e2e8f0' }}>= Net Profit</strong></td>
                <td><strong className={cls(period.netProfit)} style={{ fontSize: '1.2rem' }}>{fmt(period.netProfit)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Start the frontend dev server and verify**

```bash
cd c:\projects\poker-frontend
npm run dev
```

Open `http://localhost:5173/total-profit`. Verify:
- Card 1 shows snapshot figures (bank deposits, credits, chips, gross rake, expenses, net profit)
- Card 2 shows current month date range by default, with period figures
- Changing dates in Card 2 updates the P&L figures without reloading the page

- [ ] **Step 3: Commit**

```bash
git add src/pages/TotalProfit.jsx
git commit -m "feat: rewrite TotalProfit as Balance Sheet + Period P&L page"
```

---

## Task 6: Push to production

- [ ] **Step 1: Push backend to Railway**

```bash
cd c:\projects\tracker
git push origin main
```

Wait for Railway to deploy. Check Railway dashboard for successful deploy.

- [ ] **Step 2: Push frontend to Vercel**

```bash
cd c:\projects\poker-frontend
git push origin main
```

Wait for Vercel to deploy. Check Vercel dashboard for successful deploy.

- [ ] **Step 3: Smoke test on production**

Open production URL and navigate to Total Profit. Verify both cards show correct data.

---

## Self-Review

**Spec coverage:**
- ✓ Balance sheet snapshot (Card 1): bankDeposits + openCredits − activeChips = grossRake, then minus expenses = netProfit
- ✓ Period P&L (Card 2): deposits + netCreditChange − chipDelta = periodRake, minus expenses = netProfit
- ✓ Date range inputs with defaults to current month
- ✓ Chip snapshot dates shown so user knows which XLS was used
- ✓ Replaces TotalProfit.jsx at `/total-profit` — nav unchanged
- ✓ No schema changes

**Type consistency:** `getBalanceSheet` in api.js → `snapshot` and `period` objects match field names used in TotalProfit.jsx.

**Edge cases handled:**
- No XLS uploads yet: `activeChips = 0`, `chipsAsOf = null`
- No reports in date range: `chipsStart = 0`, `chipsEnd = 0` (chipDelta = 0)
- No expenses: `sumAllExpenses()` returns 0 via COALESCE
