import jwt from "jsonwebtoken";
import { SuperAdmin } from "../models/superAdmin.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { Retailer } from "../models/retailer.model.js";
import { Admin } from "../models/Admin.model.js";

// Middleware for the super admin only not in use currently
export const protectSuperAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await SuperAdmin.findById(decoded.id).select("-password");
      // req.user_data = await User.findById(decoded.id);
      // req.SecurityGuard = await SecurityGuard.findById(decoded.id); // need SecurityGuard model

      // req.SecurityGuard = await SecurityGuard.findById(decoded.id);
      // req.User = await User.findById(decoded.id);
      req.user = await SuperAdmin.findById(decoded.id).select("-password");
      if (!req.user) {
        return res
          .status(403)
          .json({ message: "Not authorized as super admin" });
      }

      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

// Middleware for the admin only
export const protectAdmin = async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1] || req.cookies.token;

  if (!token) {
    return res
      .status(401)
      .clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      })
      .json({
        success: false,
        msg: "Unauthorized access: No token provided, Try Login Again",
      });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res
        .status(401)
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        })
        .json({
          success: false,
          msg: "Unauthorized access: Your session token has expired, Try Login Again",
        });
    }
    return res
      .status(401)
      .clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      })
      .json({
        success: false,
        msg: "Unauthorized access: Invalid session token, Try Login Again",
      });
  }

  const user = await Admin.findById(decoded.id).select("-password");
  if (!user) {
    return res
      .status(403)
      .json({ success: false, message: "Not authorized as admin" });
  }

  req.user = user;
  next();
};

// Middleware for the user only
export const protect = asyncHandler(async (req, res, next) => {
  const token =
    req.header("Authorization")?.split(" ")[1] || req.cookies.usertoken;

  if (!token) {
    return res
      .status(401)
      .clearCookie("usertoken", {
        /* cookie options */
      })
      .json({ success: false, msg: "Unauthorized access: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      "email fullName mobileNo",
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, msg: "No user found for this token" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .clearCookie("usertoken", {
        /* cookie options */
      })
      .json({ success: false, msg: "Unauthorized access: Invalid token" });
  }
});

// Middleware for the Retailer only
export const protectRetailer = asyncHandler(async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1] || req.cookies.token;
  if (!token) {
    return res.status(401).json({ success: false, msg: "Unauthorized access" });
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (!decoded) {
    return res.status(401).json({ success: false, msg: "Unauthorized access" });
  }
  const user = await Retailer.findById(decoded.id).select(
    "email fullName mobileNo isActive isBlocked",
  );
  if (!user) {
    return res.status(404).json({ success: false, msg: "No Retailer found" });
  }

  if (user.isActive === false) {
    return res.status(401).json({
      success: false,
      msg: "Your account has been Deactivated, Please Reactivate Your Account.",
    });
  }

  if (user.isBlocked === true) {
    return res.status(401).json({
      success: false,
      msg: "Your account has been Blocked By Wholesaler, Please Contact Your Wholesaler.",
    });
  }

  req.user = user;
  next();
});

// For uer only
// checking for the if request is logged in or not if not or anything else then next() otherwise return protect(req, res, next); to middleware
export const checkUserLoggedIn = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.header("Authorization")?.split(" ")[1] || req.cookies.usertoken;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user exists
        const user = await User.findById(decoded.id).select(
          "email fullName mobileNo",
        );

        if (user) {
          req.user = user; // Attach user to request
        }
        // If user not found, we just move on as guest (req.user remains undefined)
      } catch (error) {
        // Token verification failed (Expired or Invalid).
        // We do NOT return an error. We just treat them as a guest.
        console.log("Guest access: Invalid or expired token ignored.");
      }
    }
  } catch (err) {
    // Safety catch for any other errors, proceed as guest
    console.error("Auth Middleware Error:", err);
  }

  // ALWAYS call next() to let the controller handle the logic
  next();
});
// export const protectUser = async (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (authHeader && authHeader.startsWith('Bearer')) {
//     try {
//       const token = authHeader.split(' ')[1];
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);

//       const user_data = await User.findById(decoded.id).select('-password');
//       if(!user_data){
//         res.status(401).json({ message: 'Not Authorized, Token Failed, User Not Found' });
//       }
//       req.user_data = await User.findById(decoded.id).select('-password');

//       next();
//     } catch (err) {
//       res.status(401).json({ message: 'Not authorized, token failed' });
//     }
//   } else {
//     res.status(401).json({ message: 'Not authorized, no token' });
//   }
// };
