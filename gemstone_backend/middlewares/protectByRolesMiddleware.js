import jwt from 'jsonwebtoken';
import { SuperAdmin } from '../models/superAdmin.model.js';
import { SocietyAdmin } from '../models/societyAdmin.model.js';
import { User } from '../models/user.model.js';

/**
 * Role-based access middleware
 * @param {Array} allowedRoles - e.g., ['superAdmin', 'admin']
 */
export const protectByRoles = (allowedRoles = []) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // console.log("Decoded user ID from JWT:", decoded.id)

      // Check SuperAdmin (separate model)
      const superAdmin = await SuperAdmin.findById(decoded.id).select('-password');
      if (superAdmin) {
        // console.log('User is SuperAdmin');
        if (allowedRoles.includes('superAdmin')) {
          req.user = { ...superAdmin.toObject(), role: 'superAdmin' };
          return next();
        }
      }

      // Check User (admin, societyAdmin, etc.)
      const societyAdmin = await SocietyAdmin.findById(decoded.id).select('-otp -otpExpiry');
      if (societyAdmin) {
        // console.log('User is SocietyAdmin with role:', societyAdmin.role);
        if (allowedRoles.includes(societyAdmin.role)) {
          req.user = { ...societyAdmin.toObject(), role: societyAdmin.role };
          return next();
        }
      }
      
      // Committee Member and general User roles (merged)
      let user = await User.findById(decoded.id).select('-otp -otpExpiry');
      if (user && allowedRoles.includes(user.role)) {
        // console.log('Matched user role:', user.role);
        req.user = { ...user.toObject(), role: user.role };
        return next();
      }


      return res.status(403).json({ message: 'Access denied: Unauthorized role' });

    } catch (err) {
      return res.status(401).json({ message: 'Token verification failed' });
    }
  };
};
