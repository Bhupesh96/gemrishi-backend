import jwt from 'jsonwebtoken';
import { SocietyAdmin } from '../models/societyAdmin.model.js';
import { User } from '../models/user.model.js'; // societyAdmin model

export const protectSocietyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('TOKEN HEADER:', req.headers.authorization);


  if (authHeader && authHeader.startsWith('Bearer')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const societyadmin = await SocietyAdmin.findById(decoded.id);

      if (!societyadmin) {
        return res.status(403).json({ message: 'Not authorized as society admin' });
      }

      req.user = societyadmin;
      req.role = 'societyAdmin';
      console.log(req.user)
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};
