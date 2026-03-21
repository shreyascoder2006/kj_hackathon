const { IsolationForest } = require('../ml/IsolationForest');

// ─── Feature Extraction ───────────────────────────────────────────────────────
function extractFeatures(txs, accounts) {
    const features = [];
    const txByAccount = {};
    txs.forEach(tx => {
        if (!txByAccount[tx.from]) txByAccount[tx.from] = [];
        txByAccount[tx.from].push(tx);
    });

    txs.forEach(tx => {
        const userTxs = txByAccount[tx.from] || [];
        const prevTxs = userTxs.filter(t => new Date(t.timestamp) < new Date(tx.timestamp)).sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp));
        const lastTx = prevTxs[prevTxs.length - 1];

        const amount = Math.min(tx.amount / 1000, 50); 
        const frequency = Math.min(userTxs.length, 20);
        const timeDiff = lastTx ? Math.max(0, (new Date(tx.timestamp) - new Date(lastTx.timestamp)) / 60000) : 120;
        const deviceChanged = lastTx && lastTx.device_id !== tx.device_id ? 10 : 0;
        const locationChanged = lastTx && lastTx.location !== tx.location ? 10 : 0;

        features.push([amount, frequency, timeDiff, deviceChanged, locationChanged]);
    });
    return features;
}

// ─── Heuristic detection ──────────────────────────────────────────────────────
function detectCircular(accountId, userTxs, allTxs) {
    // Circular detection still needs some global context or a specialized subset
    // For now, let's keep it but optimize the adjacency build if possible.
    // Given the task, we can focus on the specific circular patterns we inject.
    const adj = {};
    for (const tx of allTxs) {
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

function detectHighVelocity(id, userTxs) {
    for (let i = 0; i < userTxs.length - 2; i++)
        if (new Date(userTxs[i + 2].timestamp) - new Date(userTxs[i].timestamp) < 600000) return true;
    return false;
}

function detectStructuring(id, userTxs) {
    return userTxs.filter(t => t.from === id && t.amount >= 9000 && t.amount < 10000).length >= 3;
}

function detectDormant(accountId, userTxs, acc) {
    if (!acc || userTxs.length === 0) return false;
    const lastTx = userTxs[userTxs.length - 1];
    if (lastTx.amount < 50000) return false;
    const prevTx = userTxs[userTxs.length - 2];
    if (!prevTx) {
        return (new Date(lastTx.timestamp) - new Date(acc.last_active)) > 7 * 86400000;
    }
    return (new Date(lastTx.timestamp) - new Date(prevTx.timestamp)) > 7 * 86400000;
}

function detectLocationAnomaly(accountId, userTxs, acc) {
    if (!acc || userTxs.length === 0) return false;
    const lastTx = userTxs[userTxs.length - 1];
    return lastTx.location && acc.city && lastTx.location !== acc.city;
}

function detectDeviceChange(accountId, userTxs) {
    if (userTxs.length < 2) return false;
    const lastTx = userTxs[userTxs.length - 1];
    const prevTx = userTxs[userTxs.length - 2];
    return lastTx.device_id !== prevTx.device_id;
}

function detectAmountSpike(accountId, userTxs, acc) {
    if (!acc || userTxs.length === 0) return false;
    const lastTx = userTxs[userTxs.length - 1];
    return lastTx.amount > acc.avg_transaction_amount * 3;
}

function detectFailedBurst(accountId, userTxs) {
    if (userTxs.length < 3) return false;
    const recent = userTxs.slice(-3);
    const allFailed = recent.every(t => t.status === 'failed');
    const within10Mins = (new Date(recent[2].timestamp) - new Date(recent[0].timestamp)) < 600000;
    return allFailed && within10Mins;
}

// ─── Hybrid Risk Engine ───────────────────────────────────────────────────────
async function getMLAnalysis(accountId, userTxs, acc) {
    if (!userTxs.length) return { score: 0, flag: false, confidence: 0, reasons: [] };

    const lastTx = userTxs[userTxs.length - 1];
    const prevTx = userTxs[userTxs.length - 2];

    const amount = lastTx.amount;
    const frequency = userTxs.filter(t => new Date(lastTx.timestamp) - new Date(t.timestamp) < 3600000).length; // Hourly frequency
    const new_device = (prevTx && prevTx.device_id !== lastTx.device_id) ? 1 : 0;
    const location_change = (prevTx && prevTx.location !== lastTx.location) ? 1 : 0;

    try {
        const response = await fetch('http://localhost:8000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                frequency,
                new_device,
                location_change
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            return {
                score: result.ml_score,
                flag: result.ml_flag,
                confidence: result.confidence,
                reasons: result.reasons.map(r => `ML: ${r}`)
            };
        }
    } catch (error) {
        console.error("ML Service unreachable, falling back to local heuristic.", error.message);
    }
    
    // Fallback if ML service is down
    return { score: 0, flag: false, confidence: 0, reasons: [] };
}

async function calculateRiskScores(accounts, txs) {
    // Optimization: Group transactions by account ID once
    const txByAccount = {};
    txs.forEach(tx => {
        if (!txByAccount[tx.from]) txByAccount[tx.from] = [];
        if (!txByAccount[tx.to]) txByAccount[tx.to] = [];
        txByAccount[tx.from].push(tx);
        txByAccount[tx.to].push(tx);
    });

    const circularContext = txs.filter(t => t.amount > 1000); 

    const riskResults = await Promise.all(accounts.map(async (acc) => {
        const userTxs = (txByAccount[acc.id] || []).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
        let ruleScore = 0;
        const reasons = [];

        if (detectCircular(acc.id, userTxs, circularContext)) { ruleScore += 40; reasons.push('Circular transactions detected'); }
        if (detectDormant(acc.id, userTxs, acc)) { ruleScore += 30; reasons.push('Dormant account anomalous activity'); }
        if (detectHighVelocity(acc.id, userTxs)) { ruleScore += 25; reasons.push('High velocity transactions'); }
        if (detectStructuring(acc.id, userTxs)) { ruleScore += 20; reasons.push('Potential structuring (amounts just below threshold)'); }
        if (detectLocationAnomaly(acc.id, userTxs, acc)) { ruleScore += 20; reasons.push('Location anomaly detected'); }
        if (detectDeviceChange(acc.id, userTxs)) { ruleScore += 20; reasons.push('Device change detected'); }
        if (detectAmountSpike(acc.id, userTxs, acc)) { ruleScore += 15; reasons.push('Unusual amount spike'); }
        if (detectFailedBurst(acc.id, userTxs)) { ruleScore += 15; reasons.push('Burst of failed transactions'); }

        const ml = await getMLAnalysis(acc.id, userTxs, acc);
        
        return { 
            id: acc.id, 
            risk: ruleScore + ml.score, 
            ruleScore,
            mlScore: ml.score,
            mlFlag: ml.flag,
            mlConfidence: ml.confidence,
            reasons: [...reasons, ...ml.reasons]
        };
    }));
    
    return riskResults;
}

module.exports = { calculateRiskScores };
