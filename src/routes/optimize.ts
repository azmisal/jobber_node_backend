import express from "express";
import mongoose from "mongoose";

import Profile from "../models/profile";
import History from "../models/history";

import {
  extractKeywords,
  generateOptimizationProposals,
  createCoverLetter,
} from "../services/llm_service";

import {
  canonicalize_resume_data as canonicalizeResumeData,
  cleanupResumeData,
} from "../utils/resume_quality";

import { generatePdfBytes } from "../utils/pdf_parser";
import { uploadPdf } from "../services/cloudinary_service";
import { extractCompanyNameFromJd } from "../utils/company_extraction";

import { getCurrentUser } from "../utils/auth_helpers";

const router = express.Router();

/* =========================
   KEYWORDS
========================= */

router.post("/keywords", getCurrentUser, async (req: any, res) => {
  try {
    const payload = req.body;

    const profile: any = await Profile.findOne({
      user_id: req.user.user_id,
    });

    if (!profile) {
      return res.status(404).json({
        detail: "Please upload a resume first.",
      });
    }

    let resumeData = profile.profileData || profile.parsed_resume_data || {};

    resumeData = canonicalizeResumeData(resumeData);

    const existingSkills: string[] = [];

    const sections = resumeData.sections || [];

    for (const section of sections) {
      const title = String(section.title || "").toLowerCase();

      if (title.includes("skill")) {
        const content = section.content || [];

        if (Array.isArray(content)) {
          existingSkills.push(
            ...content.map((x: any) => String(x))
          );
        }
      }
    }

    const keywords = await extractKeywords(
      payload.job_description,
      existingSkills,
      payload.model
    );

    await Profile.updateOne(
      {
        user_id: req.user.user_id,
      },
      {
        $set: {
          current_jd: payload.job_description,
        },
      }
    );

    return res.json({ keywords });
  } catch (error) {
    return res.status(500).json({
      detail: "Internal server error",
    });
  }
});

/* =========================
   PROPOSALS
========================= */

router.post("/proposals", getCurrentUser, async (req: any, res) => {
  try {
    const payload = req.body;

    const profile: any = await Profile.findOne({
      user_id: req.user.user_id,
    });

    if (!profile) {
      return res.status(404).json({
        detail: "Resume profile not found.",
      });
    }

    let resumeData = profile.profileData || profile.parsed_resume_data || {};

    resumeData = canonicalizeResumeData(resumeData);

    const proposals =
      await generateOptimizationProposals(
        resumeData,
        payload.selected_keywords,
        payload.model
      );

    return res.json({ proposals });
  } catch (error) {
    return res.status(500).json({
      detail: "Internal server error",
    });
  }
});

/* =========================
   HISTORY LIST
========================= */

router.get("/history", getCurrentUser, async (req: any, res) => {
  try {
    const items = await History.find({
      user_id: req.user.user_id,
    })
      .sort({ generatedAt: -1 })
      .limit(50);

    const result = items.map((doc: any) => ({
      historyId: doc._id,
      companyName: doc.companyName || "",
      resumeName: doc.resumeName || "",
      generatedAt: doc.generatedAt,
      keywordCount: (doc.selectedKeywords || []).length,
      generatedResumeUrl:
        doc.generatedResumeUrl || "",
    }));

    return res.json({ items: result });
  } catch (error) {
    return res.status(500).json({
      detail: "Internal server error",
    });
  }
});

/* =========================
   HISTORY DETAIL
========================= */

router.get(
  "/history/:history_id",
  getCurrentUser,
  async (req: any, res: any) => {
    try {
      const { history_id } = req.params;

      if (!mongoose.isValidObjectId(history_id)) {
        return res.status(400).json({
          detail: "Invalid history id",
        });
      }

      const doc = await History.findOne({
        _id: history_id,
        user_id: req.user.user_id,
      });

      if (!doc) {
        return res.status(404).json({
          detail: "History not found",
        });
      }

      let linkedProfile = null;

      const sourceProfileId =
        doc.sourceResumeProfileId || "";

      if (sourceProfileId) {
        const linkedProfileDoc: any =
          await Profile.findOne({
            user_id: req.user.user_id,
          });

        if (linkedProfileDoc) {
          linkedProfile = {
            resumeUrl:
              linkedProfileDoc.resumeUrl ||
              linkedProfileDoc.cloudinary_url,

            profileData:
              linkedProfileDoc.profileData ||
              linkedProfileDoc.parsed_resume_data,

            username:
              linkedProfileDoc.username,
          };
        }
      }

      return res.json({
        history: doc,
        linkedProfile,
      });
    } catch (error) {
      return res.status(500).json({
        detail: "Internal server error",
      });
    }
  }
);

