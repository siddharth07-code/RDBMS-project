const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runEdgeCaseTests() {
    console.log('--- Starting FraudLens Edge-Case Validation Suite (Isolated Transaction Rollback) ---');
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT, 10) || 3307,
        user: process.env.DB_USER || 'fraudlens_user',
        password: process.env.DB_PASSWORD || '',
        database: 'fraudlens_db'
    });

    let passed = 0;
    let failed = 0;

    function assert(cond, name) {
        if (cond) {
            console.log(`[PASS] ${name}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name}`);
            failed++;
        }
    }

    try {
        await conn.beginTransaction();

        // Setup test accounts
        await conn.query(`
            INSERT INTO customers (customer_id, first_name, last_name, email, phone_number)
            VALUES (9001, 'Edge', 'Tester', 'edge@test.org', '+1-999-999-9001');
        `);
        await conn.query(`
            INSERT INTO accounts (account_id, account_number, customer_id, account_type, balance)
            VALUES (9001, 'EDGE_ACC_1', 9001, 'CHECKING', 100000.00),
                   (9002, 'EDGE_ACC_2', 9001, 'SAVINGS', 100000.00);
        `);

        // Test 1: Check constraint rejects negative amount
        let negFailed = false;
        try {
            await conn.query(`
                INSERT INTO transactions (transaction_id, transaction_reference, source_account_id, destination_account_id, amount, transaction_type)
                VALUES (90001, 'TX-EDGE-NEG', 9001, 9002, -50.00, 'TRANSFER');
            `);
        } catch (e) {
            negFailed = true;
        }
        assert(negFailed, 'Schema rejects negative transaction amount');

        // Test 2: Check constraint rejects zero amount
        let zeroFailed = false;
        try {
            await conn.query(`
                INSERT INTO transactions (transaction_id, transaction_reference, source_account_id, destination_account_id, amount, transaction_type)
                VALUES (90002, 'TX-EDGE-ZERO', 9001, 9002, 0.00, 'TRANSFER');
            `);
        } catch (e) {
            zeroFailed = true;
        }
        assert(zeroFailed, 'Schema rejects zero transaction amount (amount > 0 constraint)');

        // Test 3: Check constraint rejects self-transfer (source == dest)
        let selfFailed = false;
        try {
            await conn.query(`
                INSERT INTO transactions (transaction_id, transaction_reference, source_account_id, destination_account_id, amount, transaction_type)
                VALUES (90003, 'TX-EDGE-SELF', 9001, 9001, 100.00, 'TRANSFER');
            `);
        } catch (e) {
            selfFailed = true;
        }
        assert(selfFailed, 'Schema rejects self-transfer (source_account_id <> destination_account_id)');

        // Test 4: Foreign key rejects invalid account ID
        let fkFailed = false;
        try {
            await conn.query(`
                INSERT INTO transactions (transaction_id, transaction_reference, source_account_id, destination_account_id, amount, transaction_type)
                VALUES (90004, 'TX-EDGE-FK', 999999, 9002, 100.00, 'TRANSFER');
            `);
        } catch (e) {
            fkFailed = true;
        }
        assert(fkFailed, 'Schema rejects invalid foreign key account references');

        // Test 5: High-value threshold boundary tests ($9,999.99 vs $10,000.00 vs $10,000.01)
        // Active threshold in fraud_rules is 10,000.00 (rule evaluates amount > threshold_value)
        await conn.query(`
            INSERT INTO transactions (transaction_id, transaction_reference, source_account_id, destination_account_id, amount, transaction_type, status, transaction_timestamp)
            VALUES 
            (90010, 'TX-EDGE-HV-BELOW', 9001, 9002, 9999.99, 'TRANSFER', 'SUCCESS', '2026-10-15 10:00:00'),
            (90011, 'TX-EDGE-HV-EXACT', 9001, 9002, 10000.00, 'TRANSFER', 'SUCCESS', '2026-10-15 10:01:00'),
            (90012, 'TX-EDGE-HV-ABOVE', 9001, 9002, 10000.01, 'TRANSFER', 'SUCCESS', '2026-10-15 10:02:00');
        `);

        const [hvMatches] = await conn.query(`
            SELECT t.transaction_id, t.transaction_reference
            FROM transactions t
            JOIN fraud_rules r ON r.rule_code = 'RULE_HIGH_VAL' AND r.is_active = 1
            WHERE t.transaction_id IN (90010, 90011, 90012)
              AND t.status IN ('SUCCESS', 'FLAGGED')
              AND t.amount > r.threshold_value;
        `);
        assert(
            hvMatches.length === 1 && hvMatches[0].transaction_id === 90012,
            'High-value rule strictly flags amount > 10000.00 (skips 9999.99 and exact 10000.00)'
        );

        // Test 6: Rapid successive transactions boundary (inside vs outside 5-minute window)
        // 3 transactions within 4 minutes -> triggers
        // 3 transactions spread over 15 minutes -> does not trigger
        await conn.query(`
            INSERT INTO transactions (transaction_id, transaction_reference, source_account_id, destination_account_id, amount, transaction_type, status, transaction_timestamp)
            VALUES 
            (90020, 'TX-BURST-1', 9001, 9002, 100.00, 'TRANSFER', 'SUCCESS', '2026-10-15 11:00:00'),
            (90021, 'TX-BURST-2', 9001, 9002, 100.00, 'TRANSFER', 'SUCCESS', '2026-10-15 11:01:30'),
            (90022, 'TX-BURST-3', 9001, 9002, 100.00, 'TRANSFER', 'SUCCESS', '2026-10-15 11:03:00'),
            (90030, 'TX-SPREAD-1', 9002, 9001, 100.00, 'TRANSFER', 'SUCCESS', '2026-10-15 12:00:00'),
            (90031, 'TX-SPREAD-2', 9002, 9001, 100.00, 'TRANSFER', 'SUCCESS', '2026-10-15 12:06:00'),
            (90032, 'TX-SPREAD-3', 9002, 9001, 100.00, 'TRANSFER', 'SUCCESS', '2026-10-15 12:12:00');
        `);

        const [rapidMatches] = await conn.query(`
            SELECT t1.transaction_id, COUNT(t2.transaction_id) as cnt
            FROM transactions t1
            JOIN fraud_rules r ON r.rule_code = 'RULE_RAPID_TX' AND r.is_active = 1
            JOIN transactions t2 ON t1.source_account_id = t2.source_account_id
              AND t2.status IN ('SUCCESS', 'FLAGGED')
              AND t2.transaction_timestamp <= t1.transaction_timestamp
              AND t2.transaction_timestamp >= t1.transaction_timestamp - INTERVAL r.time_window_minutes MINUTE
            WHERE t1.transaction_id IN (90020, 90021, 90022, 90030, 90031, 90032)
            GROUP BY t1.transaction_id, r.threshold_value
            HAVING COUNT(t2.transaction_id) >= r.threshold_value;
        `);
        assert(
            rapidMatches.length === 1 && rapidMatches[0].transaction_id === 90022,
            'Rapid successive rule triggers on 3 txs within 5 min (90022) but skips spread txs (90030-90032)'
        );

        // Test 7: Multi-rule trigger (1 transaction violating both HIGH_VAL and RAPID_TX)
        await conn.query(`
            INSERT INTO transactions (transaction_id, transaction_reference, source_account_id, destination_account_id, amount, transaction_type, status, transaction_timestamp)
            VALUES 
            (90040, 'TX-MULTI-1', 9001, 9002, 50.00, 'TRANSFER', 'SUCCESS', '2026-10-15 14:00:00'),
            (90041, 'TX-MULTI-2', 9001, 9002, 50.00, 'TRANSFER', 'SUCCESS', '2026-10-15 14:01:00'),
            (90042, 'TX-MULTI-3', 9001, 9002, 35000.00, 'TRANSFER', 'SUCCESS', '2026-10-15 14:02:00');
        `);

        // Check if 90042 violates both
        const [multiHv] = await conn.query(`
            SELECT t.transaction_id FROM transactions t
            JOIN fraud_rules r ON r.rule_code = 'RULE_HIGH_VAL'
            WHERE t.transaction_id = 90042 AND t.amount > r.threshold_value;
        `);
        const [multiRapid] = await conn.query(`
            SELECT t1.transaction_id FROM transactions t1
            JOIN fraud_rules r ON r.rule_code = 'RULE_RAPID_TX'
            JOIN transactions t2 ON t1.source_account_id = t2.source_account_id
              AND t2.transaction_timestamp <= t1.transaction_timestamp
              AND t2.transaction_timestamp >= t1.transaction_timestamp - INTERVAL 5 MINUTE
            WHERE t1.transaction_id = 90042
            GROUP BY t1.transaction_id
            HAVING COUNT(t2.transaction_id) >= 3;
        `);
        assert(
            multiHv.length === 1 && multiRapid.length === 1,
            'Transaction 90042 simultaneously qualifies for both RULE_HIGH_VAL and RULE_RAPID_TX'
        );

        // Test 8: Failed / Blocked status filtering (status not in SUCCESS, FLAGGED)
        await conn.query(`
            INSERT INTO transactions (transaction_id, transaction_reference, source_account_id, destination_account_id, amount, transaction_type, status, transaction_timestamp)
            VALUES 
            (90050, 'TX-FAILED-HV', 9001, 9002, 50000.00, 'TRANSFER', 'FAILED', '2026-10-15 15:00:00'),
            (90051, 'TX-BLOCKED-HV', 9001, 9002, 50000.00, 'TRANSFER', 'BLOCKED', '2026-10-15 15:05:00');
        `);
        const [failedHv] = await conn.query(`
            SELECT t.transaction_id FROM transactions t
            JOIN fraud_rules r ON r.rule_code = 'RULE_HIGH_VAL'
            WHERE t.transaction_id IN (90050, 90051)
              AND t.status IN ('SUCCESS', 'FLAGGED')
              AND t.amount > r.threshold_value;
        `);
        assert(
            failedHv.length === 0,
            'Detection rules ignore FAILED and BLOCKED transactions per documented compliance semantics'
        );

        // Rollback all edge-case inserts cleanly
        await conn.rollback();
        console.log('[ROLLBACK] All edge-case test records cleanly rolled back');

    } catch (err) {
        console.error('Edge case test error:', err);
        await conn.rollback();
        failed++;
    } finally {
        await conn.end();
        console.log(`\n--- Edge Case Test Summary: ${passed} passed, ${failed} failed ---`);
        if (failed > 0) process.exit(1);
    }
}

runEdgeCaseTests();
