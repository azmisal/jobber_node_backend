// src/models/resume.model.ts

import mongoose, { Schema, Document } from "mongoose";

export interface IResumeLink {
  label: string;
  url: string;

  [key: string]: any;
}

export interface IResumeBasics {
  full_name: string;
  headline: string;
  emails: string[];
  phones: string[];
  location: string;
  links: (IResumeLink | Record<string, any>)[];

  [key: string]: any;
}

export interface IResumeSection {
  id: string;
  title: string;
  type: string;
  content: any[];
  raw_text: string;

  [key: string]: any;
}

export interface IResumeMetadata {
  section_order: string[];
  parsing_confidence: number;
  embedded_links: IResumeLink[];
  plain_resume_text: string;

  [key: string]: any;
}

export interface IResumeData {
  basics: IResumeBasics;
  sections: IResumeSection[];
  metadata: IResumeMetadata;
  raw_resume_text: string;

  [key: string]: any;
}

export interface IJDSubmission {
  job_description: string;
  model: string;
}

export interface IKeywordSelection {
  selected_keywords: string[];
  rejected_keywords: string[];
  model: string;
}

export interface IOptimizationProposal {
  id: number;
  section_id: string;
  item_index: number;
  field: string;
  field_index?: number;
  original_text: string;
  proposed_text: string;
  keyword_added: string;
}

export interface IOptimizationApprovalPayload {
  approved_ids: number[];
  proposals: IOptimizationProposal[];
  output_file_name: string;
  model?: string;
}

export interface IOptimizationApplyHistoryPayload
  extends IOptimizationApprovalPayload {
  company_name?: string;
  original_job_description?: string;
  selected_keywords: string[];

  [key: string]: any;
}

export interface IResume extends Document {
  userId: string;
  resumeData: IResumeData;
}

/* =========================
   SUB SCHEMAS
========================= */

const ResumeLinkSchema = new Schema<IResumeLink>(
  {
    label: {
      type: String,
      default: "",
    },

    url: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
    strict: false,
  }
);

const ResumeBasicsSchema = new Schema<IResumeBasics>(
  {
    full_name: {
      type: String,
      default: "",
    },

    headline: {
      type: String,
      default: "",
    },

    emails: {
      type: [String],
      default: [],
    },

    phones: {
      type: [String],
      default: [],
    },

    location: {
      type: String,
      default: "",
    },

    links: {
      type: [Schema.Types.Mixed],
      default: [],
    },
  },
  {
    _id: false,
    strict: false,
  }
);

const ResumeSectionSchema = new Schema<IResumeSection>(
  {
    id: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      required: true,
    },

    content: {
      type: [Schema.Types.Mixed],
      default: [],
    },

    raw_text: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
    strict: false,
  }
);

const ResumeMetadataSchema = new Schema<IResumeMetadata>(
  {
    section_order: {
      type: [String],
      default: [],
    },

    parsing_confidence: {
      type: Number,
      default: 0,
    },

    embedded_links: {
      type: [ResumeLinkSchema],
      default: [],
    },

    plain_resume_text: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
    strict: false,
  }
);

const ResumeDataSchema = new Schema<IResumeData>(
  {
    basics: {
      type: ResumeBasicsSchema,
      required: true,
    },

    sections: {
      type: [ResumeSectionSchema],
      default: [],
    },

    metadata: {
      type: ResumeMetadataSchema,
      required: true,
    },

    raw_resume_text: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
    strict: false,
  }
);

/* =========================
   MAIN RESUME MODEL
========================= */

const ResumeSchema = new Schema<IResume>(
  {
    userId: {
      type: String,
      required: true,
    },

    resumeData: {
      type: ResumeDataSchema,
      required: true,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export default mongoose.model<IResume>(
  "Resume",
  ResumeSchema
);