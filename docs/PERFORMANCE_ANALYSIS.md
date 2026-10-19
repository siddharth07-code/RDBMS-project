# FraudLens: SQL Indexing and Empirical Performance Analysis

This report documents the empirical query performance evaluation conducted for the **FraudLens** financial fraud detection research project.

---

## 1. Research Question & Objectives

> **Primary Research Question**:
> *"How does database indexing affect the execution performance of SQL-based suspicious transaction detection queries in MySQL under varying transaction scale factors?"*

### Objectives
1. Quantify the execution time impact of candidate B-tree secondary indexes across five representative financial fraud detection query categories.
2. Inspect physical query execution plans via `EXPLAIN ANALYZE` to observe plan transformations (table scans vs. index range scans, nested loop joins, temporary table aggregations).
3. Evaluate index scaling behavior across two dataset magnitudes ($N = 10,000$ and $N = 100,000$ transactions).
4. Measure the physical storage footprint and identify query regression risks introduced by index selection.

---

## 2. Experimental Environment & System Specifications

All experiments were executed on an isolated Dockerized MySQL database:
- **Database Engine**: Oracle MySQL Community Server - GPL
- **Engine Version**: `26.7.0` (InnoDB storage engine)
- **Host OS / Architecture**: macOS (Darwin aarch64, Apple Silicon)
- **Container Host Port**: `127.0.0.1:3307`
- **InnoDB Buffer Pool Size**: `134,217,728` bytes (128 MB)
- **Isolation Guarantee**: All tests were run against a dedicated, isolated database `fraudlens_benchmark`. The production database `fraudlens_db` remained strictly untouched.

---

## 3. Dataset Characteristics

Benchmarks evaluated two scaling tiers generated deterministically via an LCG random number generator (seed `42`):

| Scale Tier | Customers | Accounts | Transactions | Fraud Alerts | Total Volume ($) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **$N = 10,000$** | 500 | 800 | 10,000 | 318 | $13.5M |
| **$N = 100,000$** | 2,500 | 4,000 | 100,000 | 3,286 | $135.2M |

---

## 4. Benchmark Query Workload

Five representative operational fraud detection query categories were evaluated:

1. **Query A (High-Value Threshold Filter)**:
   - *Predicate*: `amount > 25000.00 ORDER BY amount DESC`
   - *Target Index*: `idx_tx_amount ON transactions(amount)`
2. **Query B (Rapid Successive Transactions Window Join)**:
   - *Predicate*: Temporal self-join on `t1.source_account_id = t2.source_account_id` within 5-minute rolling window, filtering `COUNT(*) >= 3`
   - *Target Index*: `idx_tx_source_timestamp ON transactions(source_account_id, transaction_timestamp)`
3. **Query C (Repeated Pair Transfers Window Join)**:
   - *Predicate*: Pairwise temporal self-join on `(source_account_id, destination_account_id)` within 15-minute rolling window, filtering `COUNT(*) >= 2`
   - *Target Index*: `idx_tx_pair_timestamp ON transactions(source_account_id, destination_account_id, transaction_timestamp)`
4. **Query D (Transaction Status & Date Range Scan)**:
   - *Predicate*: `status = 'SUCCESS' AND transaction_timestamp BETWEEN '2026-10-05' AND '2026-10-08' ORDER BY transaction_timestamp DESC LIMIT 100`
   - *Target Index*: `idx_tx_status_timestamp ON transactions(status, transaction_timestamp)`
5. **Query E (Multi-Table Alert Investigation Join)**:
   - *Predicate*: Four-table join (`fraud_alerts`, `fraud_rules`, `transactions`, `accounts`) filtering `a.status = 'PENDING' AND a.risk_score >= 75.00`
   - *Target Index*: `idx_alerts_status_risk ON fraud_alerts(status, risk_score)`

---

## 5. Candidate Indexing Strategy

In `database/indexes.sql`, the following candidate indexes were applied in the **Indexed** configuration:
```sql
CREATE INDEX idx_tx_amount ON transactions(amount);
CREATE INDEX idx_tx_source_timestamp ON transactions(source_account_id, transaction_timestamp);
CREATE INDEX idx_tx_pair_timestamp ON transactions(source_account_id, destination_account_id, transaction_timestamp);
CREATE INDEX idx_tx_status_timestamp ON transactions(status, transaction_timestamp);
CREATE INDEX idx_alerts_status_risk ON fraud_alerts(status, risk_score);
```
In the **Baseline** configuration, all candidate indexes were removed, leaving only the primary clustered index (`PRIMARY`) and foreign key reference indexes (`fk_tx_source_account`, `fk_tx_destination_account`).

---

## 6. Empirical Measurement Results

Measurements were collected using high-resolution monotonic timestamps (`process.hrtime.bigint()`). Each configuration underwent 1 warm-up run followed by **5 measured iterations**. The median execution times (in milliseconds) and speedup percentages are summarized below:

$$\text{Speedup \%} = \frac{\text{Baseline Median} - \text{Indexed Median}}{\text{Baseline Median}} \times 100$$

### Summary Table ($N = 10,000$ and $N = 100,000$)

