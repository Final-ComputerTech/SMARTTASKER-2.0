module.exports = (err, req, res, next) => {
  console.error(err);

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const messages = err.errors ? err.errors.map(e => e.message) : [err.message];
    return res.status(400).json({ error: messages.join('; ') });
  }

  if (err.status) return res.status(err.status).json({ error: err.message || 'Error' });

  res.status(500).json({ error: err.message || 'Internal Server Error' });
};
