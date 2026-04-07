# Promotions Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CHIP_PROMO (rakeback/docs, no profit deduction) and PROMOTION (balance write-off, explicit profit deduction) transaction types, visible in the Expenses tab under a new Promotions group and in the All-Time P&L.

**Architecture:** Two new `Transaction.Type` enum values. Backend adds a `/transactions/promotions` endpoint and includes `promotionsTotal` in the profit summary. Frontend adds two forms on the Transfers page and a Promotions group on the Expenses tab.

**Tech Stack:** Java/Spring Boot (backend), React/Vite (frontend), PostgreSQL

---

## File Map

| File | Change |
|---|---|
| `tracker/src/.../entity/Transaction.java` | Add `CHIP_PROMO`, `PROMOTION` to Type enum |
| `tracker/src/.../service/TransactionService.java` | PROMOTION adds to balance; CHIP_PROMO is no-op |
| `tracker/src/.../service/XlsMatchingService.java` | Add new cases to exhaustive switch |
| `tracker/src/.../repository/TransactionRepository.java` | Add `sumByTypeName`, `findByTypeIn` |
| `tracker/src/.../entity/ImportSummary.java` | Add `@Transient promotionsTotal` |
| `tracker/src/.../controller/ImportController.java` | Inject `TransactionRepository`, compute promotionsTotal in getProfitSummary |
| `tracker/src/.../controller/TransactionController.java` | Add `GET /transactions/promotions` endpoint |
| `poker-frontend/src/api.js` | Add `getPromotions()` |
| `poker-frontend/src/pages/Transfers.jsx` | Add Chip Promo and Write Off forms + buttons |
| `poker-frontend/src/pages/AdminExpenses.jsx` | Add Promotions group section |
| `poker-frontend/src/pages/TotalProfit.jsx` | Add Promotions write-off deduction line |

---

## Task 1: Add CHIP_PROMO and PROMOTION to Transaction enum

**Files:**
- Modify: `tracker/src/main/java/com/sevenmax/tracker/entity/Transaction.java`
- Modify: `tracker/src/main/java/com/sevenmax/tracker/service/XlsMatchingService.java`

- [ ] **Step 1: Update Transaction.Type enum**

In `Transaction.java`, change:
```java
public enum Type {
    DEPOSIT, WITHDRAWAL, CREDIT, PAYMENT, WHEEL_EXPENSE
}
```
to:
```java
public enum Type {
    DEPOSIT, WITHDRAWAL, CREDIT, PAYMENT, WHEEL_EXPENSE, CHIP_PROMO, PROMOTION
}
```

- [ ] **Step 2: Fix exhaustive switch in XlsMatchingService**

In `XlsMatchingService.java`, change the `chipDelta` method to handle all enum values:
```java
private BigDecimal chipDelta(Transaction tx) {
    return switch (tx.getType()) {
        case DEPOSIT       -> tx.getAmount();
        case PAYMENT       -> tx.getAmount();
        case WITHDRAWAL    -> tx.getAmount().negate();
        case CREDIT        -> tx.getAmount().negate();
        case WHEEL_EXPENSE -> tx.getAmount().negate();
        case CHIP_PROMO, PROMOTION -> BigDecimal.ZERO; // not XLS-matched
    };
}
```

- [ ] **Step 3: Build the backend to verify it compiles**

