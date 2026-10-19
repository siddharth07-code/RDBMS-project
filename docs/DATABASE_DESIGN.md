# FraudLens: Database Design & Relational Normalization Specification

This document presents the relational database design, schema rationale, formal functional dependencies, and normal form proofs (1NF, 2NF, 3NF/BCNF) for the **FraudLens** financial fraud detection system.

---

## 1. Relational Entities & Design Objectives

The schema models an operational financial transaction monitoring environment centered on five core relations:

1. **`customers`**: Represents the biological or legal customer entity, holding KYC compliance attributes and identity references.
2. **`accounts`**: Represents individual depository or transactional accounts belonging to a customer.
3. **`transactions`**: Immutable ledger of financial transfers between distinct accounts, recording execution timestamps, transaction channels, amounts, and a ground-truth fraud label (`is_fraud_ground_truth`).
4. **`fraud_rules`**: Catalog of parameterized detection criteria (velocity thresholds, amounts, sliding time windows) evaluating transactional risk.
5. **`fraud_alerts`**: Event-driven alert entries generated when transactions trigger specific rules, tracking investigation triage status (`PENDING`, `REVIEWED`, `CONFIRMED_FRAUD`, `FALSE_POSITIVE`) and composite risk scores.

### Key Architectural Decisions
- **Separation of Concerns**: Ground truth labels (`is_fraud_ground_truth` on `transactions`) are decoupled from detector-generated alerts (`fraud_alerts`). This allows empirical evaluation of false positives and false negatives without circular dependency.
- **Double-Entry Association**: Transactions explicitly link `source_account_id` and `destination_account_id` via foreign keys to `accounts`, enforcing the invariant that both endpoints exist in the ledger.
- **Strict Invariants**: `CHECK` constraints prevent non-positive transaction amounts (`amount > 0.00`), self-transfers (`source_account_id <> destination_account_id`), and negative account balances (`balance >= 0.00`).
- **Auditability**: Referential actions are configured as `ON UPDATE RESTRICT ON DELETE RESTRICT` across all operational relationships, preventing accidental cascading deletions of financial histories.

---

## 2. Table Schemas, Keys, and Constraints

### 2.1. Relation: `customers`
- **Primary Key**: `customer_id`
- **Candidate Keys**: `customer_id`, `email`, `phone_number`
- **Attributes**:
  - `customer_id` BIGINT AUTO_INCREMENT
  - `first_name` VARCHAR(50) NOT NULL
  - `last_name` VARCHAR(50) NOT NULL
  - `email` VARCHAR(100) NOT NULL UNIQUE
  - `phone_number` VARCHAR(20) NOT NULL UNIQUE
  - `kyc_status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING'
  - `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.2. Relation: `accounts`
- **Primary Key**: `account_id`
- **Candidate Keys**: `account_id`, `account_number`
- **Foreign Keys**: `customer_id` REFERENCES `customers(customer_id)`
- **Attributes**:
  - `account_id` BIGINT AUTO_INCREMENT
  - `account_number` VARCHAR(20) NOT NULL UNIQUE
  - `customer_id` BIGINT NOT NULL
  - `account_type` ENUM('CHECKING', 'SAVINGS', 'BUSINESS') NOT NULL
  - `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00 (`CHECK (balance >= 0.00)`)
  - `status` ENUM('ACTIVE', 'FROZEN', 'CLOSED') NOT NULL DEFAULT 'ACTIVE'
  - `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.3. Relation: `transactions`
- **Primary Key**: `transaction_id`
- **Candidate Keys**: `transaction_id`, `transaction_reference`
- **Foreign Keys**:
  - `source_account_id` REFERENCES `accounts(account_id)`
  - `destination_account_id` REFERENCES `accounts(account_id)`
