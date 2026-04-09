# FraudGuard: AI-Powered Fund Flow Tracking & Fraud Detection

## Problem Statement
Traditional fraud detection systems rely heavily on simple, deterministic threshold rules that fail to identify sophisticated, coordinated financial crimes. Money launderers exploit these blind spots through multi-step layering, structuring (smurfing) transactions just below reporting thresholds, and moving funds rapidly across complex networks of dormant or compromised accounts. Investigating these patterns manually is incredibly slow, resulting in overwhelming false-positive alerts, severe compliance risks, and massive financial losses for institutions.

## Proposed Solution
**FraudGuard** is an advanced, real-time financial monitoring platform that combines visual graph intelligence with hybrid risk-scoring. By continuously ingesting transaction data, the system maps the entire flow of funds across accounts as a dynamic, interactive network graph. 

Instead of treating transactions in isolation, FraudGuard evaluates entire behavioral sequences. It uses an **Isolation Forest Machine Learning model** to establish baseline financial behavior for every account, flagging multi-dimensional anomalies (like unusual transaction velocity combined with new devices or unpredictable location changes). This ML scoring works in tandem with an automated heuristic engine that instantly detects known laundering typologies, such as circular fund flows and the sudden activation of dormant accounts for large transfers.

## Innovation & Uniqueness
- **Interactive Graph Intelligence:** Replaces static alert lists with a visual, nodes-and-edges interface built on React Flow. Investigators can literally "follow the money" in real-time.
- **Explainable Hybrid AI (XAI):** Rather than a vague "Risk Score = 95," FraudGuard provides exact, human-readable rationales (e.g., *“Location anomaly detected + Structuring behavior”*), significantly reducing investigation time while maintaining regulatory transparency.
- **Automated Triage & Prioritization:** Dynamically categorizes accounts into risk tiers (High, Medium, Normal) based on cumulative behavioral signals, filtering out the noise and focusing compliance officers on the highest-priority threats.

## Technical Approach
- **Frontend Architecture:** Built using React.js and Vite for high performance, featuring premium custom CSS (glassmorphism UI) for an intuitive, command-center experience.
- **Backend Infrastructure:** A lightweight Node.js/Express backend capable of processing high-volume chronological transaction streams.
- **Analytical Engine:** Processes deterministic rules (like high-velocity checks) alongside probabilistic ML models, outputting aggregated risk objects directly to the dashboard visualization.

## Feasibility, Viability & Impact
- **Feasibility:** By utilizing standard REST APIs and modular React components, FraudGuard is highly feasible to integrate into existing banking infrastructure. The graph-based visualization scales effortlessly using frontend virtualization techniques.
- **Impact & Benefits:** 
  - **Economic & Operational Return:** Automating the detection and triage of complex laundering schemes cuts manual investigation timelines by up to 70%, dramatically lowering operational costs and reducing the risk of multi-million dollar AML non-compliance fines.
  - **Societal Impact:** Proactively identifies and disrupts organized crime syndicates, terrorist financing, and massive-scale money laundering networks, securing the integrity of the broader financial ecosystem.
