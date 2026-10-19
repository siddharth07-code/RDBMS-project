# FraudLens: Engineering & Research Project Plan

This document establishes the formal engineering scope, requirements, relational design principles, research methodology, implementation milestones, and deliverables for the **FraudLens** RDBMS research project.

---

## 1. Project Scope

FraudLens is designed as an academic, marks-oriented relational database project demonstrating rigorous database engineering and empirical performance evaluation.

### In Scope
- Conceptual, logical, and physical relational modeling of banking and payment transaction systems.
- Strict constraint enforcement (primary keys, foreign keys with referential actions, `CHECK` constraints, `UNIQUE` constraints, `NOT NULL`).
- Normalization verification (up to 3NF / BCNF) with explicit functional dependency definitions.
- Deterministic SQL-based fraud detection rules implemented via stored procedures, analytical window functions, and views.
- Triage workflow modeling (audit tables, alert assignment, resolution states).
- Systematic query performance benchmarking using MySQL 8.4's `EXPLAIN ANALYZE` and execution metrics.
- Full-stack reporting interface (Node.js/Express backend + React frontend) connecting compliance analysts directly to operational database views.
- Academic research report documenting database trade-offs and experimental findings.

### Out of Scope
- Artificial Intelligence (AI), Machine Learning (ML), Large Language Models (LLMs), neural networks, or predictive scoring models.
- External cloud third-party AI APIs or black-box classifiers.
- Live external payment gateway integration (Stripe, Visa Direct, etc.).
- Multi-region distributed consensus protocols or NoSQL datastores.

---

## 2. Functional Requirements

1. **Account & Entity Management**:
   - Store and maintain customers, accounts, cards, merchants, and POS/ATM terminals.
   - Enforce customer-to-account and account-to-card referential integrity.
2. **Transaction Ingestion & Processing**:
   - Record atomic transaction entries with accurate monetary amounts (using exact `DECIMAL` types), timestamps, source/destination accounts, and merchant categories.
3. **Automated Rule Evaluation**:
   - Execute deterministic detection algorithms across transaction batches or events.
   - Compute aggregate risk scores based on triggered rules.
4. **Alert Generation & Workflow**:
   - Generate structured alert records in `fraud_alerts` when risk thresholds are exceeded.
   - Maintain historical records of alerts with resolution statuses (`PENDING`, `REVIEWED`, `DISMISSED`, `CONFIRMED`).
5. **Auditing & Compliance Logging**:
   - Log all analyst actions, status transitions, and notes in an immutable audit table (`analyst_audit_log`).
6. **Query & Performance Exploration**:
   - Provide query endpoints capable of filtering transactions, alerts, and customer activity across time windows without table lockups.

---

## 3. Non-Functional Requirements

1. **Data Accuracy & Precision**:
   - Currency and financial amounts must use `DECIMAL(15, 2)` or equivalent exact types to eliminate floating-point rounding errors.
2. **Referential Integrity**:
   - Every transaction must link to valid source and destination entities; orphan records are prohibited via foreign key constraints.
3. **Deterministic Predictability**:
   - Rule executions must yield identical results given identical transaction histories (fully reproducible compliance audit trail).
4. **Performance & Optimization**:
   - Time-windowed analytical queries on 100,000+ transactions must execute with sub-second response times when supported by appropriate composite indexes.
5. **Security & Isolation**:
   - Database credentials isolated via environment variables (`.env`).
   - Prepared statements throughout backend queries to prevent SQL injection.
6. **Containerization**:
   - Database service containerized via Docker on port `3307`, ensuring platform independence and isolated configuration.

---

## 4. Database Design Objectives

- **Normalization**: Eliminate insert, update, and delete anomalies by achieving Boyce-Codd Normal Form (BCNF) or Third Normal Form (3NF) across all operational entities.
- **Data Integrity Constraints**:
  - `CHECK` constraints on amounts (`amount > 0`), valid status enumerations, and temporal logic (e.g., expiry date > creation date).
  - Explicit foreign key constraint cascade/restrict actions.
- **Index Engineering**:
  - Primary clustered B-tree index design.
  - Secondary composite B-tree indexes for multi-column temporal predicates: `(account_id, transaction_timestamp)`.
  - Covering indexes to satisfy high-frequency triage queries solely within the index tree (Index-Only Scans).
- **Partitioning Consideration**:
  - Evaluate range partitioning by date (`transaction_timestamp`) for archiving and accelerated pruning of historical logs.

---

## 5. Proposed Fraud Detection Rules

All fraud rules are deterministic and evaluated using pure relational SQL queries:

1. **Velocity Spike Rule**:
   - *Condition*: More than 3 transactions on the same account within a rolling 5-minute window.
   - *SQL Mechanism*: Window function `COUNT(*) OVER (PARTITION BY account_id ORDER BY transaction_timestamp RANGE BETWEEN INTERVAL 5 MINUTE PRECEDING AND CURRENT ROW)`.
