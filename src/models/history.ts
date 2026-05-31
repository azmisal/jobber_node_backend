// src/models/history.model.ts

import mongoose, { Schema, Document } from "mongoose";

export interface IResumeHistoryProposal {
  id: number;

  section_id?: string;
  item_index?: number;
  field?: string;
  field_index?: number;

  original_text: string;
  proposed_text: string;
  keyword_added: string;

  [key: string]: any;
}

export interface IHistory extends Document {
  companyName: string;

  resumeName: string;
  generatedResumeUrl: string;

  originalJobDescription: string;
  selectedKeywords: string[];

  optimizationProposals: IResumeHistoryProposal[];

  sourceResumeProfileId: string;

  generatedAt: Date;
}

const ResumeHistoryProposalSchema = new Schema<IResumeHistoryProposal>(
  {
    id: {
      type: Number,
      required: true,
    },

    section_id: {
      type: String,
    },

    item_index: {
      type: Number,
    },

    field: {
      type: String,
    },

    field_index: {
      type: Number,
    },

    original_text: {
      type: String,
      default: "",
    },

    proposed_text: {
      type: String,
      default: "",
    },

    keyword_added: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
    strict: false, // equivalent to extra="allow"
  }
);

const HistorySchema = new Schema<IHistory>(
  {
    companyName: {
      type: String,
      default: "",
    },

    resumeName: {
      type: String,
      required: true,
    },

    generatedResumeUrl: {
      type: String,
      required: true,
    },

    originalJobDescription: {
      type: String,
      required: true,
    },

    selectedKeywords: {
      type: [String],
      default: [],
    },

    optimizationProposals: {
      type: [ResumeHistoryProposalSchema],
      default: [],
    },

    sourceResumeProfileId: {
      type: String,
      required: true,
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    strict: false, // equivalent to extra="allow"
  }
);

export default mongoose.model<IHistory>(
  "History",
  HistorySchema
);