# FraudLens: Relational Database-Driven Financial Fraud Detection & Investigation System

An undergraduate Relational Database Management Systems (RDBMS) mini research project demonstrating financial fraud detection, alert generation, and query performance benchmarking using deterministic relational database engineering.

---

## 1. Project Overview

**FraudLens** is an end-to-end, marks-oriented RDBMS project built to investigate how transactional financial fraud detection can be modeled, executed, and optimized directly within a relational database engine. 

Modern financial platforms process thousands of high-velocity transactions daily. While machine learning is frequently discussed, core operational compliance, anti-money laundering (AML), and transaction fraud monitoring fundamentally rely on deterministic relational rules, foreign key integrity, index-backed auditability, and temporal query patterns. FraudLens implements financial accounting standards, relational normalization, trigger- or procedure-based rule evaluation, and real-time alert triage.

> **Note on Scope**: Artificial Intelligence, Machine Learning, Large Language Models, model training, and external AI APIs are **strictly out of scope** for this project. Detection is governed purely through relational algebra, SQL constraints, stored procedures, views, and deterministic rule engines.

---

## 2. Problem Statement

Financial institutions must monitor transactional activity for illicit patterns such as:
1. **Velocity Violations**: Excessive transaction frequency within short rolling windows (e.g., >3 transactions within 5 minutes).
2. **Structuring / Smurfing**: Repetitive transactions just below statutory reporting thresholds designed to evade compliance filters.
3. **Geographic Impossibility**: Transactions occurring across conflicting geographic locations within physically impossible timeframes.
4. **Sudden Value Spikes**: High-value transactions deviating significantly from established baseline customer account behavior.
5. **Dormant Account Reactivation**: High-risk sudden fund transfers originating from accounts inactive for prolonged periods.

Without careful schema modeling and index optimization, executing multi-condition temporal window checks on large transaction volumes results in full table scans, locking contention, and unsustainable latency. FraudLens addresses how to structure schemas, constraints, and indexes to sustain high query throughput while guaranteeing strict relational data integrity.

---

## 3. Objectives

- **Database Correctness**: Design a normalized relational schema (up to BCNF / 3NF) enforcing foreign keys, check constraints, domain validation, and transactional atomicity.
- **Deterministic Detection Engine**: Implement SQL-based rule evaluation (using stored procedures, views, and complex analytical queries) to flag suspicious activity without external ML dependencies.
- **Performance Benchmarking**: Conduct empirical performance experiments evaluating execution plans (`EXPLAIN ANALYZE`), index strategies (B-Tree, composite, functional), partitioning, and query execution times under scaled synthetic datasets.
- **Auditability & Investigation**: Provide an investigative web interface connecting compliance analysts to database alert states, allowing end-to-end fraud triage and case resolution.
- **Academic Rigor**: Document functional dependencies, normalization proofs, schema decisions, and performance trade-offs in a research report.

---

## 4. Core Features

- **Double-Entry & Transaction Modeling**: Relational tracking of accounts, cards, merchants, terminals, and atomic transaction records.
- **Rule-Based Fraud Scoring**: SQL-driven evaluation pipelines calculating composite risk scores and generating structured alert entries.
- **Comprehensive Audit Trail**: Immutable logging of transaction histories, rule trigger reasons, alert state updates, and compliance analyst actions.
- **Investigative Dashboard**: Visual overview of transaction volume, high-risk flagged accounts, alert queues, and rule trigger breakdowns.
- **Performance Benchmarking Suite**: Automated SQL execution scripts measuring query response times, index impacts, and plan cost comparisons under varying data volumes.

---

## 5. Technology Stack

- **Database Engine**: MySQL 8.4 LTS (configured in Docker container, exposed on port `3307` to avoid local port conflicts).
- **Backend API**: Node.js & Express (clean relational queries using `mysql2/promise` with prepared statements; no heavyweight ORMs that obscure SQL execution plans).
- **Frontend Dashboard**: React (Vite-based modern UI, clean component hierarchy, analyst triage tables, and metric summaries).
- **Environment & Virtualization**: Docker & Docker Compose for isolated, reproducible database instances.
- **Benchmarking & Analysis**: Native MySQL `EXPLAIN ANALYZE`, performance schema, and reproducible SQL performance test suites.

