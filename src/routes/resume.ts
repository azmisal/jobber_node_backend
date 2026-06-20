import express from "express";
import multer from "multer";

import Profile from "../models/profile";

import {
  extractResumePdfContext,
  enrich_resume_data_with_pdf_context as enrichResumeDataWithPdfContext,
} from "../utils/pdf_parser";

import {
  canonicalize_resume_data as canonicalizeResumeData,
  cleanupResumeData,
} from "../utils/resume_quality";

import { getCurrentUser } from "../utils/auth_helpers";

import { uploadPdf } from "../services/cloudinary_service";
import { parseResumeToJson } from "../services/llm_service";

import { upsertProfile } from "../utils/profile_upsert";

const router = express.Router();

const upload = multer();

/* =========================
   UPLOAD RESUME
========================= */

router.post("/upload", getCurrentUser, upload.single("file"),
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

      const pdfContext = await extractResumePdfContext(fileBytes);

      let parsedJson = await parseResumeToJson(
        pdfContext.plain_text,
        model,
        pdfContext.contact_details?.links || []
      );
      // Merge PDF + LLM output using the robust helper functions
      parsedJson = enrichResumeDataWithPdfContext(parsedJson, pdfContext);
      parsedJson = cleanupResumeData(parsedJson);

      const upserted = await upsertProfile({
        user_id: req.user.user_id,
        username: req.user.username,
        resumeUrl: cloudinaryUrl,
        profileData: parsedJson,
      });

      return res.json({
        message: "Resume uploaded and learned.",
        profile: upserted ? (upserted.profileData || parsedJson) : parsedJson,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      return res.status(500).json({
        detail: error.message || "Internal server error",
      });
    }
  }
);

/* =========================
   GET PROFILE
========================= */

router.get("/profile", getCurrentUser,
  async (req: any, res) => {
    try {
      const profile: any = await Profile.findOne({
        user_id: req.user.user_id,
      });

      if (!profile) {
        return res.json({
          has_profile: false,
        });
      }

      return res.json({
        has_profile: true,
        data: profile.profileData || profile.parsed_resume_data,
        resumeUrl: profile.resumeUrl || profile.cloudinary_url,
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

router.put("/rectify", getCurrentUser,
  async (req: any, res) => {
    try {
      const updatedData = req.body;

      const cleanedData = canonicalizeResumeData(updatedData);

      const existing: any = await Profile.findOne({
        user_id: req.user.user_id,
      });

      const resumeUrl =
        existing?.resumeUrl ||
        existing?.cloudinary_url ||
        "";

      await upsertProfile({
        user_id: req.user.user_id,
        username: req.user.username,
        resumeUrl: resumeUrl,
        profileData: cleanedData,
      });

      return res.json({
        message: "Profile updated and verified successfully",
      });
    } catch (error) {
      return res.status(500).json({
        detail: "Internal server error",
      });
    }
  }
);

export default router;