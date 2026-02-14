import jwt from 'jsonwebtoken';
import { SuperAdmin } from '../models/superAdmin.model.js';
import { SocietyAdmin } from '../models/societyAdmin.model.js';
// import { User } from '../models/user.model.js';

export const protectAnnouncementAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // First check for SuperAdmin
      const superAdmin = await SuperAdmin.findById(decoded.id).select('-password');
      if (superAdmin) {
        req.user = { ...superAdmin.toObject(), role: 'SuperAdmin' };
        return next();
      }

      // Check for SocietyAdmin inside User model
      const societyAdmin = await SocietyAdmin.findById(decoded.id).select('-otp -otpExpiry');
      if (societyAdmin) {
        req.user = { ...societyAdmin.toObject(), role: 'societyAdmin' };
        return next();
      }

      return res.status(401).json({ message: 'Unauthorized: Only SuperAdmin and SocietyAdmin allowed.' });

    } catch (err) {
      return res.status(401).json({ message: 'Token verification failed' });
    }
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }
};
