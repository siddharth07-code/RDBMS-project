const app = require('./app');
const config = require('./config');
const pool = require('./db');

const server = app.listen(config.port, () => {
    console.log(`FraudLens Express API server running on port ${config.port}`);
});

process.on('SIGTERM', () => {
    server.close(() => {
        pool.end();
    });
});

process.on('SIGINT', () => {
    server.close(() => {
        pool.end();
    });
});
