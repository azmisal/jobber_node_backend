// src/routes/auth.routes.ts

import express from "express";
import User, { UserSignup, UserLogin } from "../models/user";
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
} from "../utils/auth_helpers";

const router = express.Router();

/* =========================
   SIGNUP
========================= */

router.post("/signup", async (req, res) => {
  try {
    const user: UserSignup = req.body;

    const existingUser = await User.findOne({
      email: user.email,
    });

    if (existingUser) {
      return res.status(400).json({
        detail: "An account with this email already exists.",
      });
    }

    const newUser = await User.create({
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

    const dbUser = await User.findOne({
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

    const token = createAccessToken({
      user_id: dbUser._id.toString(),
      username: dbUser.username,
    });

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 86400 * 1000,
    });

    return res.json({
      message: "Login successful",
      user_id: dbUser._id,
      token_type: "bearer",
    });
  } catch (error) {
    return res.status(500).json({
      detail: "Internal server error",
    });
  }
});

export default router;