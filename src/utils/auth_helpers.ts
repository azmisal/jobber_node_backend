// src/utils/authHelpers.ts

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

/* =====================================================
   PASSWORD HELPERS
===================================================== */
const JWT_ACCESS_SECRET: string = process.env.JWT_ACCESS_SECRET || "dev_secret";
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET || "dev_refresh_secret";



export const hashPassword = async (
  password: string
): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

export const verifyPassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(
    plainPassword,
    hashedPassword
  );
};

/* =====================================================
   JWT TOKEN
===================================================== */

export function createAccessToken(payload: any) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: 60 * 60, // 1 hour in seconds (SAFE with TS)
  });
}
export function createRefreshToken(payload: any) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: 60 * 60 * 24 * 30 * 12, // 1 year in seconds (SAFE with TS)
  });
}



/* =====================================================
   AUTH MIDDLEWARE
===================================================== */


export const getCurrentUser = (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    const token =
      authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({
        detail: "Missing authentication token",
      });
    }

    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any;

    req.user = {
      user_id: decoded.user_id,
      username: decoded.username,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      detail: "Invalid or expired token",
    });
  }
};