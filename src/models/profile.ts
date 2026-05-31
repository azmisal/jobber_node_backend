import mongoose, { Schema, Document } from "mongoose";

export interface IProfile extends Document {
  user_id: string;
  username: string;
  userEmail: string;
  resumeUrl: string;
  cloudinary_url: string;
  parsed_resume_data: Record<string, any>;
  profileData: Record<string, any>;
  current_jd: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProfileSchema = new Schema<IProfile>(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      default: "",
      trim: true,
    },
    resumeUrl: {
      type: String,
      default: "",
    },
    cloudinary_url: {
      type: String,
      default: "",
    },
    parsed_resume_data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    profileData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    current_jd: {
      type: String,
      default: "",
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Profile || mongoose.model<IProfile>("Profile", ProfileSchema);