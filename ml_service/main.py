import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import numpy as np
from sklearn.ensemble import IsolationForest
import pandas as pd

app = FastAPI()

class TransactionData(BaseModel):
    amount: float
    frequency: float
    new_device: int
    location_change: int

# Mock some "normal" data for training
# In a real scenario, this would be historical data
def train_model():
    # amount, frequency, new_device, location_change
    normal_data = []
    for _ in range(500):
        amount = np.random.normal(2000, 1000)
        freq = np.random.randint(1, 4)
        normal_data.append([max(10, amount), freq, 0, 0])
    
    # Add some slight variation
    for _ in range(50):
        normal_data.append([np.random.normal(10000, 2000), np.random.randint(4, 6), 0, 0])

    X = np.array(normal_data)
    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(X)
    return model

model = train_model()

@app.post("/predict")
async def predict(data: TransactionData):
    features = np.array([[data.amount, data.frequency, data.new_device, data.location_change]])
    
    # IsolationForest.predict returns -1 for anomaly, 1 for normal
    prediction = model.predict(features)[0]
    # decision_function returns signed distance (lower is more anomalous)
    raw_score = model.decision_function(features)[0]
    
    # Scale score to 0-100 (approximate)
    # raw_score is usually between -0.5 and 0.5
    # Threshold for anomaly is usually 0.0
    ml_flag = bool(prediction == -1)
    
    if ml_flag:
        # Anomaly -> score 60-80
        ml_score = min(80, max(60, int((0.1 - raw_score) * 200)))
        confidence = 0.85
    else:
        # Normal -> score 5-20
        ml_score = max(5, min(20, int((0.5 - raw_score) * 10)))
        confidence = 0.60

    reasons = []
    if data.amount > 50000:
        reasons.append("Unusually high transaction amount")
    if data.frequency > 5:
        reasons.append("High transaction frequency")
    if data.new_device == 1:
        reasons.append("New device detected")
    if data.location_change == 1:
        reasons.append("Location anomaly detected")
    
    if ml_flag and not reasons:
        reasons.append("Pattern-based behavioral anomaly detected by ML")

    return {
        "ml_flag": ml_flag,
        "ml_score": ml_score,
        "confidence": confidence,
        "reasons": reasons
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
