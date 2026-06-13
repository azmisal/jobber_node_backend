// src/routes/auth.routes.ts

import express from "express";
import Users, { UserSignup, UserLogin } from "../models/users";
import { tokenService, verifyPassword, hashPassword } from "../utils/auth_helpers";
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

    const accessToken = tokenService.generateAccessToken({
      user_Id: dbUser._id.toString(),
      username: dbUser.username,
    });

    const refreshToken = tokenService.generateRefreshToken({
      user_Id: dbUser._id.toString(),
      username: dbUser.username,
    });


    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 86400 * 1000 * 365,
    });

    return res.json({
      message: "Login successful",
      user: dbUser._id,
      accessToken: accessToken,
    });
  } catch (error) {
    return res.status(500).json({
      detail: "Internal server error",
    });
  }
});


router.post("/logout", async (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    return res.json({
      message: "Logout successful",
    });
  } catch (error) {
    return res.status(500).json({
      detail: "Internal server error",
    });
  }
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({
      detail: "Refresh token missing",
    });
  }
  try {
    const payload = tokenService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new Error("Invalid refresh token");
    }
    const user = await Users.findById({ _id: payload.user_Id });
    if (!user) {
      throw new Error("User not found");
    }
    let tokenItem;


    const newPayload = {
      user_Id: user.user_Id,
    }
    const newRefreshToken = tokenService.generateRefreshToken(newPayload);

    const newAccessToken = tokenService.generateAccessToken({
      user_Id: payload.user_Id,
      email: payload.email,
      username: payload.username
    });
    const response = {
      authenticated: {
        user: user,
        accessToken: newAccessToken
      }
    };
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 86400 * 1000 * 365,
    });

    return response;

  }
  catch (error) {
    throw error;
  }

});


export default router;