2. **Structuring / Smurfing Rule**:
   - *Condition*: Multiple transactions (>= 2) between $9,000 and $9,999 within 24 hours on a single account (designed to evade statutory $10,000 AML reporting limits).
   - *SQL Mechanism*: Range aggregation grouped by account and day.
3. **Geographic Impossibility Rule**:
   - *Condition*: Two consecutive physical terminal transactions on the same card within 1 hour occurring at locations separated by > 300 km.
   - *SQL Mechanism*: Self-join on consecutive transactions with Haversine distance computation.
4. **Sudden Outlier Rule**:
   - *Condition*: Transaction amount greater than 5x the customer's average transaction amount over the previous 90 days.
   - *SQL Mechanism*: Correlated subquery or CTE comparing current amount against historical account baseline.
5. **High-Risk MCC & Dormant Account Transfer**:
   - *Condition*: Account with no transaction activity for > 180 days suddenly issuing a transaction > $5,000 to a high-risk Merchant Category Code (e.g., crypto exchange, gambling).
   - *SQL Mechanism*: Temporal lag inspection combined with merchant risk tier joins.

---

## 6. Research Methodology

1. **Hypothesis Formulation**:
   - Composite B-Tree indexing on `(account_id, transaction_timestamp, amount)` significantly reduces buffer pool read requests and eliminates temporary filesort operations during rolling window fraud queries.
2. **Data Generation Strategy**:
   - Develop a deterministic synthetic data generator creating realistic distribution curves (Pareto/Zipf distributions for merchant transactions, realistic timestamps, injected synthetic fraud patterns).
   - Target scale factors: 10,000; 100,000; and 1,000,000 transaction records.
3. **Measurement Metrics**:
   - Execution Time (`EXPLAIN ANALYZE` actual time).
   - Cost Metric (MySQL Query Optimizer estimated cost).
   - Buffer Pool Reads & Logical I/O.
   - Write Performance penalty on `INSERT` operations under varying indexing loads.
4. **Validation & Reproducibility**:
   - Parameterized SQL benchmark scripts running warm and cold cache runs to produce empirical tables and charts.

---

## 7. Implementation Phases

```
┌────────────────────────────────────────────────────────┐
│ Phase 1: Repository Foundation & Documentation (Active)│
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 2: MySQL Docker Setup & Port 3307 Connectivity   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 3: ER Modeling, Dependencies & Normalization     │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 4: SQL Schema, Constraints, Indexes & Seed Data  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 5: Stored Procedures, Views & Detection Engine   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 6: Express Backend API Service                   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 7: React Analyst Interface & Dashboard           │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 8: Query Performance Experiments & Benchmarks    │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 9: Integration Testing & Verification            │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 10: Final Academic Research Report               │
└────────────────────────────────────────────────────────┘
```

- **Phase 1**: Repository foundation, project structure, documentation, and configuration templates. *(Current Phase)*
- **Phase 2**: MySQL 8.4 Docker Compose setup on port `3307`, health checks, and connection verification.
- **Phase 3**: Conceptual entity-relationship modeling, formal functional dependencies, and 3NF/BCNF normalization proofs.
- **Phase 4**: Physical DDL implementation (`database/schema.sql`, `database/indexes.sql`, and `database/seed.sql`).
- **Phase 5**: SQL-based detection implementation (deterministic stored procedures, window queries, and alert triggers).
- **Phase 6**: Node.js/Express backend service implementing connection pooling, parameterized queries, and REST endpoints.
- **Phase 7**: React dashboard with analyst queue, transaction explorer, and fraud metric visualization.
- **Phase 8**: Structured performance experiments comparing indexed vs. unindexed query plans, data scaling, and index overhead.
- **Phase 9**: End-to-end integration testing, schema constraint validation, and error-handling tests.
- **Phase 10**: Final research paper and viva presentation deliverables.

---

## 8. Testing Strategy

1. **Schema Integrity Testing**:
   - Attempt insertion of negative amounts, orphan foreign keys, invalid enum values, and duplicate primary keys to verify rejection by MySQL constraints.
2. **Rule Detection Unit Tests**:
   - Provide controlled seed transaction scenarios that must reliably trigger each of the 5 fraud rules.
3. **API Integration Tests**:
   - Verify HTTP endpoint responses, prepared statement parameter handling, and transaction isolation levels.
4. **Performance Regression Tests**:
   - Automated benchmark runs verifying query execution stability across multiple iterations.

---

## 9. Final Deliverables

1. **Working Relational Database**: Dockerized MySQL 8.4 setup with schema DDL, constraints, indexes, and synthetic datasets.
2. **Production-Quality Source Code**:
   - Clean Express backend with prepared statements.
   - Polished React analyst dashboard.
3. **Performance Experimentation Suite**:
   - Reproducible benchmark scripts and output execution plans (`EXPLAIN ANALYZE`).
4. **Academic Documentation**:
   - Comprehensive README and formal project plan.
   - Comprehensive final research report in `reports/` with ER diagrams, normalization proofs, SQL execution plan breakdowns, and empirical performance graphs.
