const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad', 'Kolkata'];
const ACCT_TYPES = ['savings', 'current'];
const CHANNELS = ['UPI', 'NEFT', 'IMPS', 'ATM'];
const CHANNEL_WEIGHTS = { 'UPI': 0.6, 'NEFT': 0.2, 'IMPS': 0.15, 'ATM': 0.05 };
const TX_TYPES = ['transfer', 'withdrawal', 'deposit'];

const NAMES = [
    "Aarav Sharma", "Vivaan Goel", "Aditya Verma", "Vihaan Iyer", "Arjun Patel", "Sai Reddy", "Reyansh Gupta", "Aaryan Nair", "Ishaan Joshi", "Krishna Kulkarni",
    "Anaya Singh", "Aadhya Rao", "Saanvi Bhatt", "Anika Deshmukh", "Aarohi Mishra", "Avni Saxena", "Myra Kaul", "Kyra Pandey", "Ishani Hegde", "Anvi Choudhury",
    "Rahul Dravid", "Sachin Tendulkar", "Virat Kohli", "MS Dhoni", "Rohit Sharma", "Hardik Pandya", "Jasprit Bumrah", "Rishabh Pant", "Ravindra Jadeja", "KL Rahul",
    "Priya Mani", "Sneha Kumari", "Anjali Bose", "Deepika Das", "Priyanka Ghosh", "Kareena Kapoor", "Aishwarya Rai", "Katrina Kaif", "Alia Bhatt", "Shraddha Kapoor",
    "Amitabh Bachchan", "Shah Rukh Khan", "Salman Khan", "Aamir Khan", "Akshay Kumar", "Ranbir Kapoor", "Ranveer Singh", "Ayushmann Khurrana", "Rajkummar Rao", "Vicky Kaushal",
    "Neelam Kothari", "Juhi Chawla", "Madhuri Dixit", "Sridevi Kapoor", "Hema Malini", "Rekha Ganesan", "Jaya Bachchan", "Sharmila Tagore", "Waheeda Rehman", "Nargis Dutt",
    "Lakshmi Narayanan", "Venkatesh Prasad", "Ramesh Babu", "Suresh Raina", "Dinesh Karthik", "Murali Vijay", "Ravichandran Ashwin", "Ajinkya Rahane", "Cheteshwar Pujara", "Ishant Sharma",
    "Meera Bai", "Savitri Devi", "Sarojini Naidu", "Indira Gandhi", "Kiran Bedi", "Mary Kom", "Saina Nehwal", "PV Sindhu", "Mithali Raj", "Jhulan Goswami",
    "Vikram Seth", "Amitav Ghosh", "Arundhati Roy", "Salman Rushdie", "Jhumpa Lahiri", "Anita Desai", "Kiran Desai", "Shashi Tharoor", "Ramachandra Guha", "William Dalrymple",
    "Sundar Pichai", "Satya Nadella", "Shantanu Narayen", "Indra Nooyi", "Ratan Tata", "Mukesh Ambani", "Gautam Adani", "Anand Mahindra", "Azim Premji", "Shiv Nadar"
];

const accounts = Array.from({ length: 100 }, (_, i) => {
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    return {
        id: `A${i + 1}`,
        account_id: `A${i + 1}`,
        name: NAMES[i] || `Account ${i + 1}`,
        balance: Math.floor(Math.random() * 490000) + 10000,
        account_type: ACCT_TYPES[Math.floor(Math.random() * 2)],
        city: city,
        kyc_status: Math.random() > 0.15 ? 'Verified' : 'Pending',
        last_active: '2026-02-28T12:00:00Z',
        avg_transaction_amount: Math.floor(Math.random() * 8000) + 500,
        base_location: city,
        base_device: `DEV${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`
    };
});

