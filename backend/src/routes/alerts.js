const express = require('express');
const pool = require('../db');

const router = express.Router();

const ALLOWED_SORT_COLUMNS = {
    alert_id: 'a.alert_id',
    risk_score: 'a.risk_score',
    triggered_at: 'a.triggered_at',
    status: 'a.status'
};

const ALLOWED_ALERT_STATUSES = ['PENDING', 'REVIEWED', 'CONFIRMED_FRAUD', 'FALSE_POSITIVE'];

router.get('/', async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const offset = (page - 1) * limit;

        const whereClauses = [];
        const params = [];

        if (req.query.status) {
            const statusUpper = req.query.status.toUpperCase();
            if (ALLOWED_ALERT_STATUSES.includes(statusUpper)) {
                whereClauses.push('a.status = ?');
                params.push(statusUpper);
            }
        }

        if (req.query.rule_code) {
            whereClauses.push('r.rule_code = ?');
            params.push(req.query.rule_code.trim());
        }

        if (req.query.search) {
            whereClauses.push('t.transaction_reference LIKE ?');
            params.push(`%${req.query.search.trim()}%`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const sortParam = req.query.sort_by || 'triggered_at';
        const sortCol = ALLOWED_SORT_COLUMNS[sortParam] || 'a.triggered_at';
        const orderParam = (req.query.order || 'desc').toUpperCase();
        const sortOrder = orderParam === 'ASC' ? 'ASC' : 'DESC';

        const countSql = `
            SELECT COUNT(*) AS total_count 
            FROM fraud_alerts a
            JOIN transactions t ON a.transaction_id = t.transaction_id
            JOIN fraud_rules r ON a.rule_id = r.rule_id
            ${whereSql}
        `;
        const [[countResult]] = await pool.query(countSql, params);
        const total = Number(countResult.total_count);

        const dataSql = `
            SELECT 
                a.alert_id,
                a.transaction_id,
                t.transaction_reference,
                t.amount AS transaction_amount,
                t.status AS transaction_status,
                t.is_fraud_ground_truth,
                a.rule_id,
                r.rule_code,
                r.rule_name,
                r.severity AS rule_severity,
                a.risk_score,
                a.status AS alert_status,
                a.investigation_notes,
                a.triggered_at,
                a.resolved_at
            FROM fraud_alerts a
            JOIN transactions t ON a.transaction_id = t.transaction_id
            JOIN fraud_rules r ON a.rule_id = r.rule_id
            ${whereSql}
            ORDER BY ${sortCol} ${sortOrder}
            LIMIT ? OFFSET ?
        `;

        const queryParams = [...params, limit, offset];
        const [rows] = await pool.query(dataSql, queryParams);

        const data = rows.map(r => ({
            alert_id: Number(r.alert_id),
            transaction_id: Number(r.transaction_id),
            transaction_reference: r.transaction_reference,
            transaction_amount: parseFloat(r.transaction_amount),
            transaction_status: r.transaction_status,
            is_fraud_ground_truth: Number(r.is_fraud_ground_truth),
            rule_id: Number(r.rule_id),
            rule_code: r.rule_code,
            rule_name: r.rule_name,
            rule_severity: r.rule_severity,
            risk_score: parseFloat(r.risk_score),
            status: r.alert_status,
            investigation_notes: r.investigation_notes,
            triggered_at: r.triggered_at,
            resolved_at: r.resolved_at
        }));

        return res.json({
            data,
            pagination: {
                total,
                page,
                limit,
                total_pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const alertId = parseInt(req.params.id, 10);
        if (isNaN(alertId) || alertId <= 0) {
            return res.status(400).json({ error: 'Invalid alert ID' });
        }

        const sql = `
            SELECT 
                a.alert_id,
                a.risk_score,
                a.status AS alert_status,
                a.investigation_notes,
                a.triggered_at,
                a.resolved_at,
                r.rule_id,
                r.rule_code,
                r.rule_name,
                r.description AS rule_description,
                r.severity AS rule_severity,
                r.threshold_value,
                r.time_window_minutes,
                t.transaction_id,
                t.transaction_reference,
                t.amount AS transaction_amount,
                t.transaction_type,
                t.status AS transaction_status,
                t.is_fraud_ground_truth,
                t.transaction_timestamp,
                src.account_id AS source_account_id,
                src.account_number AS source_account_number,
                src_c.customer_id AS source_customer_id,
                src_c.first_name AS source_customer_first_name,
                src_c.last_name AS source_customer_last_name,
                dst.account_id AS destination_account_id,
                dst.account_number AS destination_account_number,
                dst_c.customer_id AS destination_customer_id,
                dst_c.first_name AS destination_customer_first_name,
                dst_c.last_name AS destination_customer_last_name
            FROM fraud_alerts a
            JOIN fraud_rules r ON a.rule_id = r.rule_id
            JOIN transactions t ON a.transaction_id = t.transaction_id
            JOIN accounts src ON t.source_account_id = src.account_id
            JOIN customers src_c ON src.customer_id = src_c.customer_id
            JOIN accounts dst ON t.destination_account_id = dst.account_id
            JOIN customers dst_c ON dst.customer_id = dst_c.customer_id
            WHERE a.alert_id = ?
        `;

        const [rows] = await pool.query(sql, [alertId]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        const r = rows[0];

        return res.json({
            alert_id: Number(r.alert_id),
            risk_score: parseFloat(r.risk_score),
            status: r.alert_status,
            investigation_notes: r.investigation_notes,
            triggered_at: r.triggered_at,
            resolved_at: r.resolved_at,
            rule: {
                rule_id: Number(r.rule_id),
                rule_code: r.rule_code,
                rule_name: r.rule_name,
                description: r.rule_description,
                severity: r.rule_severity,
                threshold_value: r.threshold_value ? parseFloat(r.threshold_value) : null,
                time_window_minutes: r.time_window_minutes ? Number(r.time_window_minutes) : null
            },
            transaction: {
                transaction_id: Number(r.transaction_id),
                transaction_reference: r.transaction_reference,
                amount: parseFloat(r.transaction_amount),
                transaction_type: r.transaction_type,
                status: r.transaction_status,
                is_fraud_ground_truth: Number(r.is_fraud_ground_truth),
                transaction_timestamp: r.transaction_timestamp,
                source_account: {
                    account_id: Number(r.source_account_id),
                    account_number: r.source_account_number,
                    customer_name: `${r.source_customer_first_name} ${r.source_customer_last_name}`
                },
                destination_account: {
                    account_id: Number(r.destination_account_id),
                    account_number: r.destination_account_number,
                    customer_name: `${r.destination_customer_first_name} ${r.destination_customer_last_name}`
                }
            }
        });
    } catch (err) {
        next(err);
    }
});

router.patch('/:id/status', async (req, res, next) => {
    try {
        const alertId = parseInt(req.params.id, 10);
        if (isNaN(alertId) || alertId <= 0) {
            return res.status(400).json({ error: 'Invalid alert ID' });
        }

        const { status, investigation_notes } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const statusUpper = status.toUpperCase();
        if (!ALLOWED_ALERT_STATUSES.includes(statusUpper)) {
            return res.status(400).json({
                error: `Invalid status. Allowed values: ${ALLOWED_ALERT_STATUSES.join(', ')}`
            });
        }

        const [check] = await pool.query('SELECT alert_id FROM fraud_alerts WHERE alert_id = ?', [alertId]);
        if (!check || check.length === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        const resolvedAt = (statusUpper === 'CONFIRMED_FRAUD' || statusUpper === 'FALSE_POSITIVE' || statusUpper === 'REVIEWED')
            ? new Date()
            : null;

        const updateSql = `
            UPDATE fraud_alerts 
            SET status = ?, 
                investigation_notes = COALESCE(?, investigation_notes),
                resolved_at = ?
            WHERE alert_id = ?
        `;

        await pool.query(updateSql, [
            statusUpper,
            investigation_notes !== undefined ? investigation_notes : null,
            resolvedAt,
            alertId
        ]);

        const [updatedRows] = await pool.query(`
            SELECT alert_id, transaction_id, rule_id, risk_score, status, investigation_notes, triggered_at, resolved_at 
            FROM fraud_alerts 
            WHERE alert_id = ?
        `, [alertId]);

        return res.json({
            message: 'Alert status updated successfully',
            alert: updatedRows[0]
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
