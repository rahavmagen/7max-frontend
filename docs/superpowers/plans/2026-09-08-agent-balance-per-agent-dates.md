# Agent Balance Per-Agent Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each agent's "period" reporting figures (Agent Rake, P&L, payments, games) default to that agent's own last-reconciliation date instead of one shared global date, add the missing payment-date input, and show which date a displayed balance is anchored to.

**Architecture:** One new small, unit-tested helper in `AgentService.java` (`resolveAgentReportingFrom`) resolves the effective "from" date per agent — an explicit caller date always wins; otherwise it's that agent's own latest `OPENING` ledger entry date, falling back to the existing global last-settlement-date only when the agent has never had an opening entry. Both `getAllAgentsSummary` and `getAgentBalance` call it instead of using the raw `from` parameter directly. On the frontend, the page simply stops forcing a global default date into the filter at mount, and three small UI additions round it out: a payment-date field, and a small "as of" date label next to each displayed balance.

**Tech Stack:** Spring Boot / JPA (backend, Java 21, JUnit 5 + Mockito + AssertJ), React 19 + Vite (frontend). No schema changes.

---

### Task 1: Backend — add and test `resolveAgentReportingFrom`

**Files:**
- Modify: `C:\projects\tracker\src\main\java\com\sevenmax\tracker\service\AgentService.java`
- Test: `C:\projects\tracker\src\test\java\com\sevenmax\tracker\service\AgentServiceTest.java`

- [ ] **Step 1: Write the failing tests**

Add to `AgentServiceTest.java` (imports go at the top with the existing ones):

```java
import com.sevenmax.tracker.entity.AgentLedgerEntry;
import com.sevenmax.tracker.entity.LastSettlementDate;
import com.sevenmax.tracker.repository.AgentLedgerEntryRepository;
import com.sevenmax.tracker.repository.LastSettlementDateRepository;
import java.time.LocalDate;
import java.util.Optional;
```

Add `@Mock` fields alongside the existing `playerRepository` one, and pass them into the constructor call in `setUp()` at the correct positions (the constructor order is `playerRepository, gameResultRepository, agentSettlementRepository, adminExpenseRepository, transactionRepository, agentLedgerEntryRepository, lastSettlementDateRepository, liveTicketRepository`):

```java
@Mock PlayerRepository playerRepository;
@Mock AgentLedgerEntryRepository agentLedgerEntryRepository;
@Mock LastSettlementDateRepository lastSettlementDateRepository;

AgentService agentService;

@BeforeEach
void setUp() {
    agentService = new AgentService(
        playerRepository, null, null, null, null,
        agentLedgerEntryRepository, lastSettlementDateRepository, null
    );
}
```

Add these test methods:

```java
@Test
void resolveAgentReportingFrom_explicitCallerDate_alwaysWins() {
    LocalDate callerFrom = LocalDate.of(2026, 3, 1);

    LocalDate result = agentService.resolveAgentReportingFrom(1L, callerFrom);

    assertThat(result).isEqualTo(callerFrom);
}

@Test
void resolveAgentReportingFrom_noCallerDate_usesAgentsOwnLatestOpeningDate() {
    AgentLedgerEntry opening = new AgentLedgerEntry();
    opening.setEffectiveDate(LocalDate.of(2026, 1, 10));
    when(agentLedgerEntryRepository.findByAgentIdAndType(1L, AgentLedgerEntry.Type.OPENING))
        .thenReturn(List.of(opening));

    LocalDate result = agentService.resolveAgentReportingFrom(1L, null);

    assertThat(result).isEqualTo(LocalDate.of(2026, 1, 10));
}

@Test
void resolveAgentReportingFrom_noCallerDateAndNoOpeningEntry_fallsBackToGlobalDate() {
    when(agentLedgerEntryRepository.findByAgentIdAndType(1L, AgentLedgerEntry.Type.OPENING))
        .thenReturn(List.of());
    LastSettlementDate global = new LastSettlementDate();
    global.setDate(LocalDate.of(2026, 2, 1));
    when(lastSettlementDateRepository.findById(1L)).thenReturn(Optional.of(global));

    LocalDate result = agentService.resolveAgentReportingFrom(1L, null);

    assertThat(result).isEqualTo(LocalDate.of(2026, 2, 1));
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /c/projects/tracker && ./mvnw test -Dtest=AgentServiceTest`
Expected: compile error — `resolveAgentReportingFrom` does not exist on `AgentService`.

