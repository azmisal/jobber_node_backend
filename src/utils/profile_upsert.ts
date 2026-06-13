import mongoose from "mongoose";
import Profile from "../models/profile";
import User from "../models/users";

export async function upsertProfile(params: {
  user_id: string;
  username: string;
  resumeUrl: string;
  profileData: Record<string, any>;
  userEmail?: string | null;
}) {
  const { user_id, username, resumeUrl, profileData } = params;

  let userEmail = params.userEmail ?? "";
  const now = new Date();

  // =====================================================
  // FETCH EMAIL IF NOT PROVIDED
  // =====================================================
  if (!userEmail) {
    const filterOr: any[] = [{ email: user_id }];

    if (mongoose.isValidObjectId(user_id)) {
      filterOr.push({ _id: user_id });
    } else {
      filterOr.push({ user_id });
    }

    const userDoc = await User.findOne({
      $or: filterOr,
    });

    userEmail = userDoc?.email || "";
  }

  // =====================================================
  // BUILD FILTER
  // =====================================================
  const filter = { user_id };

  // =====================================================
  // CHECK EXISTING
  // =====================================================
  const existing = await Profile.findOne(filter);

  const createdAt = existing?.createdAt ?? now;

  // =====================================================
  // UPSERT
  // =====================================================
  await Profile.updateOne(
    filter,
    {
      $set: {
        userEmail,
        username,
        resumeUrl,
        cloudinary_url: resumeUrl, // compatibility
        profileData,
        parsed_resume_data: profileData, // compatibility
        updatedAt: now,
      },
      $setOnInsert: {
        user_id,
        createdAt,
      },
    },
    { upsert: true }
  );

  // =====================================================
  // RETURN UPDATED DOC
  // =====================================================
  return await Profile.findOne(filter);
}