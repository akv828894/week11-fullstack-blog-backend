function requestLogger(req, res, next) {
  const timestamp = new Date().toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  console.log(`[${req.method}] ${req.originalUrl} - ${timestamp}`);
  next();
}

module.exports = requestLogger;