---

## 6. Proposed System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   React Analyst Frontend                    │
│      (Dashboard, Alert Queue, Account/Transaction Views)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / JSON (HTTP)
┌──────────────────────────────▼──────────────────────────────┐
│                    Express Backend Service                  │
│   (Prepared Statements, Connection Pool, Triage Endpoints)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ TCP / Port 3307
┌──────────────────────────────▼──────────────────────────────┐
│                    MySQL 8.4 Engine (Docker)                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  Tables (Customers, Accounts, Transactions, Merchants)   │ │
│ │  Constraints (PK, FK, CHECK, UNIQUE, NOT NULL)          │ │
│ │  Deterministic Detection Engine (Stored Procedures/Views)│ │
│ │  Indexes (Composite B-Tree, Covering, Temporal)         │ │
│ │  Audit & Alert Tables (Fraud_Alerts, Analyst_Actions)    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Planned Relational Database Entities

1. **`customers`**: Core entity holding customer identity, KYC status, registration timestamp, and risk profile.
2. **`accounts`**: Bank accounts tied to customers with balance, status, account type, and opening date.
3. **`payment_cards`**: Debit/credit cards linked to accounts with masked card numbers, status, and expiry tracking.
4. **`merchants`**: Registered merchant establishments, merchant category codes (MCC), risk ratings, and locations.
5. **`locations`**: Geo-spatial and regional reference data (latitude, longitude, city, country) for terminals and merchants.
6. **`terminals`**: Point-of-Sale (POS) or ATM terminal metadata, terminal type, and location references.
7. **`transactions`**: Central transaction log recording source account/card, destination/merchant, terminal, amount, timestamp, type, status, and currency.
8. **`fraud_rules`**: Catalog of active detection rules, weight coefficients, thresholds, and operational descriptions.
9. **`fraud_alerts`**: Detected anomalies generated by rule triggers, capturing risk score, trigger timestamp, status (`PENDING`, `REVIEWED`, `DISMISSED`, `CONFIRMED`), and assigned analyst.
10. **`alert_rule_mappings`**: Junction table establishing many-to-many relationships between generated alerts and the specific rules violated.
11. **`analyst_audit_log`**: Immutable audit records tracking review timestamps, resolution notes, and disposition decisions.

---

## 8. Research Question

> **Primary Research Question**:
> *"How do composite B-Tree indexing strategies, functional indexing, and temporal query design impact query execution plans, disk I/O, and throughput when executing multi-rule windowed fraud detection queries on transactional datasets exceeding 1,000,000 records in MySQL 8.4?"*

**Sub-questions**:
- What is the latency trade-off between evaluating rules via real-time synchronous triggers versus scheduled batch stored procedures?
- How does the addition of covering indexes on composite keys `(account_id, transaction_timestamp, amount)` mitigate query plan degradation during sliding-window velocity checks?

---

## 9. Proposed Performance Experiments

1. **Baseline vs. Optimized Indexing**:
   - Compare `SELECT` query execution times across indexed vs. unindexed schemas for rolling-window velocity aggregation (`COUNT(*)` over the previous 5 minutes).
2. **Execution Plan Inspection**:
   - Detailed analysis of `EXPLAIN ANALYZE` metrics (actual time, rows scanned, loops, temporary tables on disk) across index variations.
3. **Scalability & Scale Factor Testing**:
   - Measure query execution time across dataset scale factors: 10,000; 100,000; and 1,000,000 transaction rows.
4. **Write Overhead Trade-Off**:
   - Measure the impact of indexing density on `INSERT` throughput to quantify real-world write amplification.

---

## 10. Planned Project Structure

