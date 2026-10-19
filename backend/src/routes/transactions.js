const express = require('express');
const pool = require('../db');

const router = express.Router();

const ALLOWED_SORT_COLUMNS = {
    transaction_id: 't.transaction_id',
    amount: 't.amount',
    transaction_timestamp: 't.transaction_timestamp',
    status: 't.status',
    transaction_type: 't.transaction_type'
};

const ALLOWED_STATUSES = ['SUCCESS', 'FAILED', 'FLAGGED', 'BLOCKED'];
const ALLOWED_TYPES = ['TRANSFER', 'PAYMENT', 'WITHDRAWAL', 'DEPOSIT'];

router.get('/', async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const offset = (page - 1) * limit;

        const whereClauses = [];
        const params = [];

        if (req.query.search) {
            whereClauses.push('t.transaction_reference LIKE ?');
            params.push(`%${req.query.search.trim()}%`);
        }

        if (req.query.status) {
            const statusUpper = req.query.status.toUpperCase();
            if (ALLOWED_STATUSES.includes(statusUpper)) {
                whereClauses.push('t.status = ?');
                params.push(statusUpper);
            }
        }

        if (req.query.transaction_type) {
            const typeUpper = req.query.transaction_type.toUpperCase();
            if (ALLOWED_TYPES.includes(typeUpper)) {
                whereClauses.push('t.transaction_type = ?');
                params.push(typeUpper);
            }
        }

        if (req.query.is_fraud_ground_truth !== undefined && req.query.is_fraud_ground_truth !== '') {
            const val = parseInt(req.query.is_fraud_ground_truth, 10);
            if (val === 0 || val === 1) {
                whereClauses.push('t.is_fraud_ground_truth = ?');
                params.push(val);
            }
        }

        if (req.query.start_date) {
            const startDate = new Date(req.query.start_date);
            if (!isNaN(startDate.getTime())) {
                whereClauses.push('t.transaction_timestamp >= ?');
                params.push(req.query.start_date);
            }
        }

        if (req.query.end_date) {
            const endDate = new Date(req.query.end_date);
            if (!isNaN(endDate.getTime())) {
                whereClauses.push('t.transaction_timestamp <= ?');
                params.push(req.query.end_date);
            }
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const sortParam = req.query.sort_by || 'transaction_timestamp';
        const sortCol = ALLOWED_SORT_COLUMNS[sortParam] || 't.transaction_timestamp';
        const orderParam = (req.query.order || 'desc').toUpperCase();
        const sortOrder = orderParam === 'ASC' ? 'ASC' : 'DESC';

        const countSql = `SELECT COUNT(*) AS total_count FROM transactions t ${whereSql}`;
        const [[countResult]] = await pool.query(countSql, params);
        const total = Number(countResult.total_count);

        const dataSql = `
            SELECT 
                t.transaction_id,
                t.transaction_reference,
                t.source_account_id,
                src.account_number AS source_account_number,
                t.destination_account_id,
                dst.account_number AS destination_account_number,
                t.amount,
                t.transaction_type,
                t.status,
                t.is_fraud_ground_truth,
                t.transaction_timestamp
            FROM transactions t
            JOIN accounts src ON t.source_account_id = src.account_id
            JOIN accounts dst ON t.destination_account_id = dst.account_id
            ${whereSql}
            ORDER BY ${sortCol} ${sortOrder}
            LIMIT ? OFFSET ?
        `;

        const queryParams = [...params, limit, offset];
        const [rows] = await pool.query(dataSql, queryParams);

        const data = rows.map(r => ({
            transaction_id: Number(r.transaction_id),
            transaction_reference: r.transaction_reference,
            source_account_id: Number(r.source_account_id),
            source_account_number: r.source_account_number,
            destination_account_id: Number(r.destination_account_id),
            destination_account_number: r.destination_account_number,
            amount: parseFloat(r.amount),
            transaction_type: r.transaction_type,
            status: r.status,
            is_fraud_ground_truth: Number(r.is_fraud_ground_truth),
            transaction_timestamp: r.transaction_timestamp
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
        const txId = parseInt(req.params.id, 10);
        if (isNaN(txId) || txId <= 0) {
            return res.status(400).json({ error: 'Invalid transaction ID' });
        }

        const sql = `
            SELECT 
                t.transaction_id,
                t.transaction_reference,
                t.amount,
                t.transaction_type,
                t.status,
                t.is_fraud_ground_truth,
                t.transaction_timestamp,
                src.account_id AS source_account_id,
                src.account_number AS source_account_number,
                src.account_type AS source_account_type,
                src.balance AS source_account_balance,
                src_c.customer_id AS source_customer_id,
                src_c.first_name AS source_customer_first_name,
                src_c.last_name AS source_customer_last_name,
                src_c.email AS source_customer_email,
                dst.account_id AS destination_account_id,
                dst.account_number AS destination_account_number,
                dst.account_type AS destination_account_type,
                dst.balance AS destination_account_balance,
                dst_c.customer_id AS destination_customer_id,
                dst_c.first_name AS destination_customer_first_name,
                dst_c.last_name AS destination_customer_last_name,
                dst_c.email AS destination_customer_email
            FROM transactions t
            JOIN accounts src ON t.source_account_id = src.account_id
            JOIN customers src_c ON src.customer_id = src_c.customer_id
            JOIN accounts dst ON t.destination_account_id = dst.account_id
            JOIN customers dst_c ON dst.customer_id = dst_c.customer_id
            WHERE t.transaction_id = ?
        `;

        const [rows] = await pool.query(sql, [txId]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const r = rows[0];

        const alertSql = `
            SELECT 
                a.alert_id,
                a.rule_id,
                r.rule_code,
                r.rule_name,
                r.severity,
                a.risk_score,
                a.status AS alert_status,
                a.investigation_notes,
                a.triggered_at,
                a.resolved_at
            FROM fraud_alerts a
            JOIN fraud_rules r ON a.rule_id = r.rule_id
            WHERE a.transaction_id = ?
        `;
        const [alerts] = await pool.query(alertSql, [txId]);

        return res.json({
            transaction_id: Number(r.transaction_id),
            transaction_reference: r.transaction_reference,
            amount: parseFloat(r.amount),
            transaction_type: r.transaction_type,
            status: r.status,
            is_fraud_ground_truth: Number(r.is_fraud_ground_truth),
            transaction_timestamp: r.transaction_timestamp,
            source_account: {
                account_id: Number(r.source_account_id),
                account_number: r.source_account_number,
                account_type: r.source_account_type,
                balance: parseFloat(r.source_account_balance),
                customer: {
                    customer_id: Number(r.source_customer_id),
                    first_name: r.source_customer_first_name,
                    last_name: r.source_customer_last_name,
                    email: r.source_customer_email
                }
            },
            destination_account: {
                account_id: Number(r.destination_account_id),
                account_number: r.destination_account_number,
                account_type: r.destination_account_type,
                balance: parseFloat(r.destination_account_balance),
                customer: {
                    customer_id: Number(r.destination_customer_id),
                    first_name: r.destination_customer_first_name,
                    last_name: r.destination_customer_last_name,
                    email: r.destination_customer_email
                }
            },
            associated_alerts: alerts.map(a => ({
                alert_id: Number(a.alert_id),
                rule_id: Number(a.rule_id),
                rule_code: a.rule_code,
                rule_name: a.rule_name,
                severity: a.severity,
                risk_score: parseFloat(a.risk_score),
                status: a.alert_status,
                investigation_notes: a.investigation_notes,
                triggered_at: a.triggered_at,
                resolved_at: a.resolved_at
            }))
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