```bash
cd /c/projects/tracker && ./mvnw compile -q
```
Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
cd /c/projects/tracker && rtk git add src/main/java/com/sevenmax/tracker/entity/Transaction.java src/main/java/com/sevenmax/tracker/service/XlsMatchingService.java && rtk git commit -m "feat: add CHIP_PROMO and PROMOTION to Transaction.Type enum"
```

---

## Task 2: Update TransactionService to handle new types

**Files:**
- Modify: `tracker/src/main/java/com/sevenmax/tracker/service/TransactionService.java`

**Rules:**
- `PROMOTION`: adds to player balance (like DEPOSIT) — it closes a negative balance
- `CHIP_PROMO`: no balance change — chips come from ClubGG import, we only document

- [ ] **Step 1: Update addTransaction**

Replace the balance-adjustment block in `addTransaction`:
```java
@Transactional
public Transaction addTransaction(Transaction transaction) {
    Player player = transaction.getPlayer();
    Transaction.Type type = transaction.getType();

    // CHIP_PROMO: documentation only, no balance change
    if (type != Transaction.Type.CHIP_PROMO) {
        boolean isCredit = type == Transaction.Type.DEPOSIT
                || type == Transaction.Type.PAYMENT
                || type == Transaction.Type.PROMOTION;
        BigDecimal delta = isCredit ? transaction.getAmount() : transaction.getAmount().negate();
        player.setBalance(player.getBalance().add(delta));
        playerRepository.save(player);
    }

    return transactionRepository.save(transaction);
}
```

- [ ] **Step 2: Update updateTransaction to match**

Replace the balance-adjustment block in `updateTransaction`:
```java
@Transactional
public Transaction updateTransaction(Long id, BigDecimal newAmount, String newNotes) {
    Transaction tx = transactionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Transaction not found"));

    // CHIP_PROMO: no balance effect, just update amount/notes
    if (tx.getType() != Transaction.Type.CHIP_PROMO) {
        BigDecimal diff = newAmount.subtract(tx.getAmount());
        boolean adds = tx.getType() == Transaction.Type.DEPOSIT
                || tx.getType() == Transaction.Type.PAYMENT
                || tx.getType() == Transaction.Type.PROMOTION;
        Player player = tx.getPlayer();
        player.setBalance(player.getBalance().add(adds ? diff : diff.negate()));
        playerRepository.save(player);
    }

    tx.setAmount(newAmount);
    if (newNotes != null) tx.setNotes(newNotes);
    return transactionRepository.save(tx);
}
```

- [ ] **Step 3: Build to verify**

```bash
cd /c/projects/tracker && ./mvnw compile -q
```
Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
cd /c/projects/tracker && rtk git add src/main/java/com/sevenmax/tracker/service/TransactionService.java && rtk git commit -m "feat: handle PROMOTION balance credit, CHIP_PROMO as no-op in TransactionService"
```

---

## Task 3: Add repository queries + profit summary field

**Files:**
- Modify: `tracker/src/main/java/com/sevenmax/tracker/repository/TransactionRepository.java`
- Modify: `tracker/src/main/java/com/sevenmax/tracker/entity/ImportSummary.java`

- [ ] **Step 1: Add queries to TransactionRepository**

Add these two methods to `TransactionRepository`:
```java
@Query(value = "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.type = :type", nativeQuery = true)
BigDecimal sumByTypeName(@Param("type") String type);

@Query("SELECT t FROM Transaction t WHERE t.type IN :types ORDER BY t.createdAt DESC")
List<Transaction> findByTypeIn(@Param("types") List<Transaction.Type> types);
```

- [ ] **Step 2: Add @Transient promotionsTotal to ImportSummary**

In `ImportSummary.java`, add after the `lastReportDate` field:
```java
// Computed live from PROMOTION transactions — not stored in DB
@Transient
private BigDecimal promotionsTotal = BigDecimal.ZERO;
```

- [ ] **Step 3: Build to verify**