- **Attributes**:
  - `transaction_id` BIGINT AUTO_INCREMENT
  - `transaction_reference` VARCHAR(36) NOT NULL UNIQUE
  - `source_account_id` BIGINT NOT NULL
  - `destination_account_id` BIGINT NOT NULL
  - `amount` DECIMAL(15, 2) NOT NULL (`CHECK (amount > 0.00)`)
  - `transaction_type` ENUM('TRANSFER', 'PAYMENT', 'WITHDRAWAL', 'DEPOSIT') NOT NULL
  - `status` ENUM('SUCCESS', 'FAILED', 'FLAGGED', 'BLOCKED') NOT NULL DEFAULT 'SUCCESS'
  - `is_fraud_ground_truth` TINYINT(1) NOT NULL DEFAULT 0 (`CHECK (is_fraud_ground_truth IN (0, 1))`)
  - `transaction_timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  - `CHECK (source_account_id <> destination_account_id)`

### 2.4. Relation: `fraud_rules`
- **Primary Key**: `rule_id`
- **Candidate Keys**: `rule_id`, `rule_code`
- **Attributes**:
  - `rule_id` BIGINT AUTO_INCREMENT
  - `rule_code` VARCHAR(30) NOT NULL UNIQUE
  - `rule_name` VARCHAR(100) NOT NULL
  - `description` VARCHAR(255) NOT NULL
  - `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM'
  - `is_active` TINYINT(1) NOT NULL DEFAULT 1 (`CHECK (is_active IN (0, 1))`)
  - `threshold_value` DECIMAL(15, 2) NULL (`CHECK (threshold_value IS NULL OR threshold_value > 0.00)`)
  - `time_window_minutes` INT NULL (`CHECK (time_window_minutes IS NULL OR time_window_minutes > 0)`)
  - `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.5. Relation: `fraud_alerts`
- **Primary Key**: `alert_id`
- **Foreign Keys**:
  - `transaction_id` REFERENCES `transactions(transaction_id)`
  - `rule_id` REFERENCES `fraud_rules(rule_id)`
- **Attributes**:
  - `alert_id` BIGINT AUTO_INCREMENT
  - `transaction_id` BIGINT NOT NULL
  - `rule_id` BIGINT NOT NULL
  - `risk_score` DECIMAL(5, 2) NOT NULL (`CHECK (risk_score >= 0.00 AND risk_score <= 100.00)`)
  - `status` ENUM('PENDING', 'REVIEWED', 'CONFIRMED_FRAUD', 'FALSE_POSITIVE') NOT NULL DEFAULT 'PENDING'
  - `investigation_notes` VARCHAR(500) NULL
  - `triggered_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  - `resolved_at` TIMESTAMP NULL

---

## 3. Formal Functional Dependencies

### Customer Relation ($R_{customers}$)
- $\text{FD}_1: \text{customer\_id} \rightarrow \{\text{first\_name, last\_name, email, phone\_number, kyc\_status, created\_at}\}$
- $\text{FD}_2: \text{email} \rightarrow \{\text{customer\_id, first\_name, last\_name, phone\_number, kyc\_status, created\_at}\}$
- $\text{FD}_3: \text{phone\_number} \rightarrow \{\text{customer\_id, first\_name, last\_name, email, kyc\_status, created\_at}\}$

### Account Relation ($R_{accounts}$)
- $\text{FD}_4: \text{account\_id} \rightarrow \{\text{account\_number, customer\_id, account\_type, balance, status, created\_at}\}$
- $\text{FD}_5: \text{account\_number} \rightarrow \{\text{account\_id, customer\_id, account\_type, balance, status, created\_at}\}$

### Transaction Relation ($R_{transactions}$)
- $\text{FD}_6: \text{transaction\_id} \rightarrow \{\text{transaction\_reference, source\_account\_id, destination\_account\_id, amount, transaction\_type, status, is\_fraud\_ground\_truth, transaction\_timestamp}\}$
- $\text{FD}_7: \text{transaction\_reference} \rightarrow \{\text{transaction\_id, source\_account\_id, destination\_account\_id, amount, transaction\_type, status, is\_fraud\_ground\_truth, transaction\_timestamp}\}$

### Fraud Rule Relation ($R_{fraud\_rules}$)
- $\text{FD}_8: \text{rule\_id} \rightarrow \{\text{rule\_code, rule\_name, description, severity, is\_active, threshold\_value, time\_window\_minutes, created\_at}\}$
- $\text{FD}_9: \text{rule\_code} \rightarrow \{\text{rule\_id, rule\_name, description, severity, is\_active, threshold\_value, time\_window\_minutes, created\_at}\}$

