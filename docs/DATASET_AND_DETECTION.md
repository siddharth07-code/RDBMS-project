# FraudLens: Dataset Generation, Fraud Detection, and Research Evaluation

This document outlines the synthetic dataset architecture, random seeding, ground-truth labeling methodology, deterministic SQL detection rules, alert deduplication strategy, empirical evaluation metrics, and research limitations.

---

## 1. Dataset Generation Methodology

The synthetic financial transactional dataset is generated deterministically via [database/seed.js](file:///Users/siddharthlal/Desktop/fraudlens/database/seed.js) using standard Node.js without third-party dependencies.

### Target vs. Actual Record Counts
| Entity | Target Count | Actual Generated Count | Database Status |
| :--- | :--- | :--- | :--- |
| **`customers`** | ~500 | **500** | Applied to `fraudlens_db` |
| **`accounts`** | ~800 | **800** | Applied to `fraudlens_db` |
| **`transactions`** | ~10,000 | **10,000** | Applied to `fraudlens_db` |
| **`fraud_rules`** | 3 core rules | **3** | Seeded in `fraudlens_db` |
| **`fraud_alerts`** | Deterministic triggers | **507** | Generated from rules |

### Reproducibility & Random Seeding
- Generation employs a 32-bit Linear Congruential Generator (LCG) with multiplier $a = 1664525$, increment $c = 1013904223$, modulus $m = 2^{32}$, initialized with a fixed seed `42`.
- Identical outputs are guaranteed on every run.
- Transaction references follow unique formats (`TX-HV-XXXXXXXX`, `TX-RS-XXXXXXXX`, `TX-RP-XXXXXXXX`, `TX-STD-XXXXXXXX`).
- All generated rows strictly comply with schema foreign key references and `CHECK` constraints (positive amounts, distinct source/destination accounts, non-negative account balances).

---

## 2. Ground-Truth Labeling Methodology

A critical design requirement of FraudLens is maintaining independence between **ground-truth fraud labels** (`is_fraud_ground_truth` in `transactions`) and **detector-generated alerts** (`fraud_alerts`):

1. **Independent Scenarios**:
   - High-value anomalies: 150 transactions with amounts between $10,050 and $45,000 (labeled fraudulent with a 70% independent probability).
   - High-velocity burst patterns: 50 account bursts (4–7 transactions within 45-second intervals, labeled fraudulent with an 80% independent scenario probability).
   - Rapid repeated account transfers: 60 account pairs (3–5 successive transfers within 3-minute intervals, labeled fraudulent with a 75% independent scenario probability).
   - Standard background transactions: ~9,000 baseline transfers ($5 to $8,500, labeled fraudulent with a 1.5% independent baseline probability).
2. **Decoupling Justification**:
   - Ground truth represents the actual underlying state of the world (e.g., fraudulent account takeover or authorized legitimate transfer).
   - Deterministic SQL rules detect pattern anomalies. Legitimate high-value purchases or legitimate repeated transfers should trigger alerts without being fraudulent, allowing empirical quantification of **False Positives** ($FP$) and **False Negatives** ($FN$).

---

## 3. Deterministic Fraud Rules & Configurations

Configured in `fraud_rules` and applied in [database/seed.sql](file:///Users/siddharthlal/Desktop/fraudlens/database/seed.sql):

1. **`RULE_HIGH_VAL` (High-Value Transaction)**:
   - *Severity*: `HIGH`
   - *Threshold*: `threshold_value = 10000.00`
   - *Logic*: Flags any qualifying transaction where `amount > 10000.00`.
   - *Output Alerts*: **145 alerts**.

2. **`RULE_RAPID_TX` (Rapid Successive Transactions)**:
   - *Severity*: `CRITICAL`
   - *Time Window*: `time_window_minutes = 5`
   - *Threshold*: `threshold_value = 3.00`
   - *Logic*: Flags outgoing transactions from a source account where 3 or more qualifying transactions occur within a rolling 5-minute window.
   - *Output Alerts*: **176 alerts**.

3. **`RULE_REPEAT_TRANSFER` (Repeated Transfers Between Same Accounts)**:
   - *Severity*: `MEDIUM`
   - *Time Window*: `time_window_minutes = 15`
   - *Threshold*: `threshold_value = 2.00`
   - *Logic*: Flags transfers between the identical source and destination account pair where 2 or more transfers occur within a rolling 15-minute window.
   - *Output Alerts*: **186 alerts**.

---

## 4. Alert Generation & Deduplication Strategy

Detection logic is implemented in [database/fraud_detection.sql](file:///Users/siddharthlal/Desktop/fraudlens/database/fraud_detection.sql).

### Deduplication Architecture
- **Schema Constraint**: To guarantee alert deduplication, a unique constraint `uq_alerts_tx_rule (transaction_id, rule_id)` is enforced on `fraud_alerts`.
- **Idempotent Ingestion**: Queries employ `INSERT INTO fraud_alerts ... ON DUPLICATE KEY UPDATE risk_score = VALUES(risk_score)`.
- **Status Preservation**: If an analyst updates an alert's investigation status (`REVIEWED`, `CONFIRMED_FRAUD`, `FALSE_POSITIVE`) or notes, subsequent rule evaluation runs update only calculated metrics (`risk_score`) and never overwrite the human analyst's workflow status.
- **Rerun Safety Verified**: Executing `database/fraud_detection.sql` repeatedly produces exactly 507 alerts on the first run and exactly 507 alerts on subsequent reruns with zero duplicates.

---

## 5. Research Evaluation & Confusion Matrix

Executed via [database/research_queries.sql](file:///Users/siddharthlal/Desktop/fraudlens/database/research_queries.sql) against the live database:

### Confusion Matrix on Transaction Level ($N = 10,000$)
| Metric | Ground Truth Fraud (`1`) | Ground Truth Legitimate (`0`) | Total |
| :--- | :--- | :--- | :--- |
| **Alert Generated (`1`)** | **True Positive (TP)**: 393 (3.93%) | **False Positive (FP)**: 113 (1.13%) | 506 unique tx (507 alerts) |
| **No Alert Generated (`0`)** | **False Negative (FN)**: 271 (2.71%) | **True Negative (TN)**: 9,223 (92.23%) | 9,494 unique tx |
| **Total** | 664 (6.64%) | 9,336 (93.36%) | 10,000 tx |

### Detection Performance Metrics
- **True Positive Rate (Recall / Sensitivity)**: 
  $$\text{Recall} = \frac{TP}{TP + FN} = \frac{393}{393 + 271} = 59.19\%$$
- **Precision (Positive Predictive Value)**:
  $$\text{Precision} = \frac{TP}{TP + FP} = \frac{393}{393 + 113} = 77.67\%$$
- **False Positive Rate**:
  $$\text{FPR} = \frac{FP}{FP + TN} = \frac{113}{113 + 9223} = 1.21\%$$
- **Overall Accuracy**:
  $$\text{Accuracy} = \frac{TP + TN}{Total} = \frac{393 + 9223}{10000} = 96.16\%$$

---

## 6. Limitations of Synthetic Data

1. **Synthetic Bias**: Injected burst and threshold scenarios do not fully reflect the complex, adaptive evasion techniques of real-world financial fraud syndicates.
2. **Stationary Distribution**: Real transactional volumes exhibit seasonal, diurnal, and holiday volatility that is modeled in a simplified manner here.
3. **No External Context**: Ground truth in real-world banking involves device fingerprinting, IP reputations, and off-chain dispute chargebacks, which are deliberately abstracted into relational attributes.
4. **Academic Purpose**: This dataset serves strictly as an empirical benchmark for relational schema integrity, index optimization, and SQL execution analysis.
