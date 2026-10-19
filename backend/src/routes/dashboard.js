const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/summary', async (req, res, next) => {
    try {
        const txStatsSql = `
            SELECT 
                COUNT(*) AS total_transactions,
                COALESCE(SUM(amount), 0.00) AS total_monetary_volume,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS successful_count,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
                SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked_count,
                SUM(CASE WHEN status = 'FLAGGED' THEN 1 ELSE 0 END) AS flagged_count,
                SUM(CASE WHEN is_fraud_ground_truth = 1 THEN 1 ELSE 0 END) AS ground_truth_fraud_count
            FROM transactions
        `;
        const [[txStats]] = await pool.query(txStatsSql);

        const alertStatsSql = `
            SELECT 
                COUNT(*) AS total_alerts,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_alerts_count,
                SUM(CASE WHEN status = 'REVIEWED' THEN 1 ELSE 0 END) AS reviewed_alerts_count,
                SUM(CASE WHEN status = 'CONFIRMED_FRAUD' THEN 1 ELSE 0 END) AS confirmed_fraud_alerts_count,
                SUM(CASE WHEN status = 'FALSE_POSITIVE' THEN 1 ELSE 0 END) AS false_positive_alerts_count
            FROM fraud_alerts
        `;
        const [[alertStats]] = await pool.query(alertStatsSql);

        return res.json({
            transactions: {
                total_count: Number(txStats.total_transactions) || 0,
                total_volume: parseFloat(txStats.total_monetary_volume) || 0.0,
                by_status: {
                    success: Number(txStats.successful_count) || 0,
                    failed: Number(txStats.failed_count) || 0,
                    blocked: Number(txStats.blocked_count) || 0,
                    flagged: Number(txStats.flagged_count) || 0
                },
                ground_truth_fraud_count: Number(txStats.ground_truth_fraud_count) || 0
            },
            alerts: {
                total_alerts: Number(alertStats.total_alerts) || 0,
                pending_investigation: Number(alertStats.pending_alerts_count) || 0,
                by_status: {
                    pending: Number(alertStats.pending_alerts_count) || 0,
                    reviewed: Number(alertStats.reviewed_alerts_count) || 0,
                    confirmed_fraud: Number(alertStats.confirmed_fraud_alerts_count) || 0,
                    false_positive: Number(alertStats.false_positive_alerts_count) || 0
                }
            }
        });
    } catch (err) {
        next(err);
    }
});

router.get('/transaction-trends', async (req, res, next) => {
    try {
        const sql = `
            SELECT 
                DATE(transaction_timestamp) AS tx_date,
                COUNT(*) AS transaction_count,
                COALESCE(SUM(amount), 0.00) AS total_amount,
                SUM(CASE WHEN is_fraud_ground_truth = 1 THEN 1 ELSE 0 END) AS fraud_count
            FROM transactions
            GROUP BY DATE(transaction_timestamp)
            ORDER BY tx_date ASC
        `;
        const [rows] = await pool.query(sql);

        const trends = rows.map(r => ({
            date: r.tx_date,
            transaction_count: Number(r.transaction_count),
            total_amount: parseFloat(r.total_amount),
            fraud_count: Number(r.fraud_count)
        }));

        return res.json({ trends });
    } catch (err) {
        next(err);
    }
});

router.get('/alerts-by-rule', async (req, res, next) => {
    try {
        const sql = `
            SELECT 
                r.rule_id,
                r.rule_code,
                r.rule_name,
                r.severity,
                COUNT(a.alert_id) AS alert_count,
                COALESCE(AVG(a.risk_score), 0.00) AS avg_risk_score
            FROM fraud_rules r
            LEFT JOIN fraud_alerts a ON r.rule_id = a.rule_id
            GROUP BY r.rule_id, r.rule_code, r.rule_name, r.severity
            ORDER BY alert_count DESC
        `;
        const [rows] = await pool.query(sql);

        const rules = rows.map(r => ({
            rule_id: Number(r.rule_id),
            rule_code: r.rule_code,
            rule_name: r.rule_name,
            severity: r.severity,
            alert_count: Number(r.alert_count),
            avg_risk_score: parseFloat(r.avg_risk_score)
        }));

        return res.json({ rules });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
