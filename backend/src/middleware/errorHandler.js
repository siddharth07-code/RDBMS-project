function errorHandler(err, req, res, next) {
    res.status(500).json({
        error: 'An internal server error occurred while processing the database request.',
        status: 500
    });
}

function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'Requested API endpoint not found',
        status: 404
    });
}

module.exports = {
    errorHandler,
    notFoundHandler
};
