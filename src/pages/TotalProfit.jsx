import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminExpenses, getBalanceSheet, getPlayers, getPromotions, getProfitSummary, getTransactionRange, getWalletSummary, getAgentTotalBalance } from '../api';
import DateInput from '../components/DateInput';
import { fmtDateTime } from '../utils/dates';

const SOURCE_LABEL = {
  'SCREEN:CREDIT': 'Credit adjustment',
  'SCREEN:MANUAL_BALANCE': 'Manual balance',
  'SCREEN:WHEEL': 'Wheel expense',
};

export default function TotalProfit() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [period, setPeriod] = useState(null);
  const [txRows, setTxRows] = useState([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [showTx, setShowTx] = useState(true);
  const [unpaidExpenses, setUnpaidExpenses] = useState(0);
  const [paidExpenses, setPaidExpenses] = useState(0);
  const [clubWalletTotal, setClubWalletTotal] = useState(null);
  const [expenseData, setExpenseData] = useState(null);
  const [promotionsData, setPromotionsData] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [agentBal, setAgentBal] = useState(null);      // { from, to, totalBalance } — net agent position
  const [agentFrom, setAgentFrom] = useState('');       // starting date (defaults to last התחשבנות)

  const loadAgentBalance = (from) => {
    getAgentTotalBalance(from ? { from } : {})
      .then(r => { setAgentBal(r.data); setAgentFrom(r.data?.from || ''); })
      .catch(() => setAgentBal(null));
  };
  useEffect(() => { loadAgentBalance(); }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (Number(n) < 0 ? '-' : '') + '₪' + abs;
  };

  const cls = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : '';
  const toggle = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    Promise.all([
      getPlayers(),
      getProfitSummary().catch(() => ({ data: null })),
      getAdminExpenses().catch(() => ({ data: null })),
      getWalletSummary().catch(() => ({ data: null })),
      getPromotions().catch(() => ({ data: null })),
    ]).then(([playersRes, summaryRes, expRes, walletRes, promoRes]) => {
      setPlayers(playersRes.data);
      setSummary(summaryRes.data);
      setExpenseData(expRes.data);
      setPromotionsData(promoRes.data);
      const admins = expRes.data?.admins || [];
      const paid = expRes.data?.paid || [];
      setUnpaidExpenses(admins.filter(a => a.adminUsername !== 'Wheel').reduce((s, a) => s + Number(a.total || 0), 0));
      setPaidExpenses(paid.reduce((s, e) => s + Number(e.amount || 0), 0));
      if (walletRes.data?.clubTotal != null) setClubWalletTotal(Number(walletRes.data.clubTotal));
      setLoading(false);
    });
  }, []);

  const loadPeriod = () => {
    if (!fromDate || !toDate) return;
    setPeriodLoading(true);
    Promise.all([
      getBalanceSheet(fromDate, toDate),
      getTransactionRange(fromDate, toDate),
    ]).then(([bsRes, txRes]) => {
      setPeriod(bsRes.data.period);
      setTxRows(txRes.data);
      setPeriodLoading(false);
      setShowTx(true);
    }).catch(() => setPeriodLoading(false));
  };

  const clearPeriod = () => {
    setFromDate('');
    setToDate('');
    setPeriod(null);
    setTxRows([]);
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  // All-time calculation
  const rawCredit = Number(summary?.snapshotCreditTotal || 0);
  const rawChips = players.filter(p => !p.chipsStale).reduce((s, p) => s + Number(p.currentChips || 0), 0);

  // Agents run their own blue/red-chip pool the club does NOT manage, so chips & credit held by a
  // (non-club-managed) agent or one of their players are the agent's liability, not the club's —
  // exclude them from the מאזן. Club-managed agents are handled like normal players, so they stay.
  const agentClubManaged = {};
  players.forEach(p => { if (p.isAgent) agentClubManaged[Number(p.id)] = !!p.clubManaged; });
  const isUnmanagedAgentSide = (p) =>
    (p.isAgent && !p.clubManaged) ||
    (p.agentId != null && !agentClubManaged[Number(p.agentId)]);
  const excludedChips = players
    .filter(p => !p.chipsStale && isUnmanagedAgentSide(p))
    .reduce((s, p) => s + Number(p.currentChips || 0), 0);
  const excludedCredit = players
    .filter(p => isUnmanagedAgentSide(p))
    .reduce((s, p) => s + Number(p.creditTotal || 0), 0);

  const totalCredit = rawCredit - excludedCredit;
  const totalChips = rawChips - excludedChips;
  const willExpense = Number(summary?.willExpense || 0);
  const chipPromoTotal = Number(summary?.chipPromoTotal || 0);
  const bankDeposits = clubWalletTotal !== null ? clubWalletTotal : Number(summary?.bankDeposits || 0);

  // Net agent position (agent POV: + = we owe agents, − = agents owe us). We owe agents → reduces
  // profit; agents owe us → increases it. So the adjustment to Club Earning is −totalBalance.
  const agentTotalBalance = Number(agentBal?.totalBalance || 0);
  const agentAdjustment = -agentTotalBalance;

  // מאזן (net worth): Banks & Players + Credit − Raw chips − agents net = Club Earning.
  // Debts to admins are no longer a separate line — each admin's wallet balance is now NET
  // (cash held minus what the club owes them), so it's already inside bankDeposits (clubTotal).
  // Ticket Assets removed — that mechanism is retired and the tickets were already sold/recorded.
  const clubEarning = bankDeposits + totalCredit - totalChips + agentAdjustment;
  const netProfit = clubEarning;

  // Expense breakdown data
  const admins = expenseData?.admins || [];
  const paid = expenseData?.paid || [];
  const paidTotal = paidExpenses;
  const clubAdmins = admins.filter(a => a.adminUsername !== 'Wheel');
  const wheelAdmin = admins.find(a => a.adminUsername === 'Wheel');
  const wheelTotal = Number(wheelAdmin?.total || 0);
  const chipPromoEntries = promotionsData?.entries?.filter(e => e.type === 'CHIP_PROMO') || [];
  const writeOffEntries = promotionsData?.entries?.filter(e => e.type === 'PROMOTION') || [];
  const writeOffTotal = Number(promotionsData?.writeOffTotal || 0);
  const wheelPromoTotal = willExpense + chipPromoTotal;

  // Group transactions by player for period drill-down
  const txByPlayer = {};
  txRows.forEach(tx => {
    const key = tx.playerId;
    if (!txByPlayer[key]) txByPlayer[key] = { name: tx.playerFullName || tx.playerUsername, username: tx.playerUsername, credits: 0, payments: 0, deposits: 0, wheel: 0, other: 0 };
    const amt = Number(tx.amount);
    if (tx.sourceRef === 'SCREEN:CREDIT') {
      if (tx.type === 'DEPOSIT') txByPlayer[key].credits += amt;
      else txByPlayer[key].payments += amt;
    } else if (tx.type === 'WHEEL_EXPENSE') {
      txByPlayer[key].wheel += amt;
    } else if (tx.type === 'DEPOSIT') {
      txByPlayer[key].deposits += amt;
    } else {
      txByPlayer[key].other += amt;
    }
  });
  const playerSummaries = Object.entries(txByPlayer)
    .map(([playerId, d]) => ({ playerId, ...d, net: d.credits - d.payments + d.deposits - d.wheel }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  return (
    <div>
      <div className="page-header">
        <h1>Balance Sheet</h1>
        {summary?.lastUpdated && (
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Last updated: {fmtDateTime(summary.lastUpdated)}
          </span>
        )}
      </div>

      {/* Date filter bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Period filter:</span>
          <DateInput value={fromDate} onChange={setFromDate} />
          <span style={{ color: '#64748b' }}>→</span>
          <DateInput value={toDate} onChange={setToDate} />
          <button onClick={loadPeriod} disabled={!fromDate || !toDate || periodLoading}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.35rem 1rem', cursor: 'pointer' }}>
            {periodLoading ? 'Loading…' : 'Show Period'}
          </button>
          {period && (
            <button onClick={clearPeriod}
              style={{ background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: '4px', padding: '0.35rem 0.8rem', cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Period P&L */}
      {period && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Period P&L: {period.from} → {period.to}</h2>
          <div className="table-wrap"><table>
            <tbody>
              <tr>
                <td style={{ color: '#94a3b8' }}>Bank Deposits</td>
                <td className="positive"><strong>{fmt(period.deposits)}</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Cash received in period</td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8' }}>+ Net Credit Change</td>
                <td className={cls(period.netCreditChange)}><strong>{fmt(period.netCreditChange)}</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Credits given − repaid</td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8' }}>− Chip Delta</td>
                <td className={cls(-period.chipDelta)}><strong>{period.chipDelta >= 0 ? `(${fmt(period.chipDelta)})` : fmt(-period.chipDelta)}</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                  End {fmt(period.chipsEnd)}{period.chipsEndDate ? ` (${period.chipsEndDate})` : ''} −
                  Start {fmt(period.chipsStart)}{period.chipsStartDate ? ` (${period.chipsStartDate})` : ''}
                </td>
              </tr>
              <tr style={{ borderTop: '2px solid #334155' }}>
                <td><strong style={{ color: '#e2e8f0' }}>= Period Rake</strong></td>
                <td><strong className={cls(period.periodRake)} style={{ fontSize: '1.1rem' }}>{fmt(period.periodRake)}</strong></td>
                <td></td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8', paddingTop: '1rem' }}>− Expenses</td>
                <td className="negative" style={{ paddingTop: '1rem' }}><strong>({fmt(period.expenses)})</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem', paddingTop: '1rem' }}>Admin expenses in period</td>
              </tr>
              <tr style={{ borderTop: '1px solid #334155' }}>
                <td><strong style={{ color: '#e2e8f0' }}>= Net Profit</strong></td>
                <td><strong className={cls(period.netProfit)} style={{ fontSize: '1.2rem' }}>{fmt(period.netProfit)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table></div>
        </div>
      )}

      {/* Period transaction drill-down */}
      {txRows.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Transactions in Period ({txRows.length})</h2>
            <button onClick={() => setShowTx(v => !v)}
              style={{ background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem 0.7rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              {showTx ? 'Hide' : 'Show'}
            </button>
          </div>
          {showTx && (
            <>
              <h3 style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 'normal' }}>BY PLAYER</h3>
              <div className="table-wrap"><table style={{ marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    <th style={{ textAlign: 'left', paddingBottom: '0.4rem' }}>Player</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.4rem' }}>Credit Given</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.4rem' }}>Credit Repaid</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.4rem' }}>Deposits</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.4rem' }}>Wheel</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.4rem' }}>Net Effect</th>
                  </tr>
                </thead>
                <tbody>
                  {playerSummaries.map(p => (
                    <tr key={p.playerId}>
                      <td style={{ color: '#a5b4fc', cursor: 'pointer' }} onClick={() => navigate(`/player/${p.playerId}`)}>{p.name || p.username}</td>
                      <td style={{ textAlign: 'right' }} className={p.credits ? 'positive' : ''}>{p.credits ? fmt(p.credits) : '—'}</td>
                      <td style={{ textAlign: 'right' }} className={p.payments ? 'negative' : ''}>{p.payments ? `(${fmt(p.payments)})` : '—'}</td>
                      <td style={{ textAlign: 'right' }} className={p.deposits ? 'positive' : ''}>{p.deposits ? fmt(p.deposits) : '—'}</td>
                      <td style={{ textAlign: 'right' }} className={p.wheel ? 'negative' : ''}>{p.wheel ? `(${fmt(p.wheel)})` : '—'}</td>
                      <td style={{ textAlign: 'right' }}><strong className={cls(p.net)}>{fmt(p.net)}</strong></td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #334155', fontWeight: 'bold' }}>
                    <td style={{ color: '#e2e8f0' }}>TOTAL</td>
                    <td style={{ textAlign: 'right' }} className="positive">{fmt(playerSummaries.reduce((s, p) => s + p.credits, 0))}</td>
                    <td style={{ textAlign: 'right' }} className="negative">({fmt(playerSummaries.reduce((s, p) => s + p.payments, 0))})</td>
                    <td style={{ textAlign: 'right' }} className="positive">{fmt(playerSummaries.reduce((s, p) => s + p.deposits, 0))}</td>
                    <td style={{ textAlign: 'right' }} className="negative">({fmt(playerSummaries.reduce((s, p) => s + p.wheel, 0))})</td>
                    <td style={{ textAlign: 'right' }}><strong className={cls(playerSummaries.reduce((s, p) => s + p.net, 0))}>{fmt(playerSummaries.reduce((s, p) => s + p.net, 0))}</strong></td>
                  </tr>
                </tbody>
              </table></div>
              <h3 style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 'normal' }}>ALL TRANSACTIONS</h3>
              <div className="table-wrap"><table>
                <thead>
                  <tr style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    <th style={{ textAlign: 'left', paddingBottom: '0.4rem' }}>Date</th>
                    <th style={{ textAlign: 'left', paddingBottom: '0.4rem' }}>Player</th>
                    <th style={{ textAlign: 'left', paddingBottom: '0.4rem' }}>Type</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.4rem' }}>Amount</th>
                    <th style={{ textAlign: 'left', paddingBottom: '0.4rem' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {txRows.map(tx => {
                    const isCredit = tx.sourceRef === 'SCREEN:CREDIT';
                    const isWithdrawal = tx.type === 'WITHDRAWAL';
                    const label = isCredit
                      ? (isWithdrawal ? 'Credit repaid' : 'Credit given')
                      : (SOURCE_LABEL[tx.sourceRef] || tx.type?.toLowerCase());
                    return (
                      <tr key={tx.id}>
                        <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{tx.transactionDate || '—'}</td>
                        <td style={{ color: '#a5b4fc', cursor: 'pointer' }} onClick={() => navigate(`/player/${tx.playerId}`)}>{tx.playerFullName || tx.playerUsername}</td>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{label}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={isWithdrawal ? 'negative' : 'positive'}>
                            {isWithdrawal ? `(${fmt(tx.amount)})` : fmt(tx.amount)}
                          </span>
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{tx.notes || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </>
          )}
        </div>
      )}

      {/* ── All-Time P&L ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2>All-Time P&L</h2>
        <div className="table-wrap"><table>
          <tbody>
            <tr style={{ cursor: 'pointer' }} onClick={() => navigate('/club-wallets')}>
              <td style={{ color: '#94a3b8' }}>בנקים + שחקנים (Banks &amp; Players) <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>↗</span></td>
              <td className="positive"><strong>{fmt(bankDeposits)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Club wallets total</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>+ קרדיטים (Total Credit Given)</td>
              <td className="positive"><strong>{fmt(totalCredit)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Sum of all player credits</td>
            </tr>
            {excludedCredit > 0 && (
              <tr>
                <td style={{ color: '#64748b' }}>&nbsp;&nbsp;<span style={{ fontSize: '0.8rem' }}>↳ excl. {fmt(excludedCredit)} agent-held credit (not club-managed)</span></td>
                <td></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Agents' own pool — not club liability</td>
              </tr>
            )}
            <tr style={{ cursor: 'pointer' }} onClick={() => navigate('/club-wallets')}>
              <td style={{ color: '#64748b' }}>&nbsp;&nbsp;<span style={{ fontSize: '0.8rem' }}>↳ includes לויים (Debts to Admin) {fmt(unpaidExpenses)}, netted into wallets</span></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>No longer subtracted separately — folded into admin balances</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>− ציפים (Total Chips)</td>
              <td className="negative"><strong>({fmt(totalChips)})</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Club-managed chips only</td>
            </tr>
            {excludedChips > 0 && (
              <tr>
                <td style={{ color: '#64748b' }}>&nbsp;&nbsp;<span style={{ fontSize: '0.8rem' }}>↳ excl. {fmt(excludedChips)} agent-held chips (not club-managed)</span></td>
                <td></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{fmt(rawChips)} total − agent pool</td>
              </tr>
            )}
            <tr>
              <td style={{ color: '#94a3b8' }}>
                {agentAdjustment >= 0 ? '+ ' : '− '}סוכנים (Agents net)
                <span style={{ marginLeft: '0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>since</span>
                  <DateInput value={agentFrom} onChange={v => loadAgentBalance(v)} style={{ fontSize: '0.78rem', padding: '2px 6px' }} />
                </span>
              </td>
              <td className={cls(agentAdjustment)}><strong>{agentAdjustment < 0 ? `(${fmt(agentAdjustment)})` : fmt(agentAdjustment)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                {agentTotalBalance > 0 ? `we owe agents ${fmt(agentTotalBalance)} → subtracts` : agentTotalBalance < 0 ? `agents owe us ${fmt(-agentTotalBalance)} → adds` : 'agents settled'}
              </td>
            </tr>
            <tr style={{ borderTop: '2px solid #334155', background: 'rgba(59,130,246,0.07)' }}>
              <td style={{ padding: '0.6rem 0.4rem' }}>
                <strong style={{ color: '#93c5fd', fontSize: '1.05rem' }}>= Club Earning</strong>
              </td>
              <td style={{ padding: '0.6rem 0.4rem' }}>
                <strong className={cls(clubEarning)} style={{ fontSize: '1.25rem' }}>{fmt(clubEarning)}</strong>
              </td>
              <td></td>
            </tr>
          </tbody>
        </table></div>
      </div>

      {/* ── Expenses Breakdown ── */}
      <div style={{ borderTop: '2px solid #334155', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
        <h2 style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Expenses Breakdown
        </h2>

        {/* Per-admin unpaid groups */}
        {clubAdmins.map(admin => (
          <div key={admin.adminUsername} className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => toggle(admin.adminUsername)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>{admin.adminUsername}</strong>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{admin.entries.length} {admin.entries.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{fmt(admin.total)}</strong>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedSections[admin.adminUsername] ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandedSections[admin.adminUsername] && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admin.entries.map(entry => (
                      <tr key={`${entry.type || 'ADMIN_EXPENSE'}-${entry.id}`}>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.expenseDate || '—'}</td>
                        <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                        <td>
                          {entry.sourceRef === 'CLUB_EXPENSE' ? (
                            <span style={{ fontSize: '0.75rem', background: '#3b1f00', color: '#f59e0b', borderRadius: '4px', padding: '2px 6px' }}>Club Expense</span>
                          ) : (entry.sourceRef === 'XLS' || entry.sourceRef?.startsWith('XLS:')) ? (
                            <span style={{ fontSize: '0.75rem', background: '#1e3a5f', color: '#60a5fa', borderRadius: '4px', padding: '2px 6px' }}>XLS</span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', background: '#14532d', color: '#4ade80', borderRadius: '4px', padding: '2px 6px' }}>Manual</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {/* Paid */}
        {paid.length > 0 && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => toggle('__paid')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>✓ Paid</strong>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{paid.length} entries</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{fmt(paidTotal)}</strong>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedSections['__paid'] ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandedSections['__paid'] && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Who</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Description</th>
                      <th style={{ textAlign: 'right', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Paid On</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Paid From</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Paid By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paid.map(e => (
                      <tr key={`${e.entityType}-${e.id}`}>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{e.expenseDate || '—'}</td>
                        <td style={{ color: '#a5b4fc', fontSize: '0.85rem' }}>{e.who || '—'}</td>
                        <td style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{e.notes || '—'}</td>
                        <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(e.amount)}</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{e.settledAt || '—'}</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{e.paidFromAdminUsername || '—'}</td>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{e.settledBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Grand Total Expenses */}
        {(clubAdmins.length > 0 || paid.length > 0) && (
          <div className="card" style={{ borderTopColor: '#ef4444', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => toggle('__grandtotal')}>
              <strong style={{ color: '#e2e8f0' }}>Grand Total Expenses</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <strong style={{ color: '#ef4444', fontSize: '1.2rem' }}>{fmt(unpaidExpenses + paidTotal)}</strong>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedSections['__grandtotal'] ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandedSections['__grandtotal'] && (
              <div style={{ marginTop: '0.75rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem' }}>
                <table style={{ width: '100%' }}>
                  <tbody>
                    {clubAdmins.map(a => (
                      <tr key={a.adminUsername}>
                        <td style={{ color: '#94a3b8', padding: '0.2rem 0' }}>{a.adminUsername}</td>
                        <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(a.total)}</td>
                      </tr>
                    ))}
                    {paidTotal > 0 && (
                      <tr>
                        <td style={{ color: '#94a3b8', padding: '0.2rem 0' }}>✓ Paid</td>
                        <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(paidTotal)}</td>
                      </tr>
                    )}
                    <tr style={{ borderTop: '1px solid #334155' }}>
                      <td style={{ color: '#e2e8f0', fontWeight: 700, paddingTop: '0.4rem' }}>Total</td>
                      <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 700, fontSize: '1.05rem', paddingTop: '0.4rem' }}>{fmt(unpaidExpenses + paidTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Wheel & Rakeback */}
        {(wheelAdmin?.entries?.length > 0 || chipPromoEntries.length > 0) && (
          <div className="card" style={{ marginBottom: '1rem', borderColor: '#d97706', opacity: 0.85 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => toggle('__wheelpromo')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <strong style={{ color: '#fbbf24', fontSize: '1.05rem' }}>🎡 Wheel &amp; Rakeback</strong>
                <span style={{ fontSize: '0.72rem', background: '#3b2a00', color: '#fbbf24', borderRadius: '4px', padding: '2px 7px' }}>chips only</span>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{(wheelAdmin?.entries?.length || 0) + chipPromoEntries.length} entries</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                  Wheel: <span style={{ color: '#fb923c' }}>{fmt(wheelTotal)}</span>
                  {' · '}
                  Rakeback: <span style={{ color: '#fbbf24' }}>{fmt(chipPromoTotal)}</span>
                </span>
                <strong style={{ color: '#f59e0b', fontSize: '1.1rem' }}>{fmt(wheelPromoTotal)}</strong>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedSections['__wheelpromo'] ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandedSections['__wheelpromo'] && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Player / Source</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Type</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(wheelAdmin?.entries || []).map(entry => (
                      <tr key={`wheel-${entry.id}`}>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.expenseDate || '—'}</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>—</td>
                        <td><span style={{ fontSize: '0.75rem', background: '#431407', color: '#fb923c', borderRadius: '4px', padding: '2px 6px' }}>Wheel</span></td>
                        <td style={{ color: '#fb923c', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                      </tr>
                    ))}
                    {chipPromoEntries.map(entry => (
                      <tr key={`chip-${entry.id}`}>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.transactionDate || '—'}</td>
                        <td style={{ color: '#e2e8f0' }}>{entry.playerFullName || entry.playerUsername}</td>
                        <td><span style={{ fontSize: '0.75rem', background: '#3b2a00', color: '#fbbf24', borderRadius: '4px', padding: '2px 6px' }}>Rakeback</span></td>
                        <td style={{ color: '#fbbf24', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Write-offs */}
        {writeOffEntries.length > 0 && (
          <div className="card" style={{ marginBottom: '1rem', borderColor: '#0891b2', opacity: 0.85 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => toggle('__writeoffs')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <strong style={{ color: '#22d3ee', fontSize: '1.05rem' }}>✏️ Write-offs</strong>
                <span style={{ fontSize: '0.72rem', background: '#0c2232', color: '#22d3ee', borderRadius: '4px', padding: '2px 7px' }}>chips only</span>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{writeOffEntries.length} entries</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <strong style={{ color: '#22d3ee', fontSize: '1.1rem' }}>{fmt(writeOffTotal)}</strong>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedSections['__writeoffs'] ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandedSections['__writeoffs'] && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Player</th>
                      <th style={{ textAlign: 'right', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {writeOffEntries.map(entry => (
                      <tr key={entry.id}>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.transactionDate || '—'}</td>
                        <td style={{ color: '#e2e8f0' }}>{entry.playerFullName || entry.playerUsername}</td>
                        <td style={{ textAlign: 'right', color: '#22d3ee', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
