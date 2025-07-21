import jwt from "jsonwebtoken";

import { User } from "../models/user.models.js";
import asyncHandler from "../utils/asyncHandler.js";


export const isLoggedIn = async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({
      status: 401,
      message: "User not logged in",
      success: false
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded._id).select("-password"); 

    if (!user) {
      return res.status(401).json({
        status: 401,
        message: "Invalid token: user not found",
        success: false
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      status: 401,
      message: "Invalid token",
      error: err.message,
      success: false
    });
  }
};