### Fraud Alert Relation ($R_{fraud\_alerts}$)
- $\text{FD}_{10}: \text{alert\_id} \rightarrow \{\text{transaction\_id, rule\_id, risk\_score, status, investigation\_notes, triggered\_at, resolved\_at}\}$

---

## 4. Normalization Proofs

### 4.1. First Normal Form (1NF)
**Definition**: A relation is in 1NF if and only if all attribute values are atomic (indivisible) and there are no repeating groups or multivalued attributes.
- **Atomic Domains**: All columns store single scalar values (`VARCHAR`, `BIGINT`, `DECIMAL`, `TIMESTAMP`, `ENUM`).
- **No Repeating Groups**: Transactions do not store an array or delimited list of triggered rules. Instead, each alert is an atomic record in `fraud_alerts`.
- **Verdict**: Satisfies 1NF.

### 4.2. Second Normal Form (2NF)
**Definition**: A relation is in 2NF if it is in 1NF and every non-prime attribute is fully functionally dependent on the primary key (no partial functional dependencies).
- **Single-Attribute Primary Keys**: In all 5 tables (`customer_id`, `account_id`, `transaction_id`, `rule_id`, `alert_id`), the primary key consists of exactly one attribute.
- **Proof**: Partial dependency requires a composite candidate key where a proper subset determines a non-prime attribute ($X \subset K$ such that $X \rightarrow Y$). Because no candidate key is composite, no proper subset can exist. Thus, partial dependencies are mathematically impossible.
- **Verdict**: Satisfies 2NF.

### 4.3. Third Normal Form (3NF) & BCNF
**Definition**: A relation is in 3NF if whenever a non-trivial functional dependency $X \rightarrow Y$ holds, either $X$ is a superkey or $Y$ is a prime attribute (part of a candidate key).
- In each table, every determinant $X$ in the functional dependencies above is a candidate key:
  - In `customers`: `customer_id`, `email`, and `phone_number` are all unique superkeys.
  - In `accounts`: `account_id` and `account_number` are unique superkeys.
  - In `transactions`: `transaction_id` and `transaction_reference` are unique superkeys.
  - In `fraud_rules`: `rule_id` and `rule_code` are unique superkeys.
  - In `fraud_alerts`: `alert_id` is a unique superkey.
- **Transitive Dependency Elimination**:
  - *Customer Data in Transactions*: If customer name or address were stored in `transactions`, we would have:
    $$\text{transaction\_id} \rightarrow \text{source\_account\_id} \rightarrow \text{customer\_id} \rightarrow \text{customer\_name}$$
    Because `source_account_id` is not a superkey of `transactions`, this would introduce a transitive dependency causing update and delete anomalies. By decomposing into `customers`, `accounts`, and `transactions`, every determinant is a superkey.
  - *Rule Descriptions in Alerts*: If `rule_name` and `threshold_value` were duplicated in `fraud_alerts`, updating a rule parameter would leave alerts inconsistent. By referencing `rule_id`, alert records remain strictly 3NF/BCNF.
- **Verdict**: Satisfies 3NF and Boyce-Codd Normal Form (BCNF).

---

## 5. Justification of Design Trade-offs

1. **Surrogate Keys vs. Natural Keys**:
   - `BIGINT AUTO_INCREMENT` is chosen for primary keys to ensure compact, high-efficiency clustered index structures in InnoDB. Natural business keys (`account_number`, `transaction_reference`, `rule_code`) are enforced with secondary `UNIQUE` constraints.
2. **Ground-Truth Fraud vs. Generated Alerts**:
   - Machine learning and empirical research evaluations require an objective baseline. Storing `is_fraud_ground_truth` on `transactions` allows standard SQL confusion matrix calculation (True Positives, False Positives, False Negatives) by comparing against `fraud_alerts`.
3. **Absence of Redundant Aggregates**:
   - Customer total transaction counts and rolling velocity counts are deliberately omitted as stored attributes on `accounts`. Storing running counters introduces locking contention on high-frequency writes and violates normalization principles. Sliding metrics are dynamically evaluated via SQL window functions.
