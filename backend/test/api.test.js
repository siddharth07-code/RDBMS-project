const http = require('http');
const app = require('../src/app');
const pool = require('../src/db');

let server;
const PORT = 5099;

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: '127.0.0.1',
            port: PORT,
            path: encodeURI(path),
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
            }
        };

        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    parsed = data;
                }
                resolve({ status: res.statusCode, data: parsed });
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runTests() {
    console.log('--- Starting FraudLens Backend API Test Suite ---');

    await new Promise(resolve => {
        server = app.listen(PORT, resolve);
    });

    let passed = 0;
    let failed = 0;

    function assert(condition, testName) {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passed++;
        } else {
            console.error(`[FAIL] ${testName}`);
            failed++;
        }
    }

    try {
        const resHealth = await request('GET', '/api/health');
        assert(resHealth.status === 200 && resHealth.data.status === 'UP' && resHealth.data.database === 'CONNECTED', 'GET /api/health returns UP and CONNECTED');

        const resSummary = await request('GET', '/api/dashboard/summary');
        assert(
            resSummary.status === 200 &&
            resSummary.data.transactions.total_count === 10000 &&
            resSummary.data.alerts.total_alerts === 507,
            'GET /api/dashboard/summary returns exact transactions (10000) and alerts (507)'
        );

        const resTrends = await request('GET', '/api/dashboard/transaction-trends');
        assert(
            resTrends.status === 200 && Array.isArray(resTrends.data.trends) && resTrends.data.trends.length > 0,
            'GET /api/dashboard/transaction-trends returns daily trends'
        );

        const resAlertsByRule = await request('GET', '/api/dashboard/alerts-by-rule');
        assert(
            resAlertsByRule.status === 200 && resAlertsByRule.data.rules.length === 3,
            'GET /api/dashboard/alerts-by-rule returns 3 active rules'
        );

        const resTx = await request('GET', '/api/transactions?page=1&limit=10&status=SUCCESS');
        assert(
            resTx.status === 200 &&
            resTx.data.data.length === 10 &&
            resTx.data.pagination.total > 9000,
            'GET /api/transactions paginates and filters by status=SUCCESS'
        );

        const resTxSearch = await request('GET', '/api/transactions?search=TX-HV');
        assert(
            resTxSearch.status === 200 &&
            resTxSearch.data.data.every(t => t.transaction_reference.includes('TX-HV')),
            'GET /api/transactions searches by reference'
        );

        const resTxSqlInj = await request('GET', "/api/transactions?search=' OR 1=1 --");
        assert(
            resTxSqlInj.status === 200 && resTxSqlInj.data.data.length === 0,
            'GET /api/transactions resists SQL injection in search parameter'
        );

        const resTxDetail = await request('GET', '/api/transactions/1');
        assert(
            resTxDetail.status === 200 &&
            resTxDetail.data.transaction_id === 1 &&
            resTxDetail.data.source_account.customer.email.length > 0,
            'GET /api/transactions/:id returns transaction with customer and account joins'
        );

        const resTxNotFound = await request('GET', '/api/transactions/999999');
        assert(resTxNotFound.status === 404, 'GET /api/transactions/999999 returns 404');

        const resTxInvalidId = await request('GET', '/api/transactions/invalid-id');
        assert(resTxInvalidId.status === 400, 'GET /api/transactions/invalid-id returns 400');

        const resAlerts = await request('GET', '/api/alerts?page=1&limit=10&status=PENDING');
        assert(
            resAlerts.status === 200 &&
            resAlerts.data.data.length === 10 &&
            resAlerts.data.pagination.total === 507,
            'GET /api/alerts paginates and lists pending alerts'
        );

        const targetAlertId = resAlerts.data.data[0].alert_id;

        const resAlertDetail = await request('GET', `/api/alerts/${targetAlertId}`);
        assert(
            resAlertDetail.status === 200 &&
            resAlertDetail.data.alert_id === targetAlertId &&
            resAlertDetail.data.rule.rule_code.length > 0,
            'GET /api/alerts/:id returns alert details with rule and transaction details'
        );

        const [[origAlert]] = await pool.query(
            'SELECT status, investigation_notes, resolved_at FROM fraud_alerts WHERE alert_id = ?',
            [targetAlertId]
        );

        const resPatch = await request('PATCH', `/api/alerts/${targetAlertId}/status`, {
            status: 'REVIEWED',
            investigation_notes: 'Automated test investigation note'
        });
        assert(
            resPatch.status === 200 && resPatch.data.alert.status === 'REVIEWED',
            'PATCH /api/alerts/:id/status updates status to REVIEWED'
        );

        const resPatchInvalid = await request('PATCH', `/api/alerts/${targetAlertId}/status`, {
            status: 'INVALID_STATUS'
        });
        assert(resPatchInvalid.status === 400, 'PATCH /api/alerts/:id/status rejects invalid status enum');

        const resPatchNotFound = await request('PATCH', '/api/alerts/999999/status', {
            status: 'REVIEWED'
        });
        assert(resPatchNotFound.status === 404, 'PATCH /api/alerts/999999/status returns 404');

        await pool.query(
            'UPDATE fraud_alerts SET status = ?, investigation_notes = ?, resolved_at = ? WHERE alert_id = ?',
            [origAlert.status, origAlert.investigation_notes, origAlert.resolved_at, targetAlertId]
        );
        console.log(`[RESTORE] Restored alert ID ${targetAlertId} to original state`);

        const resMetrics = await request('GET', '/api/research/fraud-metrics');
        assert(
            resMetrics.status === 200 &&
            resMetrics.data.confusion_matrix.true_positives === 393 &&
            resMetrics.data.confusion_matrix.false_positives === 113 &&
            resMetrics.data.confusion_matrix.false_negatives === 271 &&
            resMetrics.data.confusion_matrix.true_negatives === 9223 &&
            resMetrics.data.performance_metrics.precision === 0.7767 &&
            resMetrics.data.performance_metrics.recall === 0.5919,
            'GET /api/research/fraud-metrics returns exact confusion matrix & metrics'
        );

        const resRulePerf = await request('GET', '/api/research/rule-performance');
        assert(
            resRulePerf.status === 200 &&
            resRulePerf.data.rules.length === 3 &&
            resRulePerf.data.rules.some(r => r.rule_code === 'RULE_HIGH_VAL' && r.total_alerts === 145),
            'GET /api/research/rule-performance returns per-rule metrics'
        );

        const resNotFound = await request('GET', '/api/unknown-endpoint');
        assert(resNotFound.status === 404, 'Unknown endpoint returns 404');

    } catch (err) {
        console.error('Test execution error:', err);
        failed++;
    } finally {
        server.close();
        await pool.end();
        console.log(`\n--- Test Results: ${passed} passed, ${failed} failed ---`);
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