```bash
cd /c/projects/tracker && ./mvnw compile -q
```
Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
cd /c/projects/tracker && rtk git add src/main/java/com/sevenmax/tracker/repository/TransactionRepository.java src/main/java/com/sevenmax/tracker/entity/ImportSummary.java && rtk git commit -m "feat: add sumByTypeName/findByTypeIn queries and promotionsTotal transient field"
```

---

## Task 4: Update profit summary endpoint + add promotions list endpoint

**Files:**
- Modify: `tracker/src/main/java/com/sevenmax/tracker/controller/ImportController.java`
- Modify: `tracker/src/main/java/com/sevenmax/tracker/controller/TransactionController.java`

- [ ] **Step 1: Inject TransactionRepository into ImportController**

In `ImportController.java`, add to the injected fields:
```java
private final TransactionRepository transactionRepository;
```
(Lombok `@RequiredArgsConstructor` picks it up automatically — just add the field.)

Also add the import at the top:
```java
import com.sevenmax.tracker.repository.TransactionRepository;
```

- [ ] **Step 2: Compute promotionsTotal in getProfitSummary**

In `ImportController.getProfitSummary()`, add the promotions computation inside the `.map()` lambda, after the existing `generalExpenses` line:
```java
BigDecimal promotionsTotal = transactionRepository.sumByTypeName("PROMOTION");
summary.setPromotionsTotal(promotionsTotal != null ? promotionsTotal : java.math.BigDecimal.ZERO);
```

The full updated method should look like:
```java
@GetMapping("/profit-summary")
public ResponseEntity<ImportSummary> getProfitSummary() {
    return importSummaryRepository.findById(1L)
            .map(summary -> {
                BigDecimal wheelExpenses = adminExpenseRepository.sumByAdminUsername("Wheel");
                BigDecimal generalExpenses = adminExpenseRepository.sumExcludingAdminUsername("Wheel");
                summary.setWillExpense(wheelExpenses != null ? wheelExpenses : java.math.BigDecimal.ZERO);
                summary.setGeneralExpenses(generalExpenses != null ? generalExpenses : java.math.BigDecimal.ZERO);
                BigDecimal promotionsTotal = transactionRepository.sumByTypeName("PROMOTION");
                summary.setPromotionsTotal(promotionsTotal != null ? promotionsTotal : java.math.BigDecimal.ZERO);
                return ResponseEntity.ok(summary);
            })
            .orElse(ResponseEntity.noContent().build());
}
```

- [ ] **Step 3: Add GET /transactions/promotions endpoint**

In `TransactionController.java`, add this method:
```java
@GetMapping("/promotions")
public ResponseEntity<?> getPromotions() {
    List<Transaction.Type> types = List.of(Transaction.Type.CHIP_PROMO, Transaction.Type.PROMOTION);
    List<Map<String, Object>> entries = transactionRepository.findByTypeIn(types).stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    BigDecimal writeOffTotal = transactionRepository.sumByTypeName("PROMOTION");
    BigDecimal chipPromoTotal = transactionRepository.sumByTypeName("CHIP_PROMO");
    return ResponseEntity.ok(Map.of(
            "entries", entries,
            "writeOffTotal", writeOffTotal != null ? writeOffTotal : java.math.BigDecimal.ZERO,
            "chipPromoTotal", chipPromoTotal != null ? chipPromoTotal : java.math.BigDecimal.ZERO
    ));
}
```

- [ ] **Step 4: Build and start backend to verify**

```bash
cd /c/projects/tracker && ./mvnw compile -q
```
Expected: `BUILD SUCCESS`

- [ ] **Step 5: Commit**

```bash
cd /c/projects/tracker && rtk git add src/main/java/com/sevenmax/tracker/controller/ImportController.java src/main/java/com/sevenmax/tracker/controller/TransactionController.java && rtk git commit -m "feat: expose promotionsTotal in profit-summary and add /transactions/promotions endpoint"
```

---

## Task 5: Frontend — api.js

**Files:**
- Modify: `poker-frontend/src/api.js`

- [ ] **Step 1: Add getPromotions function**

In `api.js`, after the `deleteAdminExpense` line, add:
```js
export const getPromotions = () => api.get('/transactions/promotions');
```

(`addTransaction` already exists and handles any `type`, so it's reused for creating promos.)

- [ ] **Step 2: Commit**

```bash
cd /c/projects/poker-frontend && rtk git add src/api.js && rtk git commit -m "feat: add getPromotions API function"
```

---

## Task 6: Transfers page — Chip Promo and Write Off forms

**Files:**
- Modify: `poker-frontend/src/pages/Transfers.jsx`

- [ ] **Step 1: Add import for getPlayers (already imported — verify)**

The file already imports `addTransaction` and `getPlayers`. No change needed.

- [ ] **Step 2: Add state variables**

After the `wheelNotes` state line (~line 143), add:
```jsx
// Chip Promo form
const [chipPromoPlayerId, setChipPromoPlayerId] = useState('');
const [chipPromoAmount, setChipPromoAmount] = useState('');
const [chipPromoNotes, setChipPromoNotes] = useState('');

