import express from "express";
import multer from "multer";

import Profile from "../models/profile.model";

import {
  enrichResumeDataWithPdfContext,
  extractResumePdfContext,
} from "../utils/pdfParser";

import {
  canonicalizeResumeData,
  cleanupResumeData,
} from "../utils/resumeQuality";

import { getCurrentUser } from "../utils/authHelpers";

import { uploadPdf } from "../services/cloudinary.service";
import { parseResumeToJson } from "../services/llm.service";

import { upsertProfile } from "../utils/profileUpsert";

const router = express.Router();

const upload = multer();

/* =========================
   UPLOAD RESUME
========================= */

router.post(
  "/upload",
  getCurrentUser,
  upload.single("file"),
  async (req: any, res) => {
    try {
      const file = req.file;

      const model = req.body.model || "groq";

      if (!file) {
        return res.status(400).json({
          detail: "No file uploaded",
        });
      }

      const fileBytes = file.buffer;

      const cloudinaryUrl = await uploadPdf(
        fileBytes,
        `master_${req.user.user_id}`
      );

      const pdfContext =
        extractResumePdfContext(fileBytes);

      let parsedJson = await parseResumeToJson(
        pdfContext.plain_text,
        model,
        pdfContext.embedded_links || []
      );

      parsedJson =
        enrichResumeDataWithPdfContext(
          parsedJson,
          pdfContext
        );

      parsedJson =
        cleanupResumeData(parsedJson);

      const upserted = await upsertProfile(
        req.user.user_id,
        req.user.username,
        cloudinaryUrl,
        parsedJson
      );

      return res.json({
        message: "Resume uploaded and learned.",
        profile:
          upserted.profileData || parsedJson,
      });
    } catch (error) {
      return res.status(500).json({
        detail: "Internal server error",
      });
    }
  }
);

/* =========================
   GET PROFILE
========================= */

router.get(
  "/profile",
  getCurrentUser,
  async (req: any, res) => {
    try {
      const profile = await Profile.findOne({
        user_id: req.user.user_id,
      });

      if (!profile) {
        return res.json({
          has_profile: false,
        });
      }

      return res.json({
        has_profile: true,

        data:
          profile.profileData ||
          profile.parsed_resume_data,

        resumeUrl:
          profile.resumeUrl ||
          profile.cloudinary_url,
      });
    } catch (error) {
      return res.status(500).json({
        detail: "Internal server error",
      });
    }
  }
);

/* =========================
   RECTIFY PROFILE
========================= */

router.put(
  "/rectify",
  getCurrentUser,
  async (req: any, res) => {
    try {
      const updatedData = req.body;

      const cleanedData =
        canonicalizeResumeData(updatedData);

      const existing =
        (await Profile.findOne({
          user_id: req.user.user_id,
        })) || {};

      const resumeUrl =
        existing.resumeUrl ||
        existing.cloudinary_url ||
        "";

      await upsertProfile(
        req.user.user_id,
        req.user.username,
        resumeUrl,
        cleanedData
      );

      return res.json({
        message:
          "Profile updated and verified successfully",
      });
    } catch (error) {
      return res.status(500).json({
        detail: "Internal server error",
      });
    }
  }
);

export default router;