const express = require('express');
const cors = require('cors');
const { accounts, transactions } = require('./backend/data/mockData');
const { calculateRiskScores } = require('./backend/services/riskService');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// ─── Routes ───────────────────────────────────────────────────────────────────

// Get graph data (accounts and transactions)
app.get('/graph', (req, res) => {
    const mode = req.query.mode;
    const currentTransactions = mode === 'normal' ? transactions.filter(t => !t.isFraud) : transactions;
    res.json({ accounts, transactions: currentTransactions });
});

// Get risk scores for all accounts
app.get('/risk', async (req, res) => {
    const mode = req.query.mode;
    const currentTransactions = mode === 'normal' ? transactions.filter(t => !t.isFraud) : transactions;
    try {
        const riskScores = await calculateRiskScores(accounts, currentTransactions);
        res.json(riskScores);
    } catch (error) {
        console.error("Risk calculation error:", error);
        res.status(500).json({ error: 'Failed to calculate risk scores' });
    }
});

// Advanced transaction filtering
app.get('/api/transactions/filter', (req, res) => {
    let filtered = [...transactions];
    const { mode, accountId, date, minAmount, maxAmount, transactionType, channel, status, location } = req.query;
    
    if (mode === 'normal') filtered = filtered.filter(t => !t.isFraud);
    if (accountId) filtered = filtered.filter(t => t.from === accountId || t.to === accountId);
    if (date) filtered = filtered.filter(t => t.timestamp.startsWith(date));
    if (minAmount) filtered = filtered.filter(t => t.amount >= Number(minAmount));
    if (maxAmount) filtered = filtered.filter(t => t.amount <= Number(maxAmount));
    if (transactionType) filtered = filtered.filter(t => t.transaction_type === transactionType);
    if (channel) {
        const channels = channel.split(',');
        filtered = filtered.filter(t => channels.includes(t.channel));
    }
    if (status) filtered = filtered.filter(t => t.status === status);
    if (location) filtered = filtered.filter(t => t.location === location);

    res.json({ transactions: filtered });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