let txnCounter = 0;
function makeTx(from, to, amount, ts, overrides = {}) {
    txnCounter++;
    const fromAcc = accounts.find(a => a.id === from);
    const toAcc = accounts.find(a => a.id === to);
    
    // Weighted channel selection
    let channel = overrides.channel;
    if (!channel) {
        const r = Math.random();
        let cumulative = 0;
        for (const [ch, weight] of Object.entries(CHANNEL_WEIGHTS)) {
            cumulative += weight;
            if (r < cumulative) {
                channel = ch;
                break;
            }
        }
    }

    return {
        txn_id: `TXN${String(txnCounter).padStart(7, '0')}`,
        from,
        to,
        from_account: from,
        to_account: to,
        amount: Math.round(amount),
        currency: 'INR',
        timestamp: ts,
        channel: channel || 'UPI',
        location: overrides.location || (fromAcc ? fromAcc.base_location : CITIES[0]),
        device_id: overrides.device_id || (fromAcc ? fromAcc.base_location === overrides.location || !overrides.location ? fromAcc.base_device : `DEV_NEW_${Math.floor(Math.random()*1000)}` : 'DEV_GEN_001'),
        ip_address: `106.213.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        transaction_type: overrides.transaction_type || 'transfer',
        status: Math.random() > 0.03 ? 'success' : 'failed',
        is_flagged: false,
        isFraud: overrides.isFraud || false
    };
}

const transactions = [];

// Generate dense data for March 2026
for (let day = 1; day <= 31; day++) {
    const dateStr = `2026-03-${day.toString().padStart(2, '0')}`;
    
    accounts.forEach(acc => {
        // Skip account A30 (Dormant) until March 21
        if (acc.id === 'A30' && day < 21) return;

        // Number of outgoing txns: 3 to 4
        const outCount = Math.floor(Math.random() * 2) + 3;
        for (let k = 0; k < outCount; k++) {
            let toIdx = Math.floor(Math.random() * 100);
            while (`A${toIdx + 1}` === acc.id) toIdx = Math.floor(Math.random() * 100);
            
            const hr = Math.floor(Math.random() * 24).toString().padStart(2, '0');
            const mn = Math.floor(Math.random() * 60).toString().padStart(2, '0');
            const sc = Math.floor(Math.random() * 60).toString().padStart(2, '0');
            const ts = `${dateStr}T${hr}:${mn}:${sc}Z`;
            
            const amount = Math.random() * acc.avg_transaction_amount * 1.5 + 50;
            let isFraud = false;
            // Introduce random fraud (about 3% chance for larger amounts)
            if (amount > 10000 && Math.random() < 0.15) {
                isFraud = true;
            } else if (amount > 50000 && Math.random() < 0.4) {
                isFraud = true;
            }
            
            // Generate some random high-velocity or device anomalies to trigger High Risk heuristics
            let deviceOverride = null;
            let locationOverride = null;
            if (isFraud && Math.random() < 0.5) {
                deviceOverride = 'DEV99999'; // Random new device
                locationOverride = 'UnknownCity'; // Location anomaly
            }

            transactions.push(makeTx(acc.id, `A${toIdx + 1}`, amount, ts, {
                isFraud,
                ...(deviceOverride && { device_id: deviceOverride }),
                ...(locationOverride && { location: locationOverride })
            }));
        }
    });

    // Inject Specific Fraud Patterns
    if (day === 10) {
        // Circular: A1 -> A2, A2 -> A3, A3 -> A1
        const ts = `${dateStr}T14:30:00Z`;
        transactions.push(makeTx('A1', 'A2', 45000, ts, { isFraud: true }));
        transactions.push(makeTx('A2', 'A3', 45000, `${dateStr}T14:35:00Z`, { isFraud: true }));
        transactions.push(makeTx('A3', 'A1', 45000, `${dateStr}T14:40:00Z`, { isFraud: true }));
    }

    if (day === 15) {
        // Structuring: A10 -> A11 many small txns
        for (let i = 0; i < 6; i++) {
            const ts = `${dateStr}T09:${(10 + i).toString().padStart(2, '0')}:00Z`;
            transactions.push(makeTx('A10', 'A11', 9900 + Math.random() * 90, ts, { isFraud: true }));
        }
    }

    if (day === 20) {
        // High Velocity: A20 -> A21
        for (let i = 0; i < 10; i++) {
            const ts = `${dateStr}T11:00:${i.toString().padStart(2, '0')}Z`;
            transactions.push(makeTx('A20', 'A21', 500, ts, { isFraud: true }));
        }
    }

    if (day === 21) {
        // Dormant account A30 activation
        const ts = `${dateStr}T12:00:00Z`;
        transactions.push(makeTx('A30', 'A31', 450000, ts, { isFraud: true }));
    }

    if (day === 25) {
        // Location Anomaly: A40
        const ts = `${dateStr}T18:00:00Z`;
        transactions.push(makeTx('A40', 'A41', 12000, ts, { location: 'London', isFraud: true }));
    }
}

// Sorting transactions by timestamp
transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

// Indexing for faster retrieval
const transactionsByDateAccount = {};
transactions.forEach(tx => {
    const date = tx.timestamp.split('T')[0];
    if (!transactionsByDateAccount[date]) transactionsByDateAccount[date] = {};
    
    if (!transactionsByDateAccount[date][tx.from]) transactionsByDateAccount[date][tx.from] = [];
    if (!transactionsByDateAccount[date][tx.to]) transactionsByDateAccount[date][tx.to] = [];
    
    transactionsByDateAccount[date][tx.from].push(tx);
    transactionsByDateAccount[date][tx.to].push(tx);
});

function getTransactionsByAccountAndDate(accountId, date) {
    if (transactionsByDateAccount[date] && transactionsByDateAccount[date][accountId]) {
        return transactionsByDateAccount[date][accountId];
    }
    return [];
}

module.exports = { 
    accounts, 
    transactions, 
    CITIES, 
    getTransactionsByAccountAndDate 
};