| Dataset Scale | Query Identifier | Baseline Median (ms) | Indexed Median (ms) | Absolute Difference (ms) | Performance Impact (%) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **10,000** | **Query A** (Amount Filter) | 1.408 | 0.382 | +1.026 | **+72.87%** (Faster) |
| **10,000** | **Query B** (Velocity Self-Join) | 20.690 | 32.789 | -12.099 | **-58.48%** (Regression) |
| **10,000** | **Query C** (Pair Transfer Join) | 7.735 | 16.155 | -8.420 | **-108.86%** (Regression) |
| **10,000** | **Query D** (Status & Date Scan) | 2.398 | 0.604 | +1.794 | **+74.81%** (Faster) |
| **10,000** | **Query E** (Alert Multi-Join) | 0.894 | 0.558 | +0.336 | **+37.58%** (Faster) |
| **100,000** | **Query A** (Amount Filter) | 12.789 | 1.444 | +11.345 | **+88.71%** (Faster) |
| **100,000** | **Query B** (Velocity Self-Join) | 1,426.474 | 473.711 | +952.763 | **+66.79%** (Faster) |
| **100,000** | **Query C** (Pair Transfer Join) | 1,113.303 | 148.790 | +964.513 | **+86.64%** (Faster) |
| **100,000** | **Query D** (Status & Date Scan) | 20.701 | 0.826 | +19.875 | **+96.01%** (Faster) |
| **100,000** | **Query E** (Alert Multi-Join) | 1.194 | 4.506 | -3.312 | **-277.39%** (Regression) |

---

## 7. Execution Plan Analysis (`EXPLAIN ANALYZE`)

Inspection of physical execution plans explains the observed execution time differences:

### 7.1. Query A (High-Value Threshold Filter at 100k rows)
- **Baseline Plan**:
  ```text
  -> Sort: transactions.amount DESC (actual time=14.9..14.9 rows=816 loops=1)
      -> Filter: (transactions.amount > 25000.00) (actual time=0.0215..14.8 rows=816 loops=1)
          -> Table scan on transactions (actual time=0.00275..11.2 rows=100000 loops=1)
  ```
  *Analysis*: Baseline requires a full table scan across all 100,000 rows followed by an explicit filesort to satisfy `ORDER BY amount DESC`.
- **Indexed Plan**:
  ```text
  -> Index range scan on transactions using idx_tx_amount over (25000.00 < amount) (reverse)
     (cost=367 rows=816) (actual time=0.0968..0.702 rows=816 loops=1)
  ```
  *Analysis*: B-tree index traversal directly seeks amount $> 25000.00$ and reads in reverse order, completely eliminating the table scan and filesort. Execution dropped from **12.79 ms to 1.44 ms (88.71% speedup)**.

### 7.2. Query B & C (Sliding Window Temporal Self-Joins at 100k rows)
- **Baseline Plan**: Nested loop join scanning `t1` (93,285 qualifying rows) and probing `t2` on `fk_tx_source_account`, followed by temporal residual filtering.
- **Indexed Plan**: Composite index `idx_tx_pair_timestamp (source_account_id, destination_account_id, transaction_timestamp)` allows MySQL to evaluate both join keys and the sliding temporal window `[t1.ts - 15m, t1.ts]` directly within the index leaf pages.
- **Scaling Crossover Insight**:
  - At $N = 10,000$, dataset fits in cache and index lookups had slight secondary index traversal overhead compared to clustered scans.
  - At $N = 100,000$, composite indexing reduced execution time from **1,113 ms down to 148 ms (86.64% speedup)** for Query C, and from **1,426 ms down to 473 ms (66.79% speedup)** for Query B.

### 7.3. Query D (Composite Status and Date Range Scan at 100k rows)
- **Baseline Plan**: Scanned 100,000 table rows, filtered 26,722 rows, and performed a memory sort for the top 100 records (24.6 ms).
- **Indexed Plan**: Reverse range scan on `idx_tx_status_timestamp` satisfied the sort order directly, fetching only the first 100 matches in **0.826 ms (96.01% speedup)**.

### 7.4. Query E (Optimizer Inversion / Regression Case at 100k rows)
- In Query E, the optimizer selected a nested loop hash join with table scans over `a` because the alert table only has 3,286 rows. Forcing index lookups with small result sets resulted in additional random lookups into the clustered index, causing execution time to increase from **1.19 ms to 4.51 ms**. This provides a strong real-world example of **index over-engineering on small, high-selectivity tables**.

---

## 8. Physical Storage Overhead

Using `ANALYZE TABLE` and querying `information_schema.tables` at $N = 100,000$ transactions:
- **Base Table Data (`transactions`)**: 8.93 MB
- **Total Index Footprint (`transactions`)**: 28.95 MB
  - The combination of 5 secondary indexes on the high-cardinality transaction log resulted in an index storage ratio of **3.24× the raw table data**.
- **Engineering Trade-off**: High secondary index density accelerates analytical sliding-window scans by up to 96%, but increases disk write amplification and memory footprint in the buffer pool.

---

## 9. Threats to Validity & Limitations

1. **Synthetic Data Uniformity**: Synthetic transaction timestamps were generated with bounded uniform randomness, which produces flatter distribution curves than the bursts observed in real banking networks.
2. **Buffer Pool Sizing**: Experiments were run with a 128 MB buffer pool. In large production instances with multi-gigabyte pools, warm cache hit ratios may further mitigate table scan costs for medium datasets.
3. **Write Penalty**: Write overhead (the latency penalty of maintaining 5 indexes on concurrent `INSERT` streams) was evaluated via storage footprint rather than concurrent load stress testing.

---

## 10. Conclusion

The experimental findings demonstrate that:
1. **Composite Range Indexing** (`idx_tx_status_timestamp`, `idx_tx_amount`) delivers order-of-magnitude query accelerations (up to **96% faster**) by eliminating filesorts and full table scans.
2. **Temporal Window Self-Joins** exhibit substantial scaling bottlenecks ($O(N^2)$ worst case) without composite keys covering `(source_account_id, transaction_timestamp)`.
3. Adding indexes indiscriminately to small dimension tables (`fraud_alerts` with $<5,000$ records) can cause query regressions due to unneeded index tree traversals.
