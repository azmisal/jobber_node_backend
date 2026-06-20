import express from "express";
import mongoose from "mongoose";

import Profile from "../models/profile";
import History from "../models/history";

import {
  extractKeywords,
  generateOptimizationProposals,
  createCoverLetter,
  parseResumeToJson,
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

    // Build base resume
    let optimizedResume: any = {
      ...(profile.profileData || profile.parsed_resume_data || {}),
    };

    optimizedResume = canonicalizeResumeData(optimizedResume);
    // console.log("optimizedResume  : ", optimizedResume);
    /* =========================
       APPLY APPROVED PROPOSALS
    ========================== */

    const approvedMap = new Map();

    for (const p of payload.proposals || []) {
      if (payload.approved_ids?.includes(p.id)) {
        approvedMap.set(p.id, p);
      }
    }

    const sections = optimizedResume.sections || [];

    const normalizeLookup = (value: any) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

    const findMatchingSection = (sectionRef: string) => {
      const target = normalizeLookup(sectionRef);
      if (!target) return null;

      return sections.find((s: any) => {
        const candidates = [s.id, s.title, s.type].map(normalizeLookup);
        return candidates.includes(target);
      });
    };

    const tryUpdateObjectField = (
      item: any,
      proposal: any
    ) => {
      const targetField = proposal.field;
      const fieldIndex = proposal.field_index;

      if (targetField && targetField in item) {
        const fieldValue = item[targetField];

        if (Array.isArray(fieldValue)) {
          if (
            typeof fieldIndex === "number" &&
            fieldIndex >= 0 &&
            fieldIndex < fieldValue.length
          ) {
            fieldValue[fieldIndex] = proposal.proposed_text;
            return true;
          }
          return false;
        }

        if (typeof fieldValue === "string") {
          item[targetField] = proposal.proposed_text;
          return true;
        }
      }

      const candidateKeys = [
        "text",
        "description",
        "summary",
        "headline",
        "role",
        "position",
        "title",
        "name",
        "company",
        "institution",
        "degree",
        "content",
        "value",
      ];

      for (const key of candidateKeys) {
        if (typeof item[key] === "string") {
          if (
            item[key] === proposal.original_text ||
            proposal.original_text.includes(item[key]) ||
            item[key].includes(proposal.original_text)
          ) {
            item[key] = proposal.proposed_text;
            return true;
          }
        }
      }

      return false;
    };

    console.log("[optimize/apply] payload keys:", Object.keys(payload));
    console.log(
      "[optimize/apply] approved proposals:",
      Array.from(approvedMap.keys())
    );

    for (const [, prop] of approvedMap) {
      const matchingSection = findMatchingSection(prop.section_id);
      console.log(
        "[optimize/apply] matching section for",
        prop.section_id,
        ":",
        matchingSection?.id || null,
        matchingSection?.title || null
      );

      if (!matchingSection) continue;

      const content = matchingSection.content;

      if (!Array.isArray(content)) continue;

      const item = content[prop.content_index];

      if (item === undefined) continue;

      if (typeof item === "string") {
        content[prop.content_index] = prop.proposed_text;
        continue;
      }

      if (typeof item === "object" && item !== null) {
        const applied = tryUpdateObjectField(item, prop);
        if (applied) {
          continue;
        }

        console.log(
          "[optimize/apply] could not match object field for proposal",
          prop.id,
          item
        );
      }
    }

    console.log("[optimize/apply] optimizedResume after applying proposals:");
    console.log(JSON.stringify(optimizedResume, null, 2));
    optimizedResume = cleanupResumeData(optimizedResume);

    /* =========================
       DEBUG: CHECK LINKS EXIST
       (IMPORTANT for your issue)
    ========================== */

    const linkCheck: any[] = [];

    (optimizedResume.sections || []).forEach((sec: any) => {
      (sec.content || []).forEach((c: any) => {
        if (typeof c === "object" && c !== null) {
          if (c.links || c.embedded_links) {
            linkCheck.push({
              section: sec.id,
              links: c.links || [],
              embedded_links: c.embedded_links || [],
            });
          }
        }
      });
    });


    /* =========================
       PDF GENERATION
    ========================== */

    const finalResumeData = JSON.parse(JSON.stringify(optimizedResume));
    const pdfOutputBytes = await generatePdfBytes(finalResumeData);

    const uniqueFilename = `${payload.output_file_name}_${req.user.user_id}`;

    const cloudinaryDownloadUrl = await uploadPdf(
      pdfOutputBytes,
      uniqueFilename
    );

    /* =========================
       COVER LETTER
    ========================== */

    const coverLetter = await createCoverLetter(
      optimizedResume,
      profile.current_jd || "",
      payload.model
    );

    /* =========================
       COMPANY NAME EXTRACTION
    ========================== */

    const currentJd = profile.current_jd || "";
    const [extractedCompany] =
      extractCompanyNameFromJd(currentJd);

    let companyName =
      payload.company_name || extractedCompany || "";

    /* =========================
       SAVE HISTORY
    ========================== */

    const historyDoc = await History.create({
      user_id: req.user.user_id,
      userEmail: profile.userEmail || "",
      companyName,
      resumeName: payload.output_file_name,
      generatedResumeUrl: cloudinaryDownloadUrl,
      originalJobDescription:
        payload.original_job_description || currentJd,
      selectedKeywords: payload.selected_keywords || [],
      optimizationProposals: payload.proposals || [],
      generatedAt: new Date(),
      sourceResumeProfileId: profile._id?.toString() || "",
    });

    /* =========================
       RESPONSE
    ========================== */

    return res.json({
      message: "Tailored resume generated successfully.",
      file_name: uniqueFilename,
      download_url: cloudinaryDownloadUrl,
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