// Write Off form
const [writeOffPlayerId, setWriteOffPlayerId] = useState('');
const [writeOffAmount, setWriteOffAmount] = useState('');
const [writeOffNotes, setWriteOffNotes] = useState('');
```

- [ ] **Step 3: Add Chip Promo submit handler**

After `handleWheelSubmit`, add:
```jsx
// Chip Promo submit — documentation only, CHIP_PROMO type, no XLS matching
const handleChipPromoSubmit = async (e) => {
  e.preventDefault();
  if (!chipPromoPlayerId || !chipPromoAmount) return;
  setSubmitting(true);
  try {
    await addTransaction({
      playerId: chipPromoPlayerId,
      type: 'CHIP_PROMO',
      amount: Number(chipPromoAmount),
      method: 'OTHER',
      notes: chipPromoNotes || null,
      pendingConfirmation: false,
      sourceRef: 'SCREEN:CHIP_PROMO',
    });
    setMsg({ type: 'success', text: 'Chip promo recorded' });
    setChipPromoPlayerId(''); setChipPromoAmount(''); setChipPromoNotes('');
    load();
  } catch {
    setMsg({ type: 'error', text: 'Failed to record chip promo' });
  }
  setSubmitting(false);
};

// Write Off submit — closes negative balance, PROMOTION type, deducted from profit
const handleWriteOffSubmit = async (e) => {
  e.preventDefault();
  if (!writeOffPlayerId || !writeOffAmount) return;
  setSubmitting(true);
  try {
    await addTransaction({
      playerId: writeOffPlayerId,
      type: 'PROMOTION',
      amount: Number(writeOffAmount),
      method: 'OTHER',
      notes: writeOffNotes || null,
      pendingConfirmation: false,
      sourceRef: 'SCREEN:WRITEOFF',
    });
    setMsg({ type: 'success', text: 'Balance write-off recorded' });
    setWriteOffPlayerId(''); setWriteOffAmount(''); setWriteOffNotes('');
    load();
  } catch {
    setMsg({ type: 'error', text: 'Failed to record write-off' });
  }
  setSubmitting(false);
};
```

- [ ] **Step 4: Add two buttons in the button row**

Find the button row section (around line 349 — the `🏆 Promotion (MTT)` button). Add two new buttons after it:
```jsx
<button className={`btn ${activeForm === 'chipPromo' ? 'btn-primary' : 'btn-secondary'}`}
  onClick={() => toggleForm('chipPromo')}
  style={{ background: activeForm === 'chipPromo' ? '#7c3aed' : undefined, color: activeForm === 'chipPromo' ? '#fff' : undefined }}>
  🎁 Chip Promo
</button>
<button className={`btn ${activeForm === 'writeOff' ? 'btn-primary' : 'btn-secondary'}`}
  onClick={() => toggleForm('writeOff')}
  style={{ background: activeForm === 'writeOff' ? '#0e7490' : undefined, color: activeForm === 'writeOff' ? '#fff' : undefined }}>
  ✏️ Write Off