- [ ] **Step 3: Implement the helper**

In `AgentService.java`, add this method right after `latestOpening` (currently around line 692, just above the `computeCurrentBalance` javadoc):

```java
    /** Resolves the "from" date for an agent's period figures: an explicit caller date always
     *  wins; with none, each agent defaults to THEIR OWN latest OPENING entry date (so agents
     *  reconciled on different days don't get folded into one shared cutoff), falling back to
     *  the club-wide last settlement date only for an agent that has never had an OPENING entry. */
    LocalDate resolveAgentReportingFrom(Long agentId, LocalDate callerFrom) {
        if (callerFrom != null) return callerFrom;
        AgentLedgerEntry opening = latestOpening(agentId);
        if (opening != null) return opening.getEffectiveDate();
        return getLastSettlementDate();
    }
```

(Package-private, not `private`, so the test above — same package — can call it directly.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /c/projects/tracker && ./mvnw test -Dtest=AgentServiceTest`
Expected: all 7 tests pass (4 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
cd /c/projects/tracker
git add src/main/java/com/sevenmax/tracker/service/AgentService.java src/test/java/com/sevenmax/tracker/service/AgentServiceTest.java
git commit -m "Add resolveAgentReportingFrom helper for per-agent default report dates"
```

---

### Task 2: Backend — wire the helper into the two summary methods

**Files:**
- Modify: `C:\projects\tracker\src\main\java\com\sevenmax\tracker\service\AgentService.java`

- [ ] **Step 1: Wire into `getAllAgentsSummary`**

Find this block (around line 199-208):

```java
                final Long agentId = agent.getId();
                List<GameResult> allResultsForBalance = agentAndOwnResults(agentId);
                List<GameResult> results = allResultsForBalance.stream()
                    .filter(gr -> {
                        LocalDate d = gr.getSession().getStartTime().toLocalDate();
                        if (from != null && d.isBefore(from)) return false;
                        if (to != null && d.isAfter(to)) return false;
                        return true;
                    })
                    .collect(Collectors.toList());
```

Replace with:

```java
                final Long agentId = agent.getId();
                final LocalDate effectiveFrom = resolveAgentReportingFrom(agentId, from);
                List<GameResult> allResultsForBalance = agentAndOwnResults(agentId);
                List<GameResult> results = allResultsForBalance.stream()
                    .filter(gr -> {
                        LocalDate d = gr.getSession().getStartTime().toLocalDate();
                        if (effectiveFrom != null && d.isBefore(effectiveFrom)) return false;
                        if (to != null && d.isAfter(to)) return false;
                        return true;
                    })
                    .collect(Collectors.toList());
```

Then find the payments filter (around line 277-280):

```java
                BigDecimal pmts = agentLedgerEntryRepository
                    .findByAgentIdAndType(agentId, AgentLedgerEntry.Type.PAYMENT).stream()
                    .filter(e -> inRange(e.getEffectiveDate(), from, to))
                    .map(AgentLedgerEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
```

Replace `from` with `effectiveFrom`:

```java
                BigDecimal pmts = agentLedgerEntryRepository
                    .findByAgentIdAndType(agentId, AgentLedgerEntry.Type.PAYMENT).stream()
                    .filter(e -> inRange(e.getEffectiveDate(), effectiveFrom, to))
                    .map(AgentLedgerEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
```

Do **not** touch `computeCurrentBalance(agent, openingE, allResultsForBalance)` a few lines below — it already ignores `from`/`to` entirely and must keep doing so.

- [ ] **Step 2: Wire into `getAgentBalance`**

Find this line (around line 737):

```java
        final LocalDate accrualFrom = from != null ? from : getLastSettlementDate();
```

Replace with:

```java
        final LocalDate accrualFrom = resolveAgentReportingFrom(agentId, from);
```

- [ ] **Step 3: Run the full backend test suite**

Run: `cd /c/projects/tracker && ./mvnw test`
Expected: BUILD SUCCESS, no failures.

- [ ] **Step 4: Commit**

```bash
cd /c/projects/tracker
git add src/main/java/com/sevenmax/tracker/service/AgentService.java
git commit -m "Use per-agent reporting date default in getAllAgentsSummary and getAgentBalance"
```

---

### Task 3: Frontend — stop forcing one global default date; fix the period label

**Files:**
- Modify: `C:\projects\poker-frontend\src\pages\Agents.jsx`

- [ ] **Step 1: Stop auto-applying the global date at mount**

Find (around line 211-219):

```jsx
  useEffect(() => {
    getLastSettlementDate()
      .then(r => {
        const d = r.data?.date || '';
        if (d) { setSummaryFrom(d); setDefaultedFrom(d); load(d, ''); }
        else load('', '');
      })
      .catch(() => load('', ''));
  }, []);
```

Replace with:

```jsx
  useEffect(() => {
    getLastSettlementDate()
      .then(r => setDefaultedFrom(r.data?.date || ''))
      .catch(() => {});
    load('', '');
  }, []);
```

This still fetches and remembers the global date (for the label/editor below) but no longer forces it into `summaryFrom`, and the table loads with no `from` at all — letting the backend apply each agent's own default.

- [ ] **Step 2: Update the period label wording**

Find (around line 584-589):

```jsx
      <div style={{ marginTop: '-0.75rem', marginBottom: '1rem', color: '#94a3b8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span>
          Rake &amp; P&amp;L period: <strong style={{ color: '#e2e8f0' }}>{summaryFrom ? fmtDateOnly(summaryFrom) : 'start'} – {summaryTo ? fmtDateOnly(summaryTo) : 'today'}</strong>
          {summaryFrom && summaryFrom === defaultedFrom && <span style={{ color: '#a78bfa', marginLeft: '0.5rem' }}>(since last התחשבנות)</span>}
          <span style={{ color: '#64748b', marginLeft: '0.75rem' }}>· amounts are from the agent's point of view (+ green = we owe agent, − red = agent owes us)</span>
        </span>
```

Replace with:

```jsx
      <div style={{ marginTop: '-0.75rem', marginBottom: '1rem', color: '#94a3b8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span>
          Rake &amp; P&amp;L period: <strong style={{ color: '#e2e8f0' }}>
            {(summaryFrom || summaryTo) ? `${summaryFrom ? fmtDateOnly(summaryFrom) : 'start'} – ${summaryTo ? fmtDateOnly(summaryTo) : 'today'}` : "each agent's own last settlement"}
          </strong>
          <span style={{ color: '#64748b', marginLeft: '0.75rem' }}>· amounts are from the agent's point of view (+ green = we owe agent, − red = agent owes us)</span>
        </span>
```

(The `(since last התחשבנות)` note is dropped here since `summaryFrom` is no longer auto-set to that date — it's still shown in the editor next to this label, unchanged.)

- [ ] **Step 3: Build and check for errors**

Run: `cd /c/projects/poker-frontend && npm run build`
Expected: build succeeds with no new errors.

- [ ] **Step 4: Commit**

```bash
cd /c/projects/poker-frontend
git add src/pages/Agents.jsx
git commit -m "Stop forcing one global default date onto all agents; update period label"
```

---

### Task 4: Frontend — payment date field (and a way to actually open the form)

**Files:**
- Modify: `C:\projects\poker-frontend\src\pages\Agents.jsx`

There is currently **no button anywhere that opens the payment form** — `paymentForm` is only ever set to `null` in the whole file, never to a real object. The form JSX at line 1056 (`{paymentForm && (...)}`) is dead code today; all real payments currently go through the separate "Settle" modal. This step adds the missing trigger alongside fixing the date.

- [ ] **Step 1: Add a "Log payment" trigger button that opens the form with today's date pre-filled**

Find (around line 1015-1020):

```jsx
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => { setOpeningForm(openingForm ? null : { amount: '', effectiveDate: '', notes: '' }); setPaymentForm(null); }}
                  style={{ ...inputStyle, cursor: 'pointer', color: '#a78bfa', fontWeight: 600 }}>Set starting balance</button>
                <button onClick={() => openSettle(selected)}
                  style={{ ...inputStyle, cursor: 'pointer', color: '#4ade80', fontWeight: 600 }}>Settle</button>
              </div>
```

Replace with:

```jsx
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => { setOpeningForm(openingForm ? null : { amount: '', effectiveDate: '', notes: '' }); setPaymentForm(null); }}
                  style={{ ...inputStyle, cursor: 'pointer', color: '#a78bfa', fontWeight: 600 }}>Set starting balance</button>
                <button onClick={() => { setPaymentForm(paymentForm ? null : { amount: '', effectiveDate: new Date().toISOString().slice(0, 10), notes: '' }); setOpeningForm(null); }}
                  style={{ ...inputStyle, cursor: 'pointer', color: '#38bdf8', fontWeight: 600 }}>Log payment</button>
                <button onClick={() => openSettle(selected)}
                  style={{ ...inputStyle, cursor: 'pointer', color: '#4ade80', fontWeight: 600 }}>Settle</button>
              </div>
```

- [ ] **Step 2: Add the DateInput to the payment form JSX**

Find (around line 1056-1070):

```jsx
            {paymentForm && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#12151f', borderRadius: '6px' }}>
                <div style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Enter the amount paid. Put a <strong>minus (−)</strong> if the <strong>agent paid you</strong>. Logged with today's date ({fmtDateOnly(new Date().toISOString())}).
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div><div style={{ color: '#64748b', fontSize: '0.75rem' }}>Amount (+ we paid agent, − agent paid us)</div>
                    <input type="number" step="0.01" value={paymentForm.amount} autoFocus
                      onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, width: 200 }} /></div>
                  <div style={{ flex: 1, minWidth: 140 }}><div style={{ color: '#64748b', fontSize: '0.75rem' }}>Note</div>
                    <input value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></div>
                  <button onClick={submitPayment} disabled={ledgerSaving}
                    style={{ padding: '6px 14px', borderRadius: 5, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{ledgerSaving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            )}
```

Replace with:

```jsx
            {paymentForm && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#12151f', borderRadius: '6px' }}>
                <div style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Enter the amount paid. Put a <strong>minus (−)</strong> if the <strong>agent paid you</strong>.
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div><div style={{ color: '#64748b', fontSize: '0.75rem' }}>Amount (+ we paid agent, − agent paid us)</div>
                    <input type="number" step="0.01" value={paymentForm.amount} autoFocus
                      onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, width: 200 }} /></div>
                  <div><div style={{ color: '#64748b', fontSize: '0.75rem' }}>Date</div>
                    <DateInput value={paymentForm.effectiveDate} onChange={v => setPaymentForm(f => ({ ...f, effectiveDate: v }))} style={inputStyle} /></div>
                  <div style={{ flex: 1, minWidth: 140 }}><div style={{ color: '#64748b', fontSize: '0.75rem' }}>Note</div>
                    <input value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></div>
                  <button onClick={submitPayment} disabled={ledgerSaving}
                    style={{ padding: '6px 14px', borderRadius: 5, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{ledgerSaving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            )}
```

- [ ] **Step 3: Send the date in `submitPayment`**

Find (around line 165-173):

```jsx
  const submitPayment = () => {
    const amt = parseFloat(paymentForm?.amount); // + = we paid agent, − = agent paid us; dated today
    if (isNaN(amt) || amt === 0) { setMsg({ type: 'error', text: 'Enter an amount (− if the agent paid you)' }); return; }
    setLedgerSaving(true);
    addAgentPayment(selected.id, { amount: amt, notes: paymentForm.notes || null })
      .then(r => { setBalance(r.data); setPaymentForm(null); loadBalance(selected.id, filterFrom, filterTo); load(); })
      .catch(e => setMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to log payment' }))
      .finally(() => setLedgerSaving(false));
  };
```

Replace with:

```jsx
  const submitPayment = () => {
    const amt = parseFloat(paymentForm?.amount); // + = we paid agent, − = agent paid us
    if (isNaN(amt) || amt === 0) { setMsg({ type: 'error', text: 'Enter an amount (− if the agent paid you)' }); return; }
    setLedgerSaving(true);
    addAgentPayment(selected.id, { amount: amt, effectiveDate: paymentForm.effectiveDate || undefined, notes: paymentForm.notes || null })
      .then(r => { setBalance(r.data); setPaymentForm(null); loadBalance(selected.id, filterFrom, filterTo); load(); })
      .catch(e => setMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to log payment' }))
      .finally(() => setLedgerSaving(false));
  };
```

- [ ] **Step 4: Build and check for errors**

Run: `cd /c/projects/poker-frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /c/projects/poker-frontend
git add src/pages/Agents.jsx
git commit -m "Add editable payment date, defaulting to today"
```

---

### Task 5: Frontend — show the balance's anchor date

**Files:**
- Modify: `C:\projects\poker-frontend\src\pages\Agents.jsx`

- [ ] **Step 1: Add the date label under the table's Current Balance cell**

Find (around line 770-773):

```jsx
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: '1.02rem' }} className={balanceClass(a.currentBalance)}
                  title={Number(a.currentBalance) > 0 ? 'We owe the agent' : Number(a.currentBalance) < 0 ? 'The agent owes us' : 'Settled'}>
                  {fmt(a.currentBalance)}
                </td>
```

Replace with:

```jsx
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: '1.02rem' }} className={balanceClass(a.currentBalance)}
                  title={Number(a.currentBalance) > 0 ? 'We owe the agent' : Number(a.currentBalance) < 0 ? 'The agent owes us' : 'Settled'}>
                  {fmt(a.currentBalance)}
                  {a.openingDate && (
                    <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 400, color: '#64748b' }}>as of {fmtDateOnly(a.openingDate)}</span>
                  )}
                </td>
```

- [ ] **Step 2: Add the same label to the per-agent detail panel**

Find (around line 1005-1009):

```jsx
              <div>
                <strong style={{ color: '#e2e8f0' }}>Current Balance</strong>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.25rem' }} className={balanceClass(balance?.currentBalance)}>
                  {fmt(balance?.currentBalance)}
                </div>
```

Replace with:

```jsx
              <div>
                <strong style={{ color: '#e2e8f0' }}>Current Balance</strong>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.25rem' }} className={balanceClass(balance?.currentBalance)}>
                  {fmt(balance?.currentBalance)}
                </div>
                {balance?.openingDate && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>as of {fmtDateOnly(balance.openingDate)}</div>
                )}
```

(Note: the `{` opened here is already closed by the existing `</div>` that follows a few lines down for this block — no structural change needed beyond inserting this new sibling `<div>`.)

- [ ] **Step 3: Build and check for errors**

Run: `cd /c/projects/poker-frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /c/projects/poker-frontend
git add src/pages/Agents.jsx
git commit -m "Show each balance's anchor date (as of last opening/settlement)"
```

---

### Task 6: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start both apps locally**

```bash
cd /c/projects/tracker && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local &
cd /c/projects/poker-frontend && npm run dev &
```

Wait for backend log line `Started Application in`, and for `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173` to return `200`.

- [ ] **Step 2: Log in and open the Agents page**

Log in as `admin` / `admin123` (seeded local dev user), navigate to `/agents`.

- [ ] **Step 3: Verify per-agent default dates**

With no date filter applied, confirm: two agents with different last-opening dates show DIFFERENT "as of" dates under their Current Balance, and their period columns (Agent Rake, P&L) reflect activity since each one's own date — not one shared date.

- [ ] **Step 4: Verify explicit filter still applies uniformly**

Pick a From/To range in the page filter, click Apply. Confirm all agents' period columns now use that SAME range (existing behavior, unchanged), while Current Balance and its "as of" label stay exactly as before (unaffected by the filter — this is intentional).

- [ ] **Step 5: Verify the payment date field**

Open an agent's detail panel, click the payment-logging control, confirm a date field appears defaulting to today, change it to a past date, save, and confirm the new ledger entry shows that date (not today) in the ledger history list.

- [ ] **Step 6: Check the browser console and stop the servers**

Confirm no new console errors, then:

```bash
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
lsof -ti:8080 -sTCP:LISTEN | xargs -r kill
```
