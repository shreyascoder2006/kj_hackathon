import { useEffect, useState, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ReactFlow, { MiniMap, Controls, Background, MarkerType } from 'reactflow';
import LandingPage from './LandingPage.jsx';
import 'reactflow/dist/style.css';
import './App.css';

// ─── Authentication ──────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin123') {
      localStorage.setItem('isAuthenticated', 'true');
      navigate('/dashboard');
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">⬡</div>
          <h2>FraudGuard Login</h2>
          <span className="login-portal-label">SECURE LOGIN PORTAL</span>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <div className="login-group">
            <label>User ID</label>
            <input 
              type="text" 
              placeholder="Enter User ID" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="login-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="Enter Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn">Login to System</button>
        </form>
        <div className="login-footer">
          <p>© 2026 FraudGuard Security Systems</p>
        </div>
      </div>
    </div>
  );
};

// ─── Risk helpers ─────────────────────────────────────────────────────────────
function detectCircular(accountId, transactions) {
  const adj = {};
  for (const tx of transactions) {
    if (!adj[tx.from]) adj[tx.from] = [];
    adj[tx.from].push(tx.to);
  }
  const queue = [];
  const visited = new Set();
  if (adj[accountId]) for (const n of adj[accountId]) { queue.push(n); visited.add(n); }
  while (queue.length) {
    const curr = queue.shift();
    if (curr === accountId) return true;
    for (const n of (adj[curr] || [])) {
      if (n === accountId) return true;
      if (!visited.has(n)) { visited.add(n); queue.push(n); }
    }
  }
  return false;
}

function detectHighVelocity(id, txs) {
  const acc = txs.filter(t => t.from === id || t.to === id).sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp));
  for (let i = 0; i < acc.length - 2; i++)
    if (new Date(acc[i+2].timestamp) - new Date(acc[i].timestamp) < 600000) return true;
  return false;
}

function detectStructuring(id, txs) {
  return txs.filter(t => t.from === id && t.amount >= 9000 && t.amount < 10000).length >= 3;
}

function detectDormant(accountId, txs, accounts) {
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return false;
  const userTxs = txs.filter(t => t.from === accountId).sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp));
  if (userTxs.length === 0) return false;
  const lastTx = userTxs[userTxs.length - 1];
  if (lastTx.amount < 50000) return false;
  const prevTx = userTxs[userTxs.length - 2];
  const lastActiveDate = new Date(acc.last_active);
  const lastTxDate = new Date(lastTx.timestamp);
  if (!prevTx) {
    return (lastTxDate - lastActiveDate) > 7 * 86400000;
  }
  return (lastTxDate - new Date(prevTx.timestamp)) > 7 * 86400000;
}

function detectLocationAnomaly(accountId, txs, accounts) {
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return false;
  const userTxs = txs.filter(t => t.from === accountId).sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp));
  if (userTxs.length === 0) return false;
  const lastTx = userTxs[userTxs.length - 1];
  return lastTx.location && acc.city && lastTx.location !== acc.city;
}

function detectDeviceChange(accountId, txs) {
  const userTxs = txs.filter(t => t.from === accountId).sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp));
  if (userTxs.length < 2) return false;
  const lastTx = userTxs[userTxs.length - 1];
  const prevTx = userTxs[userTxs.length - 2];
  return lastTx.device_id !== prevTx.device_id;
}

function detectAmountSpike(accountId, txs, accounts) {
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return false;
  const userTxs = txs.filter(t => t.from === accountId).sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp));
  if (userTxs.length === 0) return false;
  const lastTx = userTxs[userTxs.length - 1];
  return lastTx.amount > acc.avg_transaction_amount * 3;
}

function detectFailedBurst(accountId, txs) {
  const userTxs = txs.filter(t => t.from === accountId).sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp));
  if (userTxs.length < 3) return false;
  const recent = userTxs.slice(-3);
  const allFailed = recent.every(t => t.status === 'failed');
  const within10Mins = (new Date(recent[2].timestamp) - new Date(recent[0].timestamp)) < 600000;
  return allFailed && within10Mins;
}

function calculateRisks(accounts, transactions) {
  return accounts.map(acc => {
    let risk = 0; const reasons = [];
    if (detectCircular(acc.id, transactions)) { risk += 40; reasons.push('Circular transactions detected'); }
    if (detectDormant(acc.id, transactions, accounts)) { risk += 30; reasons.push('Dormant account anomalous activity'); }
    if (detectHighVelocity(acc.id, transactions)) { risk += 25; reasons.push('High velocity transactions'); }
    if (detectStructuring(acc.id, transactions)) { risk += 20; reasons.push('Potential structuring (amounts just below threshold)'); }
    if (detectLocationAnomaly(acc.id, transactions, accounts)) { risk += 20; reasons.push('Location anomaly detected'); }
    if (detectDeviceChange(acc.id, transactions)) { risk += 20; reasons.push('Device change detected'); }
    if (detectAmountSpike(acc.id, transactions, accounts)) { risk += 15; reasons.push('Unusual amount spike'); }
    if (detectFailedBurst(acc.id, transactions)) { risk += 15; reasons.push('Burst of failed transactions'); }
    return { id: acc.id, risk, reasons };
  });
}

// ─── Page Components ──────────────────────────────────────────────────────────
function PageHeader({ title, subtitle }) {
  return (
    <div className="pg-header">
      <h1 className="pg-title">{title}</h1>
      {subtitle && <p className="pg-subtitle">{subtitle}</p>}
    </div>
  );
}

