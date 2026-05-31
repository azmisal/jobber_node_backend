// src/utils/authHelpers.ts

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

/* =====================================================
   PASSWORD HELPERS
===================================================== */
const JWT_SECRET: string = process.env.JWT_SECRET || "dev_secret";



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
  return jwt.sign(
    payload,
    JWT_SECRET,
    {
      expiresIn: "60m" as const, // 🔥 IMPORTANT FIX
    }
  );
}

/* =====================================================
   AUTH MIDDLEWARE
===================================================== */
  
export const getCurrentUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Bearer token
    const authHeader =
      req.headers.authorization;

    if (
      authHeader &&
      authHeader.startsWith("Bearer ")
    ) {
      token = authHeader.split(" ")[1];
    }

    // Cookie fallback
    if (!token && req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return res.status(401).json({
        detail:
          "Could not validate active session credentials.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as any;

    if (
      !decoded.user_id ||
      !decoded.username
    ) {
      return res.status(401).json({
        detail:
          "Could not validate active session credentials.",
      });
    }

    req.user = {
      user_id: decoded.user_id,
      username: decoded.username,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      detail:
        "Could not validate active session credentials.",
    });
  }
};