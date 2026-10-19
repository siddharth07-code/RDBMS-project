const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
    port: parseInt(process.env.PORT, 10) || 5001,
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT, 10) || 3307,
        user: process.env.DB_USER || 'fraudlens_user',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'fraudlens_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    }
};