</button>
```

- [ ] **Step 5: Add two form sections**

After the existing `{activeForm === 'wheel' && ...}` block, add:
```jsx
{/* Chip Promo Form */}
{activeForm === 'chipPromo' && (
  <div className="card" style={{ marginBottom: '1.5rem', borderColor: '#7c3aed' }}>
    <h2 style={{ color: '#a78bfa' }}>Chip Promo — Documentation</h2>
    <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
      Record chips given to a player (rakeback, bonus, etc.). Profit auto-adjusts via chip count — this is documentation only.
    </p>
    <form onSubmit={handleChipPromoSubmit}>
      <div className="form-row">
        <PlayerSelect label="Player" value={chipPromoPlayerId} onChange={setChipPromoPlayerId} players={players} />
        <div className="form-group">
          <label>Amount (chips) *</label>
          <input type="number" min="0.01" step="0.01" required value={chipPromoAmount}
            onChange={e => setChipPromoAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input type="text" value={chipPromoNotes} onChange={e => setChipPromoNotes(e.target.value)}
            placeholder="e.g. Rakeback April" />
        </div>
      </div>
      <button type="submit" className="btn" style={{ background: '#7c3aed', color: '#fff' }}
        disabled={submitting || !chipPromoPlayerId}>
        {submitting ? 'Recording...' : '🎁 Record Chip Promo'}
      </button>
    </form>
  </div>
)}

{/* Write Off Form */}
{activeForm === 'writeOff' && (
  <div className="card" style={{ marginBottom: '1.5rem', borderColor: '#0e7490' }}>
    <h2 style={{ color: '#22d3ee' }}>Write Off — Balance Forgiveness</h2>
    <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
      Forgive a player's negative balance. Adds to their balance and is deducted from club profit as a promotion expense.
    </p>
    <form onSubmit={handleWriteOffSubmit}>
      <div className="form-row">
        <PlayerSelect label="Player" value={writeOffPlayerId} onChange={(v) => {
          setWriteOffPlayerId(v);
          const p = players.find(pl => String(pl.id) === String(v));
          if (p && Number(p.balance) < 0) setWriteOffAmount(String(Math.abs(Number(p.balance))));
        }} players={players} />
        <div className="form-group">
          <label>Amount (₪) *</label>
          <input type="number" min="0.01" step="0.01" required value={writeOffAmount}
            onChange={e => setWriteOffAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input type="text" value={writeOffNotes} onChange={e => setWriteOffNotes(e.target.value)}
            placeholder="e.g. Played on club cost Apr 5" />
        </div>
      </div>
      <button type="submit" className="btn" style={{ background: '#0e7490', color: '#fff' }}
        disabled={submitting || !writeOffPlayerId}>
        {submitting ? 'Recording...' : '✏️ Record Write-off'}
      </button>
    </form>
  </div>
)}
```

- [ ] **Step 6: Start frontend and manually test both forms**

```bash
cd /c/projects/poker-frontend && pnpm dev
```
- Open Transfers page
- Click "🎁 Chip Promo" → select player, enter 100, notes "test rakeback" → submit
- Click "✏️ Write Off" → select player with negative balance → verify amount pre-fills → submit
- Verify success message both times

- [ ] **Step 7: Commit**

```bash
cd /c/projects/poker-frontend && rtk git add src/pages/Transfers.jsx && rtk git commit -m "feat: add Chip Promo and Write Off forms to Transfers page"
```

---

## Task 7: Expenses tab — Promotions group

**Files:**
- Modify: `poker-frontend/src/pages/AdminExpenses.jsx`

- [ ] **Step 1: Add getPromotions to imports**

Change the import line at the top of `AdminExpenses.jsx`:
```jsx
import { getAdminExpenses, deleteAdminExpense, updateAdminExpense, getPromotions } from '../api';
```

- [ ] **Step 2: Add promotions state**

After `const [expandedAdmins, setExpandedAdmins] = useState({});`, add:
```jsx
const [promotions, setPromotions] = useState(null);
```

- [ ] **Step 3: Fetch promotions in load()**

Change the `load` function to also fetch promotions:
```jsx
const load = () => {
  setLoading(true);
  Promise.all([
    getAdminExpenses(),
    getPromotions(),
  ]).then(([expRes, promoRes]) => {
    setData(expRes.data);
    setPromotions(promoRes.data);
    setLoading(false);
  });
};
```

- [ ] **Step 4: Add Promotions section before the Grand Total card**

Find the final `{admins.length > 0 && ...}` Grand Total card. Before it, add:
```jsx
{/* Promotions group */}
{promotions && (promotions.entries?.length > 0) && (
  <div className="card" style={{ marginBottom: '1rem', borderColor: '#7c3aed' }}>
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      onClick={() => setExpandedAdmins(prev => ({ ...prev, '__promotions': !prev['__promotions'] }))}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <strong style={{ color: '#a78bfa', fontSize: '1.05rem' }}>Promotions</strong>
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
          {promotions.entries.length} {promotions.entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
          Chip promos: <span style={{ color: '#a78bfa' }}>{fmt(promotions.chipPromoTotal)}</span>
          {' · '}
          Write-offs: <span style={{ color: '#ef4444' }}>{fmt(promotions.writeOffTotal)}</span>
        </span>
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
          {expandedAdmins['__promotions'] ? '▲' : '▼'}
        </span>
      </div>
    </div>

    {expandedAdmins['__promotions'] && (
      <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem' }}>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
              <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Player</th>
              <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Type</th>
              <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
              <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {promotions.entries.map(entry => (
              <tr key={entry.id}>
                <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>
                  {entry.transactionDate || '—'}
                </td>
                <td style={{ color: '#e2e8f0' }}>{entry.playerFullName || entry.playerUsername}</td>
                <td>
                  {entry.type === 'CHIP_PROMO'
                    ? <span style={{ fontSize: '0.75rem', background: '#3b1d6b', color: '#a78bfa', borderRadius: '4px', padding: '2px 6px' }}>Chip Promo</span>
                    : <span style={{ fontSize: '0.75rem', background: '#164e63', color: '#22d3ee', borderRadius: '4px', padding: '2px 6px' }}>Write-off</span>
                  }
                </td>
                <td style={{ color: entry.type === 'PROMOTION' ? '#ef4444' : '#a78bfa', fontWeight: 600 }}>
                  {fmt(entry.amount)}
                </td>
                <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Verify in browser**

- Open Admin Expenses tab
- Confirm the new Promotions card appears (after adding test data in Task 6)
- Expand it and verify entries show with correct type badges

- [ ] **Step 6: Commit**

```bash
cd /c/projects/poker-frontend && rtk git add src/pages/AdminExpenses.jsx && rtk git commit -m "feat: add Promotions group to Admin Expenses page"
```

---

## Task 8: Total Profit — Promotions write-off deduction line

**Files:**
- Modify: `poker-frontend/src/pages/TotalProfit.jsx`

- [ ] **Step 1: Read promotionsTotal from summary**

In the All-time calculation block (after the `generalExpenses` line), add:
```jsx
const promotionsTotal = Number(summary?.promotionsTotal || 0);
```

- [ ] **Step 2: Update netProfit calculation**

Change:
```jsx
const netProfit = clubEarning - willExpense - generalExpenses;
```
to:
```jsx
const netProfit = clubEarning - willExpense - generalExpenses - promotionsTotal;
```

- [ ] **Step 3: Add Promotions row in the All-Time P&L table**

Find the "− General Expenses" row in the All-Time P&L table. Add a new row after it:
```jsx
{promotionsTotal > 0 && (
  <tr>
    <td style={{ color: '#94a3b8' }}>− Promotions Write-offs</td>
    <td className="negative"><strong>({fmt(promotionsTotal)})</strong></td>
    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Balance forgiveness (plays on club cost)</td>
  </tr>
)}
```

- [ ] **Step 4: Verify in browser**

- Open Total Profit page
- Confirm the Promotions Write-offs line appears (only if `promotionsTotal > 0`)
- Confirm Net Profit is reduced by the promotions total
- If no write-offs yet, add one via Transfers page and refresh

- [ ] **Step 5: Commit**

```bash
cd /c/projects/poker-frontend && rtk git add src/pages/TotalProfit.jsx && rtk git commit -m "feat: deduct promotion write-offs from All-Time P&L net profit"
```

---

## Task 9: Push to GitHub

- [ ] **Push backend**
```bash
cd /c/projects/tracker && rtk git push
```

- [ ] **Push frontend**
```bash
cd /c/projects/poker-frontend && rtk git push
```
