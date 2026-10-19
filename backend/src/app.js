const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const dashboardRoutes = require('./routes/dashboard');
const transactionRoutes = require('./routes/transactions');
const alertRoutes = require('./routes/alerts');
const researchRoutes = require('./routes/research');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/research', researchRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
