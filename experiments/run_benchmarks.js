const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_NAME = 'fraudlens_benchmark';
const TARGET_DB = process.env.DB_NAME;

if (TARGET_DB && TARGET_DB !== DB_NAME && process.env.OVERRIDE_BENCHMARK_DB !== '1') {
    console.error(`Safety Error: Active environment DB_NAME is '${TARGET_DB}'. Benchmark must run only against '${DB_NAME}'.`);
}

class LcgRng {
    constructor(seed = 123456789) {
        this.seed = seed >>> 0;
    }
    next() {
        this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
    range(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }
    decimal(min, max, decimals = 2) {
        const val = min + this.next() * (max - min);
        return parseFloat(val.toFixed(decimals));
    }
    pick(arr) {
        return arr[this.range(0, arr.length - 1)];
    }
}

function formatDate(d) {
    return d.toISOString().replace('T', ' ').substring(0, 19);
}

function escapeStr(s) {
    return s.replace(/'/g, "''");
}

function calculateMedian(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateStdDev(arr) {
    if (!arr || arr.length <= 1) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (arr.length - 1);
    return Math.sqrt(variance);
}

async function getDbConnection() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT, 10) || 3307,
        user: process.env.DB_USER || 'fraudlens_user',
        password: process.env.DB_PASSWORD || '',
        database: DB_NAME,
        multipleStatements: true
    });

    const [[row]] = await conn.query('SELECT DATABASE() AS cur_db');
    if (row.cur_db !== DB_NAME) {
        await conn.end();
        throw new Error(`CRITICAL SAFETY ERROR: Connected to '${row.cur_db}' instead of '${DB_NAME}'. Aborting immediately.`);
    }
    return conn;
}

