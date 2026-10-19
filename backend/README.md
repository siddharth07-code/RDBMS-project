# FraudLens: Backend Service Specification & API Documentation

The FraudLens backend is a lightweight, high-performance Node.js & Express REST API that interfaces directly with the Dockerized MySQL database engine. It provides data endpoints for the compliance investigation dashboard, transaction explorer, alert management, and research performance metrics.

---

## 1. Prerequisites & Environment Configuration

- **Runtime**: Node.js v20+ (developed on v24.15.0).
- **Database**: Dedicated MySQL container `fraudlens-mysql` active and listening on `127.0.0.1:3307`.
- **Configuration**:
  - The backend automatically reads database credentials from the root `.env` or local `backend/.env`.
  - Placeholder environment template is provided in [backend/.env.example](file:///Users/siddharthlal/Desktop/fraudlens/backend/.env.example).

```bash
PORT=5001
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=fraudlens_db
DB_USER=fraudlens_user
DB_PASSWORD=replace_with_local_password
```

---

## 2. Installation & Startup Commands

From the `backend/` directory:

```bash
# Install minimal dependencies
npm install

# Start production server on port 5001
npm start

# Start development mode with auto-reload
npm run dev

# Run automated integration test suite
npm test
```

---

## 3. Implemented REST API Endpoints

### 3.1. System Health
- **`GET /api/health`**
  - Verifies Node server and MySQL pool connectivity (`SELECT 1`).
  - *Response (200 OK)*:
    ```json
    {
      "status": "UP",
      "database": "CONNECTED",
      "timestamp": "2026-10-19T13:35:00.000Z"
    }
    ```

### 3.2. Dashboard Aggregations
- **`GET /api/dashboard/summary`**
  - Aggregates live transaction counts, volume, status breakdowns, ground-truth fraud counts, and pending alert counts.
  - *Response (200 OK)*:
    ```json
    {
      "transactions": {
        "total_count": 10000,
        "total_volume": 13496862.89,
        "by_status": { "success": 9261, "failed": 490, "blocked": 201, "flagged": 48 },
        "ground_truth_fraud_count": 664
      },
      "alerts": {
        "total_alerts": 507,
        "pending_investigation": 507,
        "by_status": { "pending": 507, "reviewed": 0, "confirmed_fraud": 0, "false_positive": 0 }
      }
    }
    ```

- **`GET /api/dashboard/transaction-trends`**
  - Returns daily transaction volume, transaction counts, and fraud counts for time-series charts.

- **`GET /api/dashboard/alerts-by-rule`**
  - Returns alert counts and average risk scores grouped by active fraud rule.

### 3.3. Transaction Ledger
- **`GET /api/transactions`**
  - *Query Parameters*: `page` (default 1), `limit` (default 20, max 100), `search` (transaction reference substring), `status` (`SUCCESS`, `FAILED`, `FLAGGED`, `BLOCKED`), `transaction_type`, `is_fraud_ground_truth` (0 or 1), `start_date`, `end_date`, `sort_by` (`transaction_timestamp`, `amount`, `transaction_id`, etc.), `order` (`ASC` or `DESC`).
  - Fully parameterized; all filters and allowlists validated against SQL injection.
  - Returns paginated data and pagination metadata (`total`, `page`, `limit`, `total_pages`).

- **`GET /api/transactions/:id`**
  - Returns complete transaction details with relational joins to `accounts` and `customers` for both source and destination accounts, plus any triggered alerts.
  - Returns `404` if not found, `400` if invalid ID.

### 3.4. Fraud Alerts & Investigation Workflow
- **`GET /api/alerts`**
  - *Query Parameters*: `page`, `limit`, `status` (`PENDING`, `REVIEWED`, `CONFIRMED_FRAUD`, `FALSE_POSITIVE`), `rule_code`, `search`, `sort_by`, `order`.
  - Returns paginated alerts with associated transaction references, amounts, rules, and timestamps.

- **`GET /api/alerts/:id`**
  - Returns specific alert details, associated rule parameters, and joined transaction/account/customer details.

- **`PATCH /api/alerts/:id/status`**
  - Updates an alert's investigation status and notes.
  - *Request Body*:
    ```json
    {
      "status": "REVIEWED",
      "investigation_notes": "Analyst reviewed transaction; confirmed legitimate customer behavior."
    }
    ```
  - *Restrictions*: Enforces status enum (`PENDING`, `REVIEWED`, `CONFIRMED_FRAUD`, `FALSE_POSITIVE`). Prohibits altering transaction ground truth, amounts, or rule links. Automatically sets `resolved_at` on non-pending statuses.

### 3.5. Research & Benchmarking Analytics
- **`GET /api/research/fraud-metrics`**
  - Computes the transaction-level confusion matrix against ground truth without duplicate counting.
  - Returns `true_positives` (393), `false_positives` (113), `false_negatives` (271), `true_negatives` (9,223), `precision` (0.7767), `recall` (0.5919), and `accuracy` (0.9616).

- **`GET /api/research/rule-performance`**
  - Evaluates per-rule alert counts, unique transactions flagged, true positive transactions, and rule precision.

---

## 4. Error Response Format

All error responses return structured, sanitized JSON without exposing database credentials, internal SQL queries, or stack traces:

```json
{
  "error": "Invalid status. Allowed values: PENDING, REVIEWED, CONFIRMED_FRAUD, FALSE_POSITIVE",
  "status": 400
}
```

```json
{
  "error": "Transaction not found",
  "status": 404
}
```

---

## 5. Automated Test Suite

Run integration tests via:
```bash
npm test
```
The test suite spins up the Express server on an isolated port (`5099`), verifies all 18 endpoints and validation rules against `fraudlens_db`, tests SQL injection resilience, updates and cleanly restores alert test records, and asserts exact metric invariants.