/* =========================
   APPLY OPTIMIZATION
========================= */

router.post("/apply", getCurrentUser, async (req: any, res: any) => {
  try {
    const payload = req.body;

    const profile: any = await Profile.findOne({
      user_id: req.user.user_id,
    });
    if (!profile) {
      return res.status(404).json({
        detail: "Resume profile not found.",
      });
    }

    let optimizedResume = {
      ...(profile.profileData || profile.parsed_resume_data || {}),
    };

    optimizedResume =
      canonicalizeResumeData(optimizedResume);

    const approvedMap = new Map();

    for (const p of payload.proposals) {
      if (payload.approved_ids.includes(p.id)) {
        approvedMap.set(p.id, p);
      }
    }

    const sections =
      optimizedResume.sections || [];


    for (const [, prop] of approvedMap) {
      const matchingSection = sections.find(
        (s: any) => s.id === prop.section_id
      );

      if (!matchingSection) {
        console.log(
          "Section not found:",
          prop.section_id
        );
        continue;
      }

      const content =
        matchingSection.content || [];

      if (!Array.isArray(content)) {
        console.log(
          "Section content is not array"
        );
        continue;
      }

      const item = content[prop.content_index];

      if (item === undefined) {
        console.log(
          "Item not found at index:",
          prop.content_index
        );
        continue;
      }

      // STRING ITEMS
      if (typeof item === "string") {
        console.log("Replacing string item");

        content[prop.content_index] =
          prop.proposed_text;

        continue;
      }

      // OBJECT ITEMS
      if (
        typeof item === "object" &&
        item !== null
      ) {
        if (!(prop.field in item)) {
          console.log(
            "Field does not exist:",
            prop.field
          );

          continue;
        }

        const fieldValue =
          item[prop.field];

        // ARRAY FIELD
        if (Array.isArray(fieldValue)) {
          if (
            typeof prop.field_index !==
            "number" ||
            prop.field_index < 0 ||
            prop.field_index >=
            fieldValue.length
          ) {
            console.log(
              "Invalid field_index:",
              prop.field_index
            );

            continue;
          }

          console.log(
            "Updating array field"
          );

          fieldValue[prop.field_index] =
            prop.proposed_text;

          continue;
        }

        // STRING FIELD
        if (
          typeof fieldValue === "string"
        ) {
          console.log(
            "Updating string field"
          );

          item[prop.field] =
            prop.proposed_text;

          continue;
        }

        console.log(
          "Unsupported field type"
        );
      }
    }
    optimizedResume =
      cleanupResumeData(optimizedResume);

    const finalResumeData = JSON.parse(JSON.stringify(optimizedResume));
    const pdfOutputBytes = await generatePdfBytes(finalResumeData);
    const uniqueFilename =
      `${payload.output_file_name}_${req.user.user_id}`;

    const cloudinaryDownloadUrl =
      await uploadPdf(
        pdfOutputBytes,
        uniqueFilename
      );

    const coverLetter =
      await createCoverLetter(
        optimizedResume,
        profile.current_jd || "",
        payload.model
      );

    const currentJd =
      profile.current_jd || "";

    const [extractedCompany, confidence] =
      extractCompanyNameFromJd(currentJd);

    let companyName =
      payload.company_name ||
      extractedCompany ||
      "";

    const historyDoc = await History.create({
      user_id: req.user.user_id,

      userEmail:
        profile.userEmail || "",

      companyName,

      resumeName:
        payload.output_file_name,

      generatedResumeUrl:
        cloudinaryDownloadUrl,

      originalJobDescription:
        payload.original_job_description ||
        currentJd,

      selectedKeywords:
        payload.selected_keywords || [],

      optimizationProposals:
        payload.proposals || [],

      generatedAt: new Date(),

      sourceResumeProfileId:
        profile._id?.toString() || "",
    });

    return res.json({
      message:
        "Tailored resume generated successfully.",

      file_name: uniqueFilename,

      download_url:
        cloudinaryDownloadUrl,

      cover_letter: coverLetter,

      historyId: historyDoc._id,
    });
  } catch (error) {
    console.error("Apply error:", error);
    return res.status(500).json({
      detail: "Internal server error",
    });
  }
});

export default router;