```
RDBMS-project/
├── frontend/                     # React investigation interface
├── backend/                      # Node.js/Express API service
├── database/                     # Relational definitions & migrations
│   ├── schema.sql                # Table definitions, constraints, types
│   ├── indexes.sql               # Baseline & optimized indexing strategies
│   └── seed.sql                  # Deterministic synthetic test data
├── experiments/                  # SQL benchmarking scripts & logs
│   ├── queries/                  # Test query workloads
│   └── benchmarks/               # Execution time collection scripts
├── datasets/                     # Seed generators and data dictionaries
├── reports/                      # Academic research paper, diagrams & notes
├── docs/                         # Specifications & implementation plans
│   └── PROJECT_PLAN.md           # Engineering scope & milestones
├── .env.example                  # Environment template
├── .gitignore                    # Version control exclusions
├── GEMINI.md                     # Project specification & instruction tracker
└── README.md                     # Project overview and reference guide
```

---

## 11. Development Roadmap

- [x] **Phase 1**: Repository foundation, project structure, and documentation.
- [x] **Phase 2**: Dedicated MySQL Docker configuration and connectivity verification.
- [x] **Phase 3**: Conceptual modeling (ER diagram), functional dependencies, and normalization proofs.
- [x] **Phase 4**: Physical SQL schema implementation, strict constraints, and realistic seed data.
- [x] **Phase 5**: Express backend API service and MySQL integration.
- [x] **Phase 6**: React dashboard and triage investigation interface.
- [ ] **Phase 7**: Structured query performance experiments and execution plan analysis.
- [ ] **Phase 8**: Integration testing, edge-case validation, and refinement.
- [ ] **Phase 9**: Final research paper and project defense deliverables.

---

## 12. Database Operations & Verified Instructions

### Prerequisites
- Docker Desktop (active and running on macOS).
- Git.

### 1. Configure Local Environment
Create your local `.env` from the template (if not already present):
```bash
cp .env.example .env
```
*(Ensure `.env` contains your desired passwords; `.env` is ignored by Git and will never be committed).*

### 2. Start the Dedicated Database Service
Start the isolated `fraudlens-mysql` container in the background:
```bash
docker compose up -d
```

### 3. Check Container Health & Status
Verify the container is healthy and bound to host port `3307`:
```bash
docker compose ps
```
Or inspect container health:
```bash
docker inspect fraudlens-mysql --format '{{.State.Status}} (Health: {{.State.Health.Status}})'
```

### 4. View Container Logs
Follow the MySQL server logs:
```bash
docker compose logs -f mysql
```

### 5. Open MySQL Interactive Shell
Access the interactive MySQL CLI inside the dedicated container using the project application user:
```bash
docker exec -it fraudlens-mysql mysql -u fraudlens_user -p fraudlens_db
```
*(When prompted, enter the password configured in `.env`).*

To access as root for administrative tasks:
```bash
docker exec -it fraudlens-mysql mysql -u root -p
```

### 6. Stop Database (Preserving Persistent Data)
Stop the container without removing the persistent volume `fraudlens_mysql_data`:
```bash
docker compose stop
```
*(Or `docker compose down`—note: do NOT pass `-v` so persistent database data is preserved).*

### 7. Reconnect After Restart
To resume work:
```bash
docker compose up -d
docker exec -it fraudlens-mysql mysql -u fraudlens_user -p fraudlens_db
```

---

## 13. Backend API Service Execution

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Run the Express Backend Server
```bash
npm run dev
```
The server will start on port `5001` (or the `PORT` specified in `.env`) and automatically connect to `fraudlens_db` via the connection pool.

### 3. Run Automated Backend Tests
```bash
npm test
```

---

## 14. Frontend Application Execution Instructions

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run the React Vite Dev Server
```bash
npm run dev
```
The application will launch on `http://localhost:3000` with the API proxy routing requests to `http://localhost:5001/api`.

### 3. Build Production Bundle
```bash
npm run build
```