async function seedBenchmarkData(conn, numTx) {
    console.log(`\n--- Seeding ${DB_NAME} for scale ${numTx} transactions ---`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
    await conn.query('TRUNCATE TABLE fraud_alerts;');
    await conn.query('TRUNCATE TABLE transactions;');
    await conn.query('TRUNCATE TABLE accounts;');
    await conn.query('TRUNCATE TABLE customers;');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');

    const numCust = numTx === 10000 ? 500 : (numTx === 100000 ? 2500 : 5000);
    const numAcc = numTx === 10000 ? 800 : (numTx === 100000 ? 4000 : 10000);

    const rng = new LcgRng(42);
    const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

    console.log(`Generating ${numCust} customers...`);
    const custBatch = [];
    const baseCustDate = new Date('2026-08-01T00:00:00Z');
    for (let i = 1; i <= numCust; i++) {
        const fn = rng.pick(firstNames);
        const ln = rng.pick(lastNames);
        const email = `bench_${numTx}_${i}_${fn.toLowerCase()}@example.org`;
        const phone = `+1-${String(rng.range(200, 999))}-${String(rng.range(100, 999))}-${String(i).padStart(4, '0')}`;
        const kyc = rng.next() < 0.85 ? 'VERIFIED' : 'PENDING';
        const d = new Date(baseCustDate.getTime() + rng.range(0, 40) * 86400000);
        custBatch.push(`(${i}, '${escapeStr(fn)}', '${escapeStr(ln)}', '${email}', '${phone}', '${kyc}', '${formatDate(d)}')`);
    }
    await conn.query(`INSERT INTO customers (customer_id, first_name, last_name, email, phone_number, kyc_status, created_at) VALUES\n${custBatch.join(',\n')}`);

    console.log(`Generating ${numAcc} accounts...`);
    const accBatch = [];
    const accTypes = ['CHECKING', 'SAVINGS', 'BUSINESS'];
    for (let i = 1; i <= numAcc; i++) {
        const custId = i <= numCust ? i : rng.range(1, numCust);
        const accNum = `BACC${String(numTx)}_${String(i).padStart(8, '0')}`;
        const accType = rng.pick(accTypes);
        const balance = rng.decimal(100.00, 75000.00, 2);
        const status = rng.next() < 0.95 ? 'ACTIVE' : 'FROZEN';
        const d = new Date(baseCustDate.getTime() + rng.range(40, 60) * 86400000);
        accBatch.push(`(${i}, '${accNum}', ${custId}, '${accType}', ${balance.toFixed(2)}, '${status}', '${formatDate(d)}')`);
    }
    await conn.query(`INSERT INTO accounts (account_id, account_number, customer_id, account_type, balance, status, created_at) VALUES\n${accBatch.join(',\n')}`);

    console.log(`Generating ${numTx} transactions...`);
    const txStart = new Date('2026-10-01T00:00:00Z').getTime();
    const txTypes = ['TRANSFER', 'PAYMENT', 'WITHDRAWAL', 'DEPOSIT'];
    const transactions = [];

    const numHighVal = Math.floor(numTx * 0.015);
    for (let k = 0; k < numHighVal; k++) {
        let src = rng.range(1, numAcc);
        let dst = rng.range(1, numAcc);
        while (dst === src) dst = rng.range(1, numAcc);
        const amt = rng.decimal(10050.00, 45000.00, 2);
        const ts = new Date(txStart + rng.range(0, 14 * 86400) * 1000);
        const isFraud = rng.next() < 0.70 ? 1 : 0;
        const status = rng.next() < 0.92 ? 'SUCCESS' : 'FLAGGED';
        transactions.push({
            id: transactions.length + 1,
            ref: `BTX-HV-${String(transactions.length + 1).padStart(8, '0')}`,
            src, dst, amt, type: rng.pick(txTypes), status, isFraud, ts
        });
    }

    const numBursts = Math.floor(numTx * 0.005);
    for (let b = 0; b < numBursts; b++) {
        const src = rng.range(1, numAcc);
        const burstSize = rng.range(4, 7);
        const burstStart = txStart + rng.range(0, 14 * 86400) * 1000;
        const isFraud = rng.next() < 0.80 ? 1 : 0;
        for (let j = 0; j < burstSize; j++) {
            let dst = rng.range(1, numAcc);
            while (dst === src) dst = rng.range(1, numAcc);
            const amt = rng.decimal(150.00, 4500.00, 2);
            const ts = new Date(burstStart + (j * 45 * 1000) + rng.range(0, 15000));
            transactions.push({
                id: transactions.length + 1,
                ref: `BTX-RS-${String(transactions.length + 1).padStart(8, '0')}`,
                src, dst, amt, type: 'TRANSFER', status: 'SUCCESS', isFraud, ts
            });
        }
    }

    while (transactions.length < numTx) {
        let src = rng.range(1, numAcc);
        let dst = rng.range(1, numAcc);
        while (dst === src) dst = rng.range(1, numAcc);
        const amt = rng.next() < 0.80 ? rng.decimal(5.00, 800.00, 2) : rng.decimal(800.00, 7500.00, 2);
        const ts = new Date(txStart + rng.range(0, 14 * 86400) * 1000);
        const statRoll = rng.next();
        const status = statRoll < 0.93 ? 'SUCCESS' : (statRoll < 0.98 ? 'FAILED' : 'BLOCKED');
        const isFraud = rng.next() < 0.015 ? 1 : 0;
        transactions.push({
            id: transactions.length + 1,
            ref: `BTX-STD-${String(transactions.length + 1).padStart(8, '0')}`,
            src, dst, amt, type: rng.pick(txTypes), status, isFraud, ts
        });
    }

    transactions.sort((a, b) => a.ts.getTime() - b.ts.getTime());
    for (let i = 0; i < transactions.length; i++) {
        transactions[i].id = i + 1;
    }

    const batchSize = 1000;
    for (let i = 0; i < transactions.length; i += batchSize) {
        const slice = transactions.slice(i, i + batchSize);
        const rows = slice.map(t =>
            `(${t.id}, '${t.ref}', ${t.src}, ${t.dst}, ${t.amt.toFixed(2)}, '${t.type}', '${t.status}', ${t.isFraud}, '${formatDate(t.ts)}')`
        );
        await conn.query(`INSERT INTO transactions (transaction_id, transaction_reference, source_account_id, destination_account_id, amount, transaction_type, status, is_fraud_ground_truth, transaction_timestamp) VALUES\n${rows.join(',\n')}`);
    }

    console.log(`Generating fraud alerts for scale ${numTx}...`);
    const detectionSql = `
        INSERT INTO fraud_alerts (transaction_id, rule_id, risk_score, status, investigation_notes, triggered_at)
        SELECT t.transaction_id, r.rule_id, 80.00, 'PENDING', 'High-value alert', CURRENT_TIMESTAMP
        FROM transactions t
        JOIN fraud_rules r ON r.rule_code = 'RULE_HIGH_VAL' AND r.is_active = 1
        WHERE t.status IN ('SUCCESS', 'FLAGGED') AND t.amount > r.threshold_value
        ON DUPLICATE KEY UPDATE risk_score = VALUES(risk_score);

        INSERT INTO fraud_alerts (transaction_id, rule_id, risk_score, status, investigation_notes, triggered_at)
        SELECT t1.transaction_id, r.rule_id, 95.00, 'PENDING', 'Rapid successive alert', CURRENT_TIMESTAMP
        FROM transactions t1
        JOIN fraud_rules r ON r.rule_code = 'RULE_RAPID_TX' AND r.is_active = 1
        JOIN transactions t2 ON t1.source_account_id = t2.source_account_id
          AND t2.status IN ('SUCCESS', 'FLAGGED')
          AND t2.transaction_timestamp <= t1.transaction_timestamp
          AND t2.transaction_timestamp >= t1.transaction_timestamp - INTERVAL r.time_window_minutes MINUTE
        WHERE t1.status IN ('SUCCESS', 'FLAGGED')
        GROUP BY t1.transaction_id, r.rule_id, r.threshold_value, r.time_window_minutes
        HAVING COUNT(t2.transaction_id) >= r.threshold_value
        ON DUPLICATE KEY UPDATE risk_score = VALUES(risk_score);
    `;
    await conn.query(detectionSql);

    const [[{ cnt }]] = await conn.query('SELECT count(*) AS cnt FROM fraud_alerts');
    console.log(`Seeding complete. Customers: ${numCust}, Accounts: ${numAcc}, Transactions: ${numTx}, Alerts: ${cnt}`);
}

async function dropCandidateIndexes(conn) {
    console.log('Resetting to Baseline Configuration (dropping candidate secondary indexes)...');
    const [existingIndexes] = await conn.query(`
        SELECT DISTINCT TABLE_NAME, INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = '${DB_NAME}' 
          AND INDEX_NAME IN ('idx_tx_amount', 'idx_tx_source_timestamp', 'idx_tx_pair_timestamp', 'idx_tx_status_timestamp', 'idx_alerts_status_risk');
    `);

    for (const row of existingIndexes) {
        if (row.TABLE_NAME === 'transactions' && row.INDEX_NAME === 'idx_tx_source_timestamp') {
            try {
                await conn.query('ALTER TABLE `transactions` ADD INDEX `fk_tx_source_account` (`source_account_id`);');
            } catch (e) {}
        }
        console.log(`Dropping candidate index ${row.INDEX_NAME} on ${row.TABLE_NAME}...`);
        await conn.query(`ALTER TABLE \`${row.TABLE_NAME}\` DROP INDEX \`${row.INDEX_NAME}\`;`);
    }
}

async function createCandidateIndexes(conn) {
    console.log('Applying Candidate Performance Indexes...');
    await conn.query('CREATE INDEX idx_tx_amount ON transactions(amount);');
    await conn.query('CREATE INDEX idx_tx_source_timestamp ON transactions(source_account_id, transaction_timestamp);');
    await conn.query('CREATE INDEX idx_tx_pair_timestamp ON transactions(source_account_id, destination_account_id, transaction_timestamp);');
    await conn.query('CREATE INDEX idx_tx_status_timestamp ON transactions(status, transaction_timestamp);');
    await conn.query('CREATE INDEX idx_alerts_status_risk ON fraud_alerts(status, risk_score);');
}

async function measureStorage(conn) {
    const sql = `
        SELECT 
            table_name,
            ROUND(data_length / 1024, 2) AS data_kb,
            ROUND(index_length / 1024, 2) AS index_kb,
            ROUND((data_length + index_length) / 1024, 2) AS total_kb
        FROM information_schema.tables
        WHERE table_schema = '${DB_NAME}'
        ORDER BY table_name;
    `;
    const [rows] = await conn.query(sql);
    return rows;
}

const QUERIES = [
    {
        id: 'Query_A',
        name: 'High-Value Transactions Filter',
        category: 'Range Scan / Selectivity',
        sql: `
            SELECT transaction_id, transaction_reference, source_account_id, amount, status, transaction_timestamp
            FROM transactions
            WHERE amount > 25000.00
            ORDER BY amount DESC;
        `,
        explainSql: `
            EXPLAIN ANALYZE
            SELECT transaction_id, transaction_reference, source_account_id, amount, status, transaction_timestamp
            FROM transactions
            WHERE amount > 25000.00
            ORDER BY amount DESC;
        `
    },
    {
        id: 'Query_B',
        name: 'Rapid Successive Transactions Window Join',
        category: 'Temporal Self-Join & Window Aggregation',
        sql: `
            SELECT 
                t1.source_account_id,
                t1.transaction_id,
                t1.transaction_timestamp,
                COUNT(t2.transaction_id) AS tx_window_count
            FROM transactions t1
            JOIN transactions t2 
              ON t1.source_account_id = t2.source_account_id
             AND t2.transaction_timestamp <= t1.transaction_timestamp
             AND t2.transaction_timestamp >= t1.transaction_timestamp - INTERVAL 5 MINUTE
            WHERE t1.status = 'SUCCESS' AND t2.status = 'SUCCESS'
            GROUP BY t1.source_account_id, t1.transaction_id, t1.transaction_timestamp
            HAVING COUNT(t2.transaction_id) >= 3
            ORDER BY tx_window_count DESC
            LIMIT 50;
        `,
        explainSql: `
            EXPLAIN ANALYZE
            SELECT 
                t1.source_account_id,
                t1.transaction_id,
                t1.transaction_timestamp,
                COUNT(t2.transaction_id) AS tx_window_count
            FROM transactions t1
            JOIN transactions t2 
              ON t1.source_account_id = t2.source_account_id
             AND t2.transaction_timestamp <= t1.transaction_timestamp
             AND t2.transaction_timestamp >= t1.transaction_timestamp - INTERVAL 5 MINUTE
            WHERE t1.status = 'SUCCESS' AND t2.status = 'SUCCESS'
            GROUP BY t1.source_account_id, t1.transaction_id, t1.transaction_timestamp
            HAVING COUNT(t2.transaction_id) >= 3
            ORDER BY tx_window_count DESC
            LIMIT 50;
        `
    },
    {
        id: 'Query_C',
        name: 'Repeated Pair Transfers Window Join',
        category: 'Pairwise Temporal Self-Join',
        sql: `
            SELECT 
                t1.source_account_id,
                t1.destination_account_id,
                t1.transaction_id,
                COUNT(t2.transaction_id) AS transfer_window_count
            FROM transactions t1
            JOIN transactions t2 
              ON t1.source_account_id = t2.source_account_id
             AND t1.destination_account_id = t2.destination_account_id
             AND t2.transaction_timestamp <= t1.transaction_timestamp
             AND t2.transaction_timestamp >= t1.transaction_timestamp - INTERVAL 15 MINUTE
            WHERE t1.status = 'SUCCESS' AND t2.status = 'SUCCESS'
            GROUP BY t1.source_account_id, t1.destination_account_id, t1.transaction_id
            HAVING COUNT(t2.transaction_id) >= 2
            ORDER BY transfer_window_count DESC
            LIMIT 50;
        `,
        explainSql: `
            EXPLAIN ANALYZE
            SELECT 
                t1.source_account_id,
                t1.destination_account_id,
                t1.transaction_id,
                COUNT(t2.transaction_id) AS transfer_window_count
            FROM transactions t1
            JOIN transactions t2 
              ON t1.source_account_id = t2.source_account_id
             AND t1.destination_account_id = t2.destination_account_id
             AND t2.transaction_timestamp <= t1.transaction_timestamp
             AND t2.transaction_timestamp >= t1.transaction_timestamp - INTERVAL 15 MINUTE
            WHERE t1.status = 'SUCCESS' AND t2.status = 'SUCCESS'
            GROUP BY t1.source_account_id, t1.destination_account_id, t1.transaction_id
            HAVING COUNT(t2.transaction_id) >= 2
            ORDER BY transfer_window_count DESC
            LIMIT 50;
        `
    },
    {
        id: 'Query_D',
        name: 'Transaction Filtering & Date Range Scan',
        category: 'Status & Timestamp Predicate Filtering',
        sql: `
            SELECT 
                transaction_id,
                transaction_reference,
                source_account_id,
                destination_account_id,
                amount,
                status,
                transaction_timestamp
            FROM transactions
            WHERE status = 'SUCCESS'
              AND transaction_timestamp >= '2026-10-05 00:00:00'
              AND transaction_timestamp <= '2026-10-08 23:59:59'
            ORDER BY transaction_timestamp DESC
            LIMIT 100;
        `,
        explainSql: `
            EXPLAIN ANALYZE
            SELECT 
                transaction_id,
                transaction_reference,
                source_account_id,
                destination_account_id,
                amount,
                status,
                transaction_timestamp
            FROM transactions
            WHERE status = 'SUCCESS'
              AND transaction_timestamp >= '2026-10-05 00:00:00'
              AND transaction_timestamp <= '2026-10-08 23:59:59'
            ORDER BY transaction_timestamp DESC
            LIMIT 100;
        `
    },
    {
        id: 'Query_E',
        name: 'Alert Investigation Multi-Table Join',
        category: 'Relational Multi-Table Join & Filtering',
        sql: `
            SELECT 
                a.alert_id,
                a.risk_score,
                a.status AS alert_status,
                r.rule_code,
                r.severity,
                t.transaction_reference,
                t.amount,
                t.transaction_timestamp,
                src.account_number AS source_account_number
            FROM fraud_alerts a
            JOIN fraud_rules r ON a.rule_id = r.rule_id
            JOIN transactions t ON a.transaction_id = t.transaction_id
            JOIN accounts src ON t.source_account_id = src.account_id
            WHERE a.status = 'PENDING'
              AND a.risk_score >= 75.00
            ORDER BY a.risk_score DESC, a.triggered_at DESC
            LIMIT 50;
        `,
        explainSql: `
            EXPLAIN ANALYZE
            SELECT 
                a.alert_id,
                a.risk_score,
                a.status AS alert_status,
                r.rule_code,
                r.severity,
                t.transaction_reference,
                t.amount,
                t.transaction_timestamp,
                src.account_number AS source_account_number
            FROM fraud_alerts a
            JOIN fraud_rules r ON a.rule_id = r.rule_id
            JOIN transactions t ON a.transaction_id = t.transaction_id
            JOIN accounts src ON t.source_account_id = src.account_id
            WHERE a.status = 'PENDING'
              AND a.risk_score >= 75.00
            ORDER BY a.risk_score DESC, a.triggered_at DESC
            LIMIT 50;
        `
    }
];

async function runBenchmark() {
    console.log('===========================================================');
    console.log('   FraudLens: Phase 7 SQL Benchmarking Engine');
    console.log('   Target Database: fraudlens_benchmark (STRICTLY ISOLATED)');
    console.log('===========================================================');

    const conn = await getDbConnection();
    const [[verRow]] = await conn.query('SELECT VERSION() AS ver');
    const mysqlVer = verRow.ver;

    const rawResults = [];
    const storageStats = [];
    const plansDir = path.resolve(__dirname, 'plans');

    const scales = [10000, 100000];

    for (const scale of scales) {
        console.log(`\n>>>>>>>>>>>> SCALING EXPERIMENT: N = ${scale.toLocaleString()} transactions <<<<<<<<<<<<`);
        await seedBenchmarkData(conn, scale);

        const configurations = ['Baseline', 'Indexed'];

        for (const config of configurations) {
            console.log(`\n--- Configuration: ${config} (Scale: ${scale}) ---`);
            if (config === 'Baseline') {
                await dropCandidateIndexes(conn);
            } else {
                await createCandidateIndexes(conn);
            }

            const storage = await measureStorage(conn);
            storageStats.push({
                scale,
                config,
                tables: storage
            });

            for (const query of QUERIES) {
                console.log(`Running ${query.id} (${query.name})...`);

                const [planRows] = await conn.query(query.explainSql);
                const planText = planRows.map(r => Object.values(r)[0]).join('\n');
                const planFilename = path.join(plansDir, `${query.id}_${scale}_${config.toLowerCase()}.txt`);
                fs.writeFileSync(planFilename, planText, 'utf-8');

                const t0Warm = process.hrtime.bigint();
                const [warmRows] = await conn.query(query.sql);
                const t1Warm = process.hrtime.bigint();
                const warmMs = Number(t1Warm - t0Warm) / 1000000;

                rawResults.push({
                    timestamp: new Date().toISOString(),
                    mysql_version: mysqlVer,
                    dataset_size: scale,
                    query_id: query.id,
                    configuration: config,
                    run_type: 'warmup',
                    run_number: 0,
                    execution_time_ms: parseFloat(warmMs.toFixed(3)),
                    row_count: warmRows.length,
                    validation_status: 'VALID'
                });

                const measuredRuns = 5;
                for (let run = 1; run <= measuredRuns; run++) {
                    const t0 = process.hrtime.bigint();
                    const [resRows] = await conn.query(query.sql);
                    const t1 = process.hrtime.bigint();
                    const durationMs = Number(t1 - t0) / 1000000;

                    const isValid = resRows.length === warmRows.length;

                    rawResults.push({
                        timestamp: new Date().toISOString(),
                        mysql_version: mysqlVer,
                        dataset_size: scale,
                        query_id: query.id,
                        configuration: config,
                        run_type: 'measured',
                        run_number: run,
                        execution_time_ms: parseFloat(durationMs.toFixed(3)),
                        row_count: resRows.length,
                        validation_status: isValid ? 'VALID' : 'MISMATCH'
                    });
                }
            }
        }
    }

    await conn.end();

    const rawCsvHeader = 'timestamp,mysql_version,dataset_size,query_id,configuration,run_type,run_number,execution_time_ms,row_count,validation_status\n';
    const rawCsvRows = rawResults.map(r =>
        `${r.timestamp},${r.mysql_version},${r.dataset_size},${r.query_id},${r.configuration},${r.run_type},${r.run_number},${r.execution_time_ms},${r.row_count},${r.validation_status}`
    ).join('\n');
    fs.writeFileSync(path.resolve(__dirname, 'results.csv'), rawCsvHeader + rawCsvRows + '\n', 'utf-8');
    console.log(`\nSaved raw measurements to experiments/results.csv (${rawResults.length} records)`);

    const summaryMap = {};
    for (const r of rawResults) {
        if (r.run_type !== 'measured') continue;
        const key = `${r.dataset_size}_${r.query_id}_${r.configuration}`;
        if (!summaryMap[key]) {
            summaryMap[key] = {
                dataset_size: r.dataset_size,
                query_id: r.query_id,
                configuration: r.configuration,
                times: []
            };
        }
        summaryMap[key].times.push(r.execution_time_ms);
    }

    const summaryRows = [];
    const comparisonKeys = new Set();
    for (const key of Object.keys(summaryMap)) {
        const item = summaryMap[key];
        const compKey = `${item.dataset_size}:::${item.query_id}`;
        comparisonKeys.add(compKey);
    }

    for (const compKey of comparisonKeys) {
        const [sizeStr, queryId] = compKey.split(':::');
        const size = parseInt(sizeStr, 10);
        const baseItem = summaryMap[`${size}_${queryId}_Baseline`];
        const idxItem = summaryMap[`${size}_${queryId}_Indexed`];

        const baseMedian = baseItem ? calculateMedian(baseItem.times) : 0;
        const baseMin = baseItem ? Math.min(...baseItem.times) : 0;
        const baseMax = baseItem ? Math.max(...baseItem.times) : 0;
        const baseStdDev = baseItem ? calculateStdDev(baseItem.times) : 0;

        const idxMedian = idxItem ? calculateMedian(idxItem.times) : 0;
        const idxMin = idxItem ? Math.min(...idxItem.times) : 0;
        const idxMax = idxItem ? Math.max(...idxItem.times) : 0;
        const idxStdDev = idxItem ? calculateStdDev(idxItem.times) : 0;

        const absDiff = parseFloat((baseMedian - idxMedian).toFixed(3));
        const pctImprovement = baseMedian > 0
            ? parseFloat((((baseMedian - idxMedian) / baseMedian) * 100).toFixed(2))
            : 0.0;

        summaryRows.push({
            dataset_size: size,
            query_id: queryId,
            measured_runs: 5,
            baseline_median_ms: parseFloat(baseMedian.toFixed(3)),
            baseline_min_ms: parseFloat(baseMin.toFixed(3)),
            baseline_max_ms: parseFloat(baseMax.toFixed(3)),
            baseline_stddev_ms: parseFloat(baseStdDev.toFixed(3)),
            indexed_median_ms: parseFloat(idxMedian.toFixed(3)),
            indexed_min_ms: parseFloat(idxMin.toFixed(3)),
            indexed_max_ms: parseFloat(idxMax.toFixed(3)),
            indexed_stddev_ms: parseFloat(idxStdDev.toFixed(3)),
            absolute_diff_ms: absDiff,
            pct_improvement: pctImprovement
        });
    }

    const summaryCsvHeader = 'dataset_size,query_id,measured_runs,baseline_median_ms,baseline_min_ms,baseline_max_ms,baseline_stddev_ms,indexed_median_ms,indexed_min_ms,indexed_max_ms,indexed_stddev_ms,absolute_diff_ms,pct_improvement\n';
    const summaryCsvContent = summaryRows.map(s =>
        `${s.dataset_size},${s.query_id},${s.measured_runs},${s.baseline_median_ms},${s.baseline_min_ms},${s.baseline_max_ms},${s.baseline_stddev_ms},${s.indexed_median_ms},${s.indexed_min_ms},${s.indexed_max_ms},${s.indexed_stddev_ms},${s.absolute_diff_ms},${s.pct_improvement}`
    ).join('\n');
    fs.writeFileSync(path.resolve(__dirname, 'summary.csv'), summaryCsvHeader + summaryCsvContent + '\n', 'utf-8');
    console.log(`Saved summary metrics to experiments/summary.csv (${summaryRows.length} rows)`);

    fs.writeFileSync(path.resolve(__dirname, 'storage_overhead.json'), JSON.stringify(storageStats, null, 2), 'utf-8');
    console.log(`Saved storage stats to experiments/storage_overhead.json`);

    console.log('\n================== BENCHMARK SUMMARY TABLE ==================');
    console.table(summaryRows.map(s => ({
        Scale: s.dataset_size.toLocaleString(),
        Query: s.query_id,
        'Base Med (ms)': s.baseline_median_ms,
        'Idx Med (ms)': s.indexed_median_ms,
        'Diff (ms)': s.absolute_diff_ms,
        'Speedup %': `${s.pct_improvement}%`
    })));
}

runBenchmark().catch(err => {
    console.error('Benchmark Execution Failure:', err);
    process.exit(1);
});
