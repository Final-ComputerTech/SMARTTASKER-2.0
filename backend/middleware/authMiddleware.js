const jwt = require('jsonwebtoken');

exports.verifyToken = (roles = []) => {
  return (req, res, next) => {
    // Dev-only: log the raw Authorization header to help debug missing/ malformed tokens
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.log('[auth] incoming Authorization header:', req.headers['authorization']);
      } catch (e) { /* ignore logging errors */ }
    }
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Dev-only debugging to help diagnose unexpected 403s
      if (process.env.NODE_ENV !== 'production') {
        try { console.log('[auth] verifyToken decoded:', decoded, 'requiredRoles:', roles); } catch (e) {}
      }
      if (roles.length && !roles.includes(decoded.role)) {
        if (process.env.NODE_ENV !== 'production') {
          try { console.log(`[auth] role check failed: token role=${decoded.role} not in requiredRoles=${roles}`); } catch (e) {}
        }
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
};
