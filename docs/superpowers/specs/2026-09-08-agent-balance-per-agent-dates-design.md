# Per-agent settlement dates for agent balance display

## Problem

The Agents page shows each agent's "period" figures (Agent Rake, P&L, payments,
game count) computed from one shared global date (`last_settlement_date`,
a singleton). In practice, agents get reconciled ("התחשבנות") on different
days — agent A on the 10th, agent B on the 15th — so showing both from the
same global date either double-counts already-settled activity or omits
recent activity, depending on which agent you're looking at.

## Current state (verified in code, 2026-09-08)

Already working, no change needed:
- **Opening balance** — `AgentLedgerEntry.OPENING`, with `effectiveDate`, full
  UI (form + `DateInput`) and backend endpoint.
- **Agent-to-agent transfer** — the "Settle" modal already detects when the
  chosen counterparty is itself an agent and updates both ledgers with
  opposite signs (`submitSettle` in `Agents.jsx`).
- **`currentBalance`** — already correctly anchored, per agent, to that
  agent's own latest `OPENING` entry date (`computeCurrentBalance` in
  `AgentService.java`), never the global date. This does not change.
- **`settleAgent()`** auto-creates a fresh `OPENING` entry dated
  `LocalDate.now()` (the day Settle is clicked) whenever an agent is settled
  — so in practice this date already *is* "the last reconciliation day" in
  the everyday sense, even though it lives on the ledger entry, not on the
  separate `AgentSettlement.toDate` field (which is the last *game* day
  covered, not the settle-click day, and is a few days earlier in general).

Real gaps:
- **Payment date** — `paymentForm` state has an `effectiveDate` field, but
  no `DateInput` renders it and `submitPayment()` never sends it. Every
  payment silently lands on today's date.
- **Period columns use one global date for every agent** — this is the core
  fix below.

## Design

### Backend (`AgentService.java`)

In `getAllAgentsSummary(from, to)` and `getAgentBalance(id, from, to)`: when
the caller passes no explicit `from`, resolve it **per agent** as that
agent's latest `OPENING` entry's `effectiveDate`, falling back to the
existing global `getLastSettlementDate()` only for an agent that has never
had an `OPENING` entry created (brand new, never settled or manually opened).
When the caller *does* pass an explicit `from` (the page's Apply-gated date
filter), it applies uniformly to every agent exactly as today — no per-agent
override once the admin has deliberately chosen a range.

`currentBalance`'s own anchoring is untouched — it already worked this way.

The payment endpoint already accepts `effectiveDate` in the request body
(`AgentController.addLedger`); no backend change needed there.

### Frontend (`Agents.jsx`)

1. Stop auto-setting `summaryFrom` to the global last-settlement-date at
   mount. Leave the page-level filter blank by default so the backend
   applies each agent's own anchor. The global date is still fetched and
   shown in the explanatory label / manual-override editor.
2. The per-agent detail panel inherits this for free (it seeds
   `filterFrom`/`filterTo` from `summaryFrom`/`summaryTo`).
3. The existing **Clear** button naturally changes meaning from "show
   all-time" to "return to each agent's own default" — no code change, just
   a semantic improvement.
4. Add a `DateInput` to the payment form (same pattern as the opening-balance
   form), defaulting to today, editable. `submitPayment` sends `effectiveDate`.
5. Next to/under the **Balance** column, show a small date label: "נכון
   החל מ-{date}" — that agent's own `openingDate` (the date their balance is
   anchored to), so it's always visible which reconciliation date a given
   balance reflects. This applies whether the page is showing per-agent
   defaults or an explicit uniform filter.

### Out of scope

- No schema changes (`openingDate` per agent already exists via
  `AgentLedgerEntry.OPENING`; no new "last settlement date" table needed).
- No change to how Settle or opening-balance entry work internally.
- No change to `currentBalance`'s computation.

## Resolved design questions

- **Which per-agent date anchors the default period?** The latest `OPENING`
  entry's date (not the raw `AgentSettlement.toDate`, which would
  double-count — see "Current state" above).
- **Does an explicit page-level filter override per-agent?** Yes, uniformly,
  once Apply is clicked.
- **Include the payment-date UI fix in this batch?** Yes, default today,
  editable.
- **Fallback for agents with no `OPENING` entry at all?** The existing
  global `last_settlement_date`.
- **Balance date visibility?** Small label next to the Balance column
  showing that agent's own anchor date.
