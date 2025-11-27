const authService = require('../services/authService');

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        message: 'Please include Authorization header with Bearer token',
      });
    }

    const decoded = authService.verifyToken(token);

    if (!decoded) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token',
        message: 'Please log in again',
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: error.message,
    });
  }
};

module.exports = {
  authenticateToken,
};
