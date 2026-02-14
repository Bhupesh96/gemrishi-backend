// middleware/verifyTempToken.js
import jwt from 'jsonwebtoken';

export const verifyTempToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.id; // This should be SocietyAdmin's ID
      next();
    } catch (err) {
      res.status(401).json({ message: 'Invalid or expired token' });
    }
  } else {
    res.status(401).json({ message: 'No token provided' });
  }
};
