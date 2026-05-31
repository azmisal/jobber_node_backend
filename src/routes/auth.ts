// src/routes/auth.routes.ts

import express from "express";
import Users, { UserSignup, UserLogin } from "../models/users";
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
} from "../utils/auth_helpers";
import mongoose from "mongoose";

const router = express.Router();

/* =========================
   SIGNUP
========================= */

router.post("/signup", async (req, res) => {
  try {
    const user: UserSignup = req.body;

    const existingUser = await Users.findOne({
      email: user.email,
    });

    if (existingUser) {
      return res.status(400).json({
        detail: "An account with this email already exists.",
      });
    }

    const newUser = await Users.create({
      username: user.username,
      email: user.email,
      password_hash: await hashPassword(user.password),
    });

    return res.json({
      message: "User registered successfully",
      user_id: newUser._id,
    });
  } catch (error) {
    return res.status(500).json({
      detail: "Internal server error",
    });
  }
});

/* =========================
   LOGIN
========================= */

router.post("/login", async (req, res) => {
  try {
    const user: UserLogin = req.body;
    const dbUser = await Users.findOne({
      email: user.email,
    });
    if (
      !dbUser ||
      !(await verifyPassword(user.password, dbUser.password_hash))
    ) {
      return res.status(401).json({
        detail: "Invalid email or password.",
      });
    }

    const accessToken = createAccessToken({
      user_id: dbUser._id.toString(),
      username: dbUser.username,
    });
     const refreshToken = createRefreshToken({
      user_id: dbUser._id.toString(),
      username: dbUser.username,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 86400 * 1000,
    });

    return res.json({
      message: "Login successful",
      user_id: dbUser._id,
      token: accessToken,
    });
  } catch (error) {
    return res.status(500).json({
      detail: "Internal server error",
    });
  }
});



export default router;