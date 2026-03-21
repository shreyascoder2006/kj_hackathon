fetch('http://localhost:5000/graph?mode=fraud').then(res => res.json()).then(data => console.log('FRAUD TRANSACTIONS:', data.transactions.filter(t => t.isFraud).length))
