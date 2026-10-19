const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/fraud-metrics', async (req, res, next) => {
    try {
        const sql = `
            SELECT 
                t.is_fraud_ground_truth AS ground_truth,
                CASE WHEN a.transaction_id IS NOT NULL THEN 1 ELSE 0 END AS alert_generated,
                COUNT(DISTINCT t.transaction_id) AS tx_count
            FROM transactions t
            LEFT JOIN fraud_alerts a ON t.transaction_id = a.transaction_id
            GROUP BY t.is_fraud_ground_truth, CASE WHEN a.transaction_id IS NOT NULL THEN 1 ELSE 0 END
        `;
        const [rows] = await pool.query(sql);

        let tp = 0;
        let fp = 0;
        let fn = 0;
        let tn = 0;

        for (const r of rows) {
            const gt = Number(r.ground_truth);
            const ag = Number(r.alert_generated);
            const count = Number(r.tx_count);

            if (gt === 1 && ag === 1) tp = count;
            else if (gt === 0 && ag === 1) fp = count;
            else if (gt === 1 && ag === 0) fn = count;
            else if (gt === 0 && ag === 0) tn = count;
        }

        const totalTransactions = tp + fp + fn + tn;
        const precision = (tp + fp) > 0 ? parseFloat((tp / (tp + fp)).toFixed(4)) : 0.0;
        const recall = (tp + fn) > 0 ? parseFloat((tp / (tp + fn)).toFixed(4)) : 0.0;
        const accuracy = totalTransactions > 0 ? parseFloat(((tp + tn) / totalTransactions).toFixed(4)) : 0.0;

        return res.json({
            confusion_matrix: {
                true_positives: tp,
                false_positives: fp,
                false_negatives: fn,
                true_negatives: tn,
                total_transactions: totalTransactions
            },
            performance_metrics: {
                precision,
                recall,
                accuracy
            },
            note: 'Synthetic evaluation data for academic RDBMS benchmarking only.'
        });
    } catch (err) {
        next(err);
    }
});

router.get('/rule-performance', async (req, res, next) => {
    try {
        const sql = `
            SELECT 
                r.rule_id,
                r.rule_code,
                r.rule_name,
                r.severity,
                COUNT(a.alert_id) AS total_alerts,
                COUNT(DISTINCT a.transaction_id) AS unique_transactions_flagged,
                COUNT(DISTINCT CASE WHEN t.is_fraud_ground_truth = 1 THEN a.transaction_id END) AS true_positive_tx,
                COUNT(DISTINCT CASE WHEN t.is_fraud_ground_truth = 0 THEN a.transaction_id END) AS false_positive_tx
            FROM fraud_rules r
            LEFT JOIN fraud_alerts a ON r.rule_id = a.rule_id
            LEFT JOIN transactions t ON a.transaction_id = t.transaction_id
            GROUP BY r.rule_id, r.rule_code, r.rule_name, r.severity
            ORDER BY total_alerts DESC
        `;
        const [rows] = await pool.query(sql);

        const rules = rows.map(r => {
            const tp = Number(r.true_positive_tx);
            const fp = Number(r.false_positive_tx);
            const totalTx = Number(r.unique_transactions_flagged);
            const rulePrecision = totalTx > 0 ? parseFloat((tp / totalTx).toFixed(4)) : 0.0;

            return {
                rule_id: Number(r.rule_id),
                rule_code: r.rule_code,
                rule_name: r.rule_name,
                severity: r.severity,
                total_alerts: Number(r.total_alerts),
                unique_transactions_flagged: totalTx,
                true_positive_transactions: tp,
                false_positive_transactions: fp,
                precision: rulePrecision
            };
        });

        return res.json({
            rules,
            note: 'Evaluated on deterministic synthetic dataset.'
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
