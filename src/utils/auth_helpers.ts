// src/utils/authHelpers.ts

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config()

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || "";
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || "";


interface ITokenPayload {
  user_Id: string;
  email?: string;
  username?: string;
  deviceId?: string;
}

export const tokenService = {

  generateAccessToken: (payload: ITokenPayload): string => {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: "15m" });

  },

  generateRefreshToken: (payload: ITokenPayload): string => {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

  },

  verifyAccessToken: (token: string): ITokenPayload | null => {
    try {
      return jwt.verify(token, ACCESS_TOKEN_SECRET) as ITokenPayload;

    } catch (e) {
      return null;
    }
  },

  verifyRefreshToken: (token: string): ITokenPayload | null => {
    try {
      const payload = jwt.verify(token, REFRESH_TOKEN_SECRET) as ITokenPayload;
      return payload;

    } catch (e) {
      return null;
    }
  }



}


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
   AUTH MIDDLEWARE
===================================================== */


export const getCurrentUser = (
  req: any,
  res: any,
  next: any
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

    const decoded = tokenService.verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({
        detail: "Invalid or expired token",
      });
    }

    req.user = {
      user_id: decoded.user_Id,
      username: decoded.username,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      detail: "Invalid or expired token",
    });
  }
};