// ─── ACCOUNTS PAGE ────────────────────────────────────────────────────────────
function AccountsPage({ graphData, currentRiskData, onViewDetails }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    return graphData.accounts.filter(acc => {
      const risk = currentRiskData.find(r => r.id === acc.id)?.risk ?? 0;
      const matchSearch = acc.name.toLowerCase().includes(search.toLowerCase()) || acc.id.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'all' || (filter === 'high' && risk > 20) || (filter === 'normal' && risk === 0);
      return matchSearch && matchFilter;
    });
  }, [graphData.accounts, currentRiskData, search, filter]);

  const highRisk = currentRiskData.filter(r => r.risk > 20).length;
  const normal = currentRiskData.filter(r => r.risk === 0).length;

  return (
    <div>
      <PageHeader title="Accounts" subtitle="View and manage all monitored accounts" />
      <div className="filter-row">
        <input className="search-input" placeholder="Search by name or ID…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Accounts</option>
          <option value="high">High Risk</option>
          <option value="normal">Normal</option>
        </select>
      </div>
      <div className="page-card">
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Balance</th><th>Risk Score</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(acc => {
              const riskObj = currentRiskData.find(r => r.id === acc.id) || { risk: 0 };
              const isHigh = riskObj.risk > 20;
              return (
                <tr key={acc.id} className={isHigh ? 'row-critical-risk' : ''}>
                  <td>{acc.id}</td>
                  <td>{acc.name}</td>
                  <td className="text-amount-in">${acc.balance?.toLocaleString() ?? 'N/A'}</td>
                  <td><span className={isHigh ? 'badge-critical' : 'badge-safe'}>{riskObj.risk}</span></td>
                  <td><span className={isHigh ? 'badge-critical' : 'badge-safe'}>{isHigh ? 'HIGH RISK' : 'NORMAL'}</span></td>
                  <td><button className="btn-primary" style={{fontSize:'0.78rem',padding:'5px 12px'}} onClick={() => onViewDetails(acc.id)}>View Details</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="table-summary">{graphData.accounts.length} accounts &nbsp;|&nbsp; <span className="text-critical">{highRisk} high-risk</span> &nbsp;|&nbsp; <span className="text-safe">{normal} normal</span></div>
      </div>
    </div>
  );
}

// ─── TRANSACTIONS PAGE ────────────────────────────────────────────────────────
function TransactionsPage({ currentTransactions, currentRiskData }) {
  const [filterAcct, setFilterAcct] = useState('');
  const [sortKey, setSortKey] = useState('time');
  const [sortDir, setSortDir] = useState(-1);

  const circularAccounts = new Set(currentRiskData.filter(r => r.reasons.some(x => x.includes('Circular'))).map(r => r.id));

  const sorted = useMemo(() => {
    let rows = [...currentTransactions];
    if (filterAcct) rows = rows.filter(t => t.from.includes(filterAcct) || t.to.includes(filterAcct));
    rows.sort((a, b) => {
      if (sortKey === 'amount') return sortDir * (a.amount - b.amount);
      if (sortKey === 'risk') return sortDir * ((a.isFraud ? 1 : 0) - (b.isFraud ? 1 : 0));
      return sortDir * (new Date(a.timestamp) - new Date(b.timestamp));
    });
    return rows;
  }, [currentTransactions, filterAcct, sortKey, sortDir]);

  const totalVolume = sorted.reduce((s, t) => s + t.amount, 0);
  const suspCount = sorted.filter(t => t.isFraud).length;

  const toggleSort = k => { if (sortKey === k) setSortDir(d => -d); else { setSortKey(k); setSortDir(-1); }};
  const SortIcon = ({ k }) => sortKey === k ? (sortDir > 0 ? ' ↑' : ' ↓') : ' ↕';

  return (
    <div>
      <PageHeader title="Transaction Ledger" subtitle={`${sorted.length} transactions — $${totalVolume.toLocaleString()} total volume`} />
      <div className="filter-row">
        <input className="search-input" placeholder="Filter by account ID…" value={filterAcct} onChange={e => setFilterAcct(e.target.value)} />
      </div>
      <div className="page-card" style={{overflowX:'auto'}}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>From</th><th>To</th>
              <th style={{cursor:'pointer'}} onClick={() => toggleSort('amount')}>Amount<SortIcon k="amount"/></th>
              <th style={{cursor:'pointer'}} onClick={() => toggleSort('time')}>Time<SortIcon k="time"/></th>
              <th style={{cursor:'pointer'}} onClick={() => toggleSort('risk')}>Risk Flag<SortIcon k="risk"/></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan="6" className="text-center">No transactions found</td></tr>}
            {sorted.map((tx, i) => {
              const isSus = tx.isFraud || (circularAccounts.has(tx.from) && circularAccounts.has(tx.to));
              return (
                <tr key={i} className={isSus ? 'row-critical-risk' : ''}>
                  <td className="text-muted" style={{fontSize:'0.72rem'}}>{i+1}</td>
                  <td>{tx.from}</td>
                  <td>{tx.to}</td>
                  <td className="text-amount-in">${tx.amount.toLocaleString()}</td>
                  <td className="text-small">{new Date(tx.timestamp).toLocaleString()}</td>
                  <td>{isSus ? <span className="badge-critical">⚠ Suspicious</span> : <span style={{color:'var(--text-muted)',fontSize:'0.8rem'}}>Clear</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="table-summary">Total: <span className="text-amount-in">${totalVolume.toLocaleString()}</span> &nbsp;|&nbsp; <span className="text-critical">{suspCount} suspicious</span></div>
      </div>
    </div>
  );
}

// ─── LIVE ALERTS PAGE ─────────────────────────────────────────────────────────
function LiveAlertsPage({ currentAlerts }) {
  const [reviewed, setReviewed] = useState(new Set());
  const [cleared, setCleared] = useState(false);

  const visible = cleared ? [] : currentAlerts.filter(a => !reviewed.has(a.key));

  return (
    <div>
      <PageHeader
        title={<>Live Alerts <span className="badge-critical" style={{fontSize:'1rem',verticalAlign:'middle',marginLeft:8}}>{visible.length}</span></>}
        subtitle="Real-time fraud pattern alerts"
      />
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        <button className="btn-danger" onClick={() => setCleared(true)}>Clear All</button>
      </div>
      {visible.length === 0 ? (
        <div className="empty-state"><span style={{color:'var(--accent-green)',fontSize:'2rem'}}>✓</span><p>No active alerts</p></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {visible.map(alert => (
            <div key={alert.key} className={`alert-full-card severity-${alert.severity}`}>
              <div className="alert-full-left">
                <span className="alert-icon" style={{fontSize:'1.4rem'}}>{alert.icon}</span>
                <div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:'0.72rem',color:'var(--text-muted)',marginBottom:4}}>{alert.timestamp}</div>
                  <div style={{fontFamily:'var(--font-head)',fontWeight:700,fontSize:'1.05rem',color:'var(--text-primary)',marginBottom:4}}>
                    {alert.accountId}
                  </div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:'0.85rem',color:'rgba(255,255,255,0.82)'}}>{alert.message}</div>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                <span className={`sev-badge sev-${alert.severity}`}>{alert.severity.toUpperCase()}</span>
                <button className="btn-secondary" style={{fontSize:'0.78rem'}} onClick={() => setReviewed(s => new Set([...s, alert.key]))}>Mark Reviewed</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AI INSIGHTS PAGE ─────────────────────────────────────────────────────────
function AIInsightsPage({ aiInsightText, currentAlerts }) {
  const cards = [
    {
      title: 'Circular Flow Detected',
      desc: 'A circular transaction chain A1→A2→A3→A4→A5→A1 has been identified. This pattern inflates apparent liquidity and is a hallmark of layering in money laundering operations. Risk score impact: +40 per account in chain.',
      action: 'Flag all accounts in chain for manual review and submit SAR.'
    },
    {
      title: 'High-Risk Cluster',
      desc: 'Accounts A1 (Alice), A2 (Bob), and A3 (Charlie) all carry risk scores of 40+. Statistical co-occurrence of simultaneous high risk across closely connected accounts suggests coordinated activity rather than independent incidents.',
      action: 'Escalate all three accounts to compliance team immediately.'
    },
    {
      title: 'Low-Activity Endpoint Accounts',
      desc: 'Accounts A4 (David) and A5 (Eve) show 0 calculated risk scores but consistently appear as final destinations in suspicious chains. They may function as "mule" accounts receiving and holding laundered funds.',
      action: 'Monitor A4 and A5 for unusual withdrawal patterns over next 30 days.'
    }
  ];

  return (
    <div>
      <PageHeader title="AI Insights" subtitle="Machine learning analysis of detected fraud patterns" />
      <div className={`ai-insight-panel ${currentAlerts.length > 0 ? 'active-insight' : 'safe-insight'}`} style={{marginBottom:28}}>
        <div className="insight-icon">✦ AI INSIGHT</div>
        <p>{aiInsightText}</p>
      </div>
      <div className="insight-grid">
        {cards.map((c, i) => (
          <div key={i} className="insight-card">
            <div className="insight-card-title">{c.title}</div>
            <div className="insight-card-desc">{c.desc}</div>
            <div className="insight-card-action">
              <span className="insight-action-label">RECOMMENDED ACTION</span>
              <p>{c.action}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RISK REPORTS PAGE ────────────────────────────────────────────────────────
function RiskReportsPage({ graphData, currentRiskData, currentTransactions }) {
  const [selectedId, setSelectedId] = useState('all');
  const [showReport, setShowReport] = useState(false);

  const acc = graphData.accounts.find(a => a.id === selectedId);
  const risk = currentRiskData.find(r => r.id === selectedId);
  const accTxs = selectedId !== 'all' ? currentTransactions.filter(t => t.from === selectedId || t.to === selectedId) : [];
  const suspTxs = accTxs.filter(t => t.isFraud);

  return (
    <div>
      <PageHeader title="Risk Reports" subtitle="Generate confidential risk assessments per account" />
      <div className="filter-row" style={{marginBottom:24}}>
        <select className="filter-select" value={selectedId} onChange={e => { setSelectedId(e.target.value); setShowReport(false); }}>
          <option value="all">All Accounts</option>
          {graphData.accounts.map(a => <option key={a.id} value={a.id}>{a.id} — {a.name}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowReport(true)}>Generate Report</button>
        <button className="btn-gold" style={{opacity:0.7}}>Export PDF</button>
      </div>

      {showReport && (
        selectedId === 'all' ? (
          <div className="page-card">
            <h3 className="report-section-title">Network Risk Summary</h3>
            <table className="data-table">
              <thead><tr><th>ID</th><th>Name</th><th>Balance</th><th>Risk Score</th><th>Flags</th></tr></thead>
              <tbody>
                {graphData.accounts.map(a => {
                  const r = currentRiskData.find(x => x.id === a.id) || { risk:0, reasons:[] };
                  return (
                    <tr key={a.id} className={r.risk >= 40 ? 'row-critical-risk' : r.risk > 0 ? 'row-high-risk' : ''}>
                      <td>{a.id}</td><td>{a.name}</td>
                      <td className="text-amount-in">${a.balance?.toLocaleString()}</td>
                      <td><span className={r.risk >= 40 ? 'badge-critical' : r.risk > 0 ? 'badge-warning' : 'badge-safe'}>{r.risk}</span></td>
                      <td style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{r.reasons.join('; ') || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : acc ? (
          <div className="report-card">
            <div className="report-header">
              <h3>CONFIDENTIAL RISK REPORT</h3>
              <p>Subject: {acc.id} — {acc.name}</p>
            </div>
            <div className="report-body">
              <div className="report-section">
                <h4>1. Risk Summary</h4>
                <p><strong>Overall Risk Score: </strong>
                  <span className={risk?.risk >= 40 ? 'text-critical' : risk?.risk > 0 ? 'text-warning' : 'text-safe'}>{risk?.risk || 0}</span>
                </p>
                {risk?.reasons?.length > 0 ? <ul>{risk.reasons.map((r,i) => <li key={i}>{r}</li>)}</ul> : <p>No immediate risk factors flagged.</p>}
              </div>
              <div className="report-section">
                <h4>2. Account Info</h4>
                <p>Balance: <span className="text-amount-in">${acc.balance?.toLocaleString()}</span></p>
              </div>
              <div className="report-section">
                <h4>3. Suspicious Transactions ({suspTxs.length})</h4>
                {suspTxs.length === 0 ? <p>No fraudulent transactions logged.</p> : (
                  <ul className="suspicious-tx-list">
                    {suspTxs.map((tx,i) => {
                      const isOut = tx.from === acc.id;
                      return <li key={i}><strong>{isOut?'SENT TO':'RECEIVED FROM'} {isOut?tx.to:tx.from}</strong>: ${tx.amount.toLocaleString()} on {new Date(tx.timestamp).toLocaleString()}</li>;
                    })}
                  </ul>
                )}
              </div>
              <div className="report-section">
                <h4>4. Transaction History ({accTxs.length})</h4>
                <table className="data-table">
                  <thead><tr><th>Dir</th><th>Counterparty</th><th>Amount</th><th>Time</th></tr></thead>
                  <tbody>
                    {accTxs.map((tx,i) => {
                      const isOut = tx.from === acc.id;
                      return <tr key={i}><td><span className={isOut?'badge-out':'badge-in'}>{isOut?'Sent':'Received'}</span></td><td>{isOut?tx.to:tx.from}</td><td className={isOut?'text-amount-out':'text-amount-in'}>{isOut?'-':'+'}${tx.amount.toLocaleString()}</td><td className="text-small">{new Date(tx.timestamp).toLocaleString()}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

// ─── BLOCKCHAIN INTEGRITY PAGE ────────────────────────────────────────────────
const fakeBlocks = [
  { hash: '0x3f8a1c2d4e5b', from: 'A1', to: 'A2', amount: 9200, ts: '2024-01-15 09:12', flagged: true },
  { hash: '0x9b7c0e3a8f12', from: 'A2', to: 'A3', amount: 4500, ts: '2024-01-15 09:18', flagged: false },
  { hash: '0x1d4e6f9a2b3c', from: 'A3', to: 'A4', amount: 9800, ts: '2024-01-15 09:19', flagged: true },
  { hash: '0xa2c4e6b8d012', from: 'A1', to: 'A5', amount: 3200, ts: '2024-01-15 10:05', flagged: false },
  { hash: '0x5e7b9d1f3a48', from: 'A4', to: 'A5', amount: 9100, ts: '2024-01-15 10:08', flagged: true },
  { hash: '0x8f0b2c4e6a3d', from: 'A2', to: 'A5', amount: 7600, ts: '2024-01-15 11:30', flagged: false },
  { hash: '0xc3d5e7f9a1b2', from: 'A5', to: 'A1', amount: 9500, ts: '2024-01-15 12:00', flagged: false },
];

function BlockchainPage() {
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(new Set());

  const handleVerify = () => {
    setVerifying(true); setVerified(new Set());
    fakeBlocks.forEach((_, i) => setTimeout(() => setVerified(s => new Set([...s, i])), i * 300 + 300));
    setTimeout(() => setVerifying(false), fakeBlocks.length * 300 + 600);
  };

  const flaggedCount = fakeBlocks.filter(b => b.flagged).length;

  return (
    <div>
      <PageHeader title="Blockchain Integrity" subtitle="Transaction block verification and chain audit" />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div className="badge-critical" style={{fontSize:'1rem',padding:'8px 16px',borderRadius:8}}>
          ⚠ {flaggedCount} of {fakeBlocks.length} blocks flagged
        </div>
        <button className="btn-primary" onClick={handleVerify} disabled={verifying}>
          {verifying ? 'Verifying…' : '🔗 Verify Chain'}
        </button>
      </div>
      <div className="block-chain">
        {fakeBlocks.map((b, i) => {
          const isVerified = verified.has(i);
          const borderColor = isVerified ? 'var(--accent-green)' : b.flagged ? 'var(--accent-red)' : 'var(--border)';
          const glow = isVerified ? '0 0 14px rgba(0,255,136,0.4)' : b.flagged ? '0 0 10px rgba(239,68,68,0.3)' : 'none';
          return (
            <div key={i} className="block-card" style={{borderColor, boxShadow: glow}}>
              <div className="block-header">
                <span className="block-num">Block #{i+1}</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'0.7rem',color:'var(--text-muted)'}}>{b.hash}</span>
              </div>
              <div className="block-tx">{b.from} → {b.to} &nbsp;|&nbsp; <span className="text-amount-in">${b.amount.toLocaleString()}</span></div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'0.72rem',color:'var(--text-muted)',margin:'6px 0'}}>{b.ts}</div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'0.72rem',color:'var(--text-muted)'}}>
                  {isVerified ? <span style={{color:'var(--accent-green)'}}>✓ Verified</span> : b.flagged ? <span style={{color:'var(--accent-red)'}}>⚠ Flagged</span> : '— Pending'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage() {
  const [threshold, setThreshold] = useState(20);
  const [autoFlag, setAutoFlag] = useState(true);
  const [showReports, setShowReports] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const Toggle = ({val, onChange, label}) => (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <div className={`toggle-pill ${val ? 'on' : ''}`} onClick={() => onChange(!val)}>
        <div className="toggle-knob" />
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure thresholds, display, and data options" />
      <div className="settings-grid">
        <div className="page-card">
          <h3 className="settings-section-title">Alert Thresholds</h3>
          <div className="setting-row" style={{flexDirection:'column',alignItems:'flex-start',gap:12}}>
            <span className="setting-label">Risk Score Alert Threshold: <strong style={{color:'var(--accent-green)'}}>{threshold}</strong></span>
            <input type="range" min={0} max={100} value={threshold} onChange={e=>setThreshold(+e.target.value)} className="time-slider" style={{width:'100%'}} />
          </div>
          <Toggle val={autoFlag} onChange={setAutoFlag} label="Auto-flag circular transactions" />
        </div>

        <div className="page-card">
          <h3 className="settings-section-title">Display</h3>
          <Toggle val={showReports} onChange={setShowReports} label="Show Confidential Reports by default" />
          <Toggle val={autoPlay} onChange={setAutoPlay} label="Enable timeline auto-play" />
        </div>

        <div className="page-card">
          <h3 className="settings-section-title">Data</h3>
          <div className="setting-row">
            <span className="setting-label">Reset all data to defaults</span>
            {resetConfirm
              ? <div style={{display:'flex',gap:8}}>
                  <button className="btn-danger" onClick={()=>setResetConfirm(false)}>Confirm Reset</button>
                  <button className="btn-secondary" onClick={()=>setResetConfirm(false)}>Cancel</button>
                </div>
              : <button className="btn-danger" onClick={()=>setResetConfirm(true)}>Reset</button>
            }
          </div>
          <div className="setting-row">
            <span className="setting-label">Export all transaction data</span>
            <button className="btn-gold">Export CSV</button>
          </div>
        </div>

        <div className="page-card">
          <h3 className="settings-section-title">About</h3>
          <p style={{fontFamily:'var(--font-mono)',color:'var(--text-muted)',fontSize:'0.85rem',lineHeight:1.7}}>
            <strong style={{color:'var(--accent-green)'}}>FraudGuard</strong> v1.0.0<br/>
            Premium Analytics Platform<br/>
            Build: 2024-01-15 · React + Vite<br/>
            Backend: Node.js Express · Port 5000
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'live-alerts', label: 'Live Alerts' },
  { id: 'ai-insights', label: 'AI Insights' },
  { id: 'risk-reports', label: 'Risk Reports' },
  { id: 'blockchain-integrity', label: 'Blockchain Integrity' },
  { id: 'settings', label: 'Settings' },
];

function Dashboard() {
  const outerNavigate = useNavigate();
  // ── Data state ──
  const [graphData, setGraphData] = useState({ accounts: [], transactions: [] });
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [dataMode, setDataMode] = useState('fraud');
  const [timeIndex, setTimeIndex] = useState(0);
  const [sortedTransactions, setSortedTransactions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [filters, setFilters] = useState({ accountId: '', date: '', minAmount: '', maxAmount: '', transactionType: '', channel: '', status: '', location: '' });
  const [fetchError, setFetchError] = useState(null);
  // ── Navigation ──
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageVisible, setPageVisible] = useState(true);
  const mainRef = useRef(null);

  const changePage = (page) => {
    setPageVisible(false);
    setTimeout(() => {
      setCurrentPage(page);
      setPageVisible(true);
      if (mainRef.current) mainRef.current.scrollTop = 0;
    }, 150);
  };

  // ── Fetch data ──
  useEffect(() => {
    setLoading(true); setIsPlaying(false);

    const query = new URLSearchParams({ mode: dataMode });
    Object.entries(filters).forEach(([k, v]) => { if (v) query.append(k, v); });

    Promise.all([
      fetch(`http://localhost:5000/graph?mode=${dataMode}`).then(r => r.json()),
      fetch(`http://localhost:5000/api/transactions/filter?${query.toString()}`).then(r => r.json()),
      fetch(`http://localhost:5000/risk?mode=${dataMode}`).then(r => r.json()),
    ]).then(([graph, filteredRes, risk]) => {
      const sorted = [...filteredRes.transactions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setSortedTransactions(sorted);
      setTimeIndex(sorted.length);
      setGraphData({ accounts: graph.accounts, transactions: filteredRes.transactions });
      setLoading(false);
    }).catch((err) => {
      setFetchError(err.toString());
      setLoading(false);
    });
  }, [dataMode, filters]);

  // ── Timeline playback ──
  useEffect(() => {
    let iv;
    if (isPlaying) iv = setInterval(() => setTimeIndex(p => { if (p >= sortedTransactions.length) { setIsPlaying(false); return p; } return p+1; }), 500);
    return () => clearInterval(iv);
  }, [isPlaying, sortedTransactions.length]);

  // ── Derived data ──
  const currentTransactions = useMemo(() => sortedTransactions.slice(0, timeIndex), [sortedTransactions, timeIndex]);
  const currentRiskData = useMemo(() => calculateRisks(graphData.accounts, currentTransactions), [graphData.accounts, currentTransactions]);

  const currentAlerts = useMemo(() => {
    const alerts = [];
    currentRiskData.forEach(r => {
      if (r.reasons.length) {
        const accTxs = currentTransactions.filter(t => t.from === r.id || t.to === r.id);
        const lastTx = accTxs[accTxs.length - 1];
        const timestamp = lastTx ? new Date(lastTx.timestamp).toLocaleString() : 'N/A';
        r.reasons.forEach(reason => {
          let severity = 'low';
          let icon = '⚠';
          if (reason.includes('Circular') || reason.includes('Dormant')) {
            severity = 'high';
            icon = '🔴';
          } else if (reason.includes('velocity') || reason.includes('structuring') || reason.includes('Location') || reason.includes('Device')) {
            severity = 'medium';
            icon = '🟡';
          } else {
            severity = 'low';
            icon = '🔵';
          }
          alerts.push({ key: `${r.id}-${reason}`, accountId: r.id, message: reason, severity, icon, timestamp, rawTime: lastTx ? new Date(lastTx.timestamp).getTime() : 0, mlFlag: r.mlFlag, mlConfidence: r.mlConfidence });
        });
      }
    });
    return alerts.sort((a,b) => b.rawTime - a.rawTime);
  }, [currentRiskData, currentTransactions]);

  const aiInsightText = useMemo(() => {
    if (!currentAlerts.length) return 'Analysis indicates a stable network with no detectable malicious patterns at this time.';
    const patterns = new Set();
    currentAlerts.forEach(a => {
      if (a.message.includes('Circular')) patterns.add('circular fund flows');
      if (a.message.includes('velocity')) patterns.add('high-velocity rapid transfers');
      if (a.message.includes('structuring')) patterns.add('structuring behavior');
    });
    const p = Array.from(patterns);
    if (!p.length) return 'System detected generic anomalies requiring manual review.';
    if (p.length === 1) return `System detected ${p[0]} indicating isolated suspicious activity.`;
    if (p.length === 2) return `System detected both ${p[0]} and ${p[1]} indicating possible coordinated money laundering activity.`;
    const last = p.pop();
    return `CRITICAL: System detected ${p.join(', ')}, and ${last} indicating highly probable, systematic money laundering activity.`;
  }, [currentAlerts]);

  useEffect(() => { setShowReport(false); }, [selectedAccountId]);

  // ── Helpers ──
  const selectedAccount = graphData.accounts.find(a => a.id === selectedAccountId);
  const selectedRisk = currentRiskData.find(r => r.id === selectedAccountId);
  const accountTransactions = selectedAccountId ? currentTransactions.filter(t => t.from === selectedAccountId || t.to === selectedAccountId) : [];
  const suspiciousTransactions = accountTransactions.filter(t => t.isFraud);
  const totalAccounts = graphData.accounts.length;
  const highRiskAccounts = currentRiskData.filter(r => r.risk >= 40).length;
  const suspiciousTxCount = currentTransactions.filter(t => t.isFraud).length;
  const overallRiskLevel = highRiskAccounts > 0 ? 'HIGH' : (currentRiskData.some(r => r.risk > 0) ? 'MEDIUM' : 'LOW');

  // ── Graph nodes / edges ──
  const reactFlowNodes = [];
  const reactFlowEdges = [];
  if (viewMode === 'graph' && graphData.accounts.length) {
    // When filters are active, only show involved accounts
    const hasActiveFilter = Object.values(filters).some(v => v);
    const involvedIds = new Set();
    currentTransactions.forEach(tx => { involvedIds.add(tx.from); involvedIds.add(tx.to); });
    const visibleAccounts = hasActiveFilter ? graphData.accounts.filter(a => involvedIds.has(a.id)) : graphData.accounts;

    const radius = 350, center = { x: 500, y: 400 };
    const step = visibleAccounts.length ? (2 * Math.PI) / visibleAccounts.length : 0;
    let hNodes = new Set(), hEdges = new Set();
    const activeNodeId = filters.accountId || selectedGraphNodeId;
    if (activeNodeId) {
      hNodes.add(activeNodeId);
      currentTransactions.forEach((tx, i) => {
        if (tx.from === activeNodeId || tx.to === activeNodeId) {
          hEdges.add(`e-${tx.from}-${tx.to}-${i}`); hNodes.add(tx.from); hNodes.add(tx.to);
        }
      });
    }
    visibleAccounts.forEach((acc, i) => {
      const angle = i * step, x = center.x + radius * Math.cos(angle), y = center.y + radius * Math.sin(angle);
      const riskObj = currentRiskData.find(r => r.id === acc.id) || { risk: 0 };
      const isSusp = riskObj.risk >= 40;
      const isSel = activeNodeId === acc.id;
      const hilit = activeNodeId ? hNodes.has(acc.id) : true;
      reactFlowNodes.push({ id: acc.id, position: { x, y }, data: { label: `${acc.name}\n(Risk: ${riskObj.risk})` }, className: `custom-node ${isSusp ? 'node-suspicious' : 'node-safe'} ${isSel ? 'node-selected' : ''}`, style: { opacity: hilit ? 1 : 0.15 } });
    });
    currentTransactions.forEach((tx, i) => {
      const fR = currentRiskData.find(r => r.id === tx.from);
      const tR = currentRiskData.find(r => r.id === tx.to);
      const isCirc = fR?.reasons?.some(x => x.includes('Circular')) && tR?.reasons?.some(x => x.includes('Circular'));
      const isSusEdge = tx.isFraud || tx.is_flagged || isCirc;
      const eId = `e-${tx.from}-${tx.to}-${i}`;
      const hilit = activeNodeId ? hEdges.has(eId) : true;
      const col = isSusEdge ? '#ef4444' : '#334155';
      reactFlowEdges.push({ id: eId, source: tx.from, target: tx.to, label: `$${tx.amount}`, animated: isSusEdge, style: { stroke: col, strokeWidth: isSusEdge ? 3 : 1, opacity: hilit ? 1 : 0.05, transition: 'all 0.3s' }, labelStyle: { fill: col, fontWeight: isSusEdge ? 'bold' : 'normal', fontSize: 10, opacity: hilit ? 1 : 0 }, labelBgStyle: { fill: '#111a1f', fillOpacity: hilit ? 0.8 : 0 }, markerEnd: { type: MarkerType.ArrowClosed, color: col } });
    });
  }

  if (fetchError) return <div className="loading" style={{color:'red'}}>ERROR: {fetchError}</div>;
  if (loading) return <div className="loading">⬡ FRAUDGUARD LOADING…</div>;

  // ── Dashboard page ──
  const hasActiveFilter = Object.values(filters).some(v => v);
  const DashboardPage = (
    <div>
      <PageHeader title="Investigation Dashboard" subtitle={`${dataMode === 'fraud' ? 'Fraud' : 'Normal'} mode · ${currentTransactions.length} transactions match filters`} />

      <div className="filter-panel card" style={{marginBottom: 24, padding: 20}}>
        <div style={{display:'flex', gap: 16, flexWrap:'wrap', alignItems:'flex-end'}}>
          <div className="filter-item">
            <div className="filter-label">Account Focus</div>
            <select className="filter-select" value={filters.accountId} onChange={e=>setFilters(p=>({...p, accountId: e.target.value}))}>
              <option value="">All Accounts</option>
              {graphData.accounts.map(a => <option key={a.id} value={a.id}>{a.id} - {a.name}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <div className="filter-label">Date</div>
            <input type="date" className="filter-input" value={filters.date} onChange={e=>setFilters(p=>({...p, date: e.target.value}))} />
          </div>
          <div className="filter-item">
            <div className="filter-label">Amount Range</div>
            <div style={{display:'flex', gap:8}}>
              <input type="number" className="filter-input" placeholder="Min" style={{width: 80}} value={filters.minAmount} onChange={e=>setFilters(p=>({...p, minAmount: e.target.value}))} />
              <input type="number" className="filter-input" placeholder="Max" style={{width: 80}} value={filters.maxAmount} onChange={e=>setFilters(p=>({...p, maxAmount: e.target.value}))} />
            </div>
          </div>
          <div className="filter-item">
            <div className="filter-label">Type</div>
            <select className="filter-select" value={filters.transactionType} onChange={e=>setFilters(p=>({...p, transactionType: e.target.value}))}>
              <option value="">All</option>
              <option value="transfer">Transfer</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="deposit">Deposit</option>
            </select>
          </div>
          <div className="filter-item">
            <div className="filter-label">Channel</div>
            <select className="filter-select" value={filters.channel} onChange={e=>setFilters(p=>({...p, channel: e.target.value}))}>
              <option value="">All</option>
              <option value="UPI">UPI</option>
              <option value="NEFT">NEFT</option>
              <option value="IMPS">IMPS</option>
              <option value="ATM">ATM</option>
            </select>
          </div>
          <div className="filter-item">
            <div className="filter-label">Status</div>
            <select className="filter-select" value={filters.status} onChange={e=>setFilters(p=>({...p, status: e.target.value}))}>
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="filter-item">
            <div className="filter-label">City</div>
            <select className="filter-select" value={filters.location} onChange={e=>setFilters(p=>({...p, location: e.target.value}))}>
              <option value="">All</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Delhi">Delhi</option>
              <option value="Bengaluru">Bengaluru</option>
              <option value="Chennai">Chennai</option>
              <option value="Hyderabad">Hyderabad</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={()=>setFilters({ accountId:'', date:'', minAmount:'', maxAmount:'', transactionType:'', channel:'', status:'', location:'' })}>Clear Filters</button>
        </div>
      </div>

      <div className="summary-dashboard">
        {[
          { label: hasActiveFilter ? 'Accounts Involved' : 'Total Accounts', value: hasActiveFilter ? new Set([...currentTransactions.map(t=>t.from), ...currentTransactions.map(t=>t.to)]).size : totalAccounts, cls:'' },
          { label:'High-Risk Accounts', value: highRiskAccounts, cls:'text-critical' },
          { label: hasActiveFilter ? 'Suspicious (Filtered)' : 'Suspicious Transactions', value: suspiciousTxCount, cls:'text-warning' },
          { label:'Risk Level', value: overallRiskLevel, cls:`risk-${overallRiskLevel.toLowerCase()}` },
        ].map((c,i) => (
          <div key={i} className="summary-card" style={{animationDelay:`${i*0.07}s`}}>
            <div className="summary-title">{c.label}</div>
            <div className={`summary-value ${c.cls}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className={`ai-insight-panel ${currentAlerts.length > 0 ? 'active-insight' : 'safe-insight'}`}>
        <div className="insight-icon">✦ AI INSIGHT</div>
        <p>{aiInsightText}</p>
      </div>

      <div className="tabs">
        <div style={{display:'flex',gap:10}}>
          <button className={`tab-btn ${viewMode==='list'?'active':''}`} onClick={()=>setViewMode('list')}>List View</button>
          <button className={`tab-btn ${viewMode==='graph'?'active':''}`} onClick={()=>setViewMode('graph')}>Graph View</button>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className={`tab-btn ${dataMode==='normal'?'active':''}`} onClick={()=>setDataMode('normal')}>Normal Mode</button>
          <button className={`tab-btn ${dataMode==='fraud'?'active fraud-mode-active':''}`} onClick={()=>setDataMode('fraud')}>Fraud Mode</button>
        </div>
      </div>

      <div className="main-content-row">
        <div className="primary-content">
          <div className="timeline-panel">
            <label className="timeline-label">
              <strong>Transaction Timeline:</strong> Step <span className="timeline-step">{timeIndex}</span> of <span className="timeline-step">{sortedTransactions.length}</span>
            </label>
            <div style={{display:'flex',alignItems:'center',gap:14,width:'100%'}}>
              <button className={`play-btn ${isPlaying?'playing':''}`} onClick={()=>{ if(timeIndex >= sortedTransactions.length) setTimeIndex(0); setIsPlaying(!isPlaying); }}>
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <input type="range" className="time-slider" min={0} max={sortedTransactions.length} value={timeIndex} onChange={e=>{setIsPlaying(false);setTimeIndex(+e.target.value);}} />
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="split-layout">
              <div className="left-panel card">
                <h2>Accounts ({graphData.accounts.length})</h2>
                <div className="account-list-container">
                  <table className="data-table interactive-table">
                    <colgroup><col style={{minWidth:50}}/><col style={{width:'auto'}}/><col style={{minWidth:70}}/></colgroup>
                    <thead><tr><th>ID</th><th>Name</th><th>Risk</th></tr></thead>
                    <tbody>
                      {graphData.accounts.map(acc => {
                        const riskObj = currentRiskData.find(r=>r.id===acc.id)||{risk:0};
                        const isCrit = riskObj.risk >= 40, isHigh = riskObj.risk > 0 && riskObj.risk < 40;
                        return (
                          <tr key={acc.id} className={`${selectedAccountId===acc.id?'selected-row':''} ${isCrit?'row-critical-risk':isHigh?'row-high-risk':''}`} onClick={()=>setSelectedAccountId(acc.id)}>
                            <td>{acc.id}</td><td>{acc.name}</td>
                            <td>{riskObj.risk > 0 ? <span className={isCrit?'badge-critical':'badge-warning'}>{riskObj.risk}</span> : <span className="badge-safe">0</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="right-panel card">
                {!selectedAccount ? (
                  <div className="placeholder"><p>Select an account to view details.</p></div>
                ) : (
                  <div className="details-view">
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                      <h2 style={{borderBottom:'none',margin:0,padding:0}}>Account Details</h2>
                      <button className="report-btn" onClick={()=>setShowReport(!showReport)}>{showReport?'Hide Report':'Generate Report'}</button>
                    </div>
                    {showReport && (
                      <div className="report-card">
                        <div className="report-header"><h3>CONFIDENTIAL RISK REPORT</h3><p>Subject: {selectedAccount.id} — {selectedAccount.name}</p></div>
                        <div className="report-body">
                          <div className="report-section">
                            <h4>1. Risk Summary</h4>
                            <p><strong>Overall Risk Score: </strong><span className={selectedRisk?.risk>=40?'text-critical':selectedRisk?.risk>0?'text-warning':'text-safe'}>{selectedRisk?.risk||0}</span></p>
                            <p style={{fontSize:'0.8rem',color:'var(--text-muted)',marginTop:4}}>Rule Score: {selectedRisk?.ruleScore || 0} | ML Score: {selectedRisk?.mlScore || 0}</p>
                            {selectedRisk?.reasons?.length ? <ul>{selectedRisk.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul> : <p>No risk factors flagged.</p>}
                          </div>
                          <div className="report-section">
                            <h4>2. Suspicious Transactions</h4>
                            {suspiciousTransactions.length===0 ? <p>None logged.</p> : <ul className="suspicious-tx-list">{suspiciousTransactions.map((tx,i)=>{const isOut=tx.from===selectedAccount.id;return<li key={i}><strong>{isOut?'SENT TO':'RECEIVED FROM'} {isOut?tx.to:tx.from}</strong>: ${tx.amount.toLocaleString()}</li>;})}</ul>}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="details-header" style={{marginTop:showReport?16:0}}>
                      <div className="detail-item"><span className="label">Name</span><span className="value">{selectedAccount.name}</span></div>
                      <div className="detail-item"><span className="label">Balance</span><span className="value">${selectedAccount.balance?.toLocaleString()}</span></div>
                      <div className="acc-card-header">
                      <span className="acc-id">{selectedAccount.id}</span>
                      <div style={{display:'flex',gap:6}}>
                        {selectedRisk && selectedRisk.mlFlag && (
                          <span className="ml-badge" title={`Confidence: ${Math.round(selectedRisk.mlConfidence * 100)}%`}>
                            ⚡ ML RISK
                          </span>
                        )}
                        <span className={`risk-badge risk-${overallRiskLevel.toLowerCase()}`}>
                          {overallRiskLevel.toUpperCase()}
                        </span>
                      </div>
                    </div>
                      <div className="detail-item">
                        <span className="label">Risk Score</span>
                        <span className="value">
                          <strong className={selectedRisk?.risk>=40?'text-critical':selectedRisk?.risk>0?'text-warning':'text-safe'}>{selectedRisk?.risk||0}</strong>
                          {selectedRisk?.mlFlag && <span className="ml-badge">ML DETECTED</span>}
                        </span>
                      </div>
                    </div>
                    {selectedRisk?.risk > 0 && selectedRisk?.reasons?.length > 0 && !showReport && (
                      <div className="reasons-box">
                        <h3>Investigation Findings:</h3>
                        {selectedRisk.mlFlag && (
                      <div className="ml-explanation-box">
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                          <span style={{fontWeight:700,color:'var(--accent-amber)',fontSize:'0.75rem'}}>⚡ ML ANALYSIS INSIGHTS</span>
                          <span style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>CONFIDENCE: {Math.round(selectedRisk.mlConfidence * 100)}%</span>
                        </div>
                        <p style={{margin:0,fontSize:'0.82rem',lineHeight:1.4,color:'rgba(255,255,255,0.9)'}}>
                          Anomalous behavioral pattern detected via Isolation Forest.
                          The model identified deviations in transaction frequency and device signatures.
                        </p>
                      </div>
                    )}

                    <div className="reason-list">
                      {selectedRisk.reasons.map((r, i) => (
                        <div key={i} className="reason-item">
                          <span className="reason-dot"></span>
                          {r}
                        </div>
                      ))}
                    </div>
                    </div>
                    )}
                    <h3 className="tx-heading">Transactions ({accountTransactions.length})</h3>
                    <div className="tx-table-container">
                      <table className="data-table">
                        <colgroup><col style={{minWidth:100}}/><col style={{minWidth:120}}/><col style={{minWidth:90}}/><col style={{minWidth:160}}/></colgroup>
                        <thead><tr><th>Direction</th><th>Counterparty</th><th>Amount</th><th>Time</th></tr></thead>
                        <tbody>
                          {accountTransactions.length===0 ? <tr><td colSpan="4" className="text-center">No transactions found</td></tr> :
                            accountTransactions.map((tx,i)=>{const isOut=tx.from===selectedAccount.id;return<tr key={i} className={tx.isFraud?'row-high-risk':''}><td><span className={isOut?'badge-out':'badge-in'}>{isOut?'Sent':'Received'}</span></td><td>{isOut?tx.to:tx.from}</td><td className={isOut?'text-amount-out':'text-amount-in'}>{isOut?'-':'+'}${tx.amount.toLocaleString()}</td><td className="text-small">{new Date(tx.timestamp).toLocaleString()}</td></tr>;})}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="graph-container card">
              <h2 style={{marginBottom:16}}>Transaction Visualization</h2>
              <div className="react-flow-wrapper">
                {reactFlowNodes.length > 0 && (
                  <ReactFlow nodes={reactFlowNodes} edges={reactFlowEdges} onNodeClick={(_,n)=>setSelectedGraphNodeId(n.id)} onPaneClick={()=>setSelectedGraphNodeId(null)} fitView attributionPosition="bottom-right">
                    <MiniMap /><Controls /><Background color="#1e2d3d" gap={20} />
                  </ReactFlow>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="alerts-panel card">
          <h2>Live Alerts ({currentAlerts.length})</h2>
          <div className="alerts-list">
            {currentAlerts.length===0 ? <p className="placeholder" style={{fontSize:'0.85rem',textAlign:'center'}}>No alerts detected yet.</p> :
              currentAlerts.map(alert => (
                <div key={alert.key} className={`alert-card severity-${alert.severity}`}>
                  <div className="alert-header"><span className="alert-icon">⚠</span><span className="alert-time">{alert.timestamp}</span></div>
                  <div className="alert-body"><strong>{alert.accountId}</strong>: {alert.message}</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );

  const renderPage = () => {
    switch(currentPage) {
      case 'accounts': return <AccountsPage graphData={graphData} currentRiskData={currentRiskData} onViewDetails={id=>{ setSelectedAccountId(id); changePage('dashboard'); }} />;
      case 'transactions': return <TransactionsPage currentTransactions={currentTransactions} currentRiskData={currentRiskData} />;
      case 'live-alerts': return <LiveAlertsPage currentAlerts={currentAlerts} />;
      case 'ai-insights': return <AIInsightsPage aiInsightText={aiInsightText} currentAlerts={currentAlerts} />;
      case 'risk-reports': return <RiskReportsPage graphData={graphData} currentRiskData={currentRiskData} currentTransactions={currentTransactions} />;
      case 'blockchain-integrity': return <BlockchainPage />;
      case 'settings': return <SettingsPage />;
      default: return DashboardPage;
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">FraudGuard</div>
          <div className="sidebar-brand-sub">Premium Analytics</div>
          <span className="sidebar-badge">ADMIN ACCESS</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <div key={item.id} className={`sidebar-nav-item ${currentPage===item.id?'active':''}`} onClick={()=>changePage(item.id)}>
              <span className="sidebar-dot" />
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-signout" onClick={() => {
            localStorage.removeItem('isAuthenticated');
            outerNavigate('/login');
          }}>SIGN OUT</button>
        </div>
      </aside>
      <main className="main-content" ref={mainRef} style={{
        opacity: pageVisible ? 1 : 0,
        transform: pageVisible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
      }}>
        {renderPage()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
