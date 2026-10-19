const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/health', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 AS healthy');
        if (rows && rows.length > 0) {
            return res.json({
                status: 'UP',
                database: 'CONNECTED',
                timestamp: new Date().toISOString()
            });
        }
        return res.status(503).json({
            status: 'DOWN',
            database: 'UNAVAILABLE',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        return res.status(503).json({
            status: 'DOWN',
            database: 'ERROR',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
