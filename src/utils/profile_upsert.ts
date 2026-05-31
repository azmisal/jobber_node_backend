import { Collection, ObjectId } from "mongodb";

export async function upsertProfile(
  profilesCol: Collection,
  usersCol: Collection,
  params: {
    user_id: string;
    username: string;
    resumeUrl: string;
    profileData: Record<string, any>;
    userEmail?: string | null;
  }
): Promise<any> {
  const { user_id, username, resumeUrl, profileData } = params;

  let userEmail = params.userEmail ?? "";
  const now = new Date();

  // =====================================================
  // FETCH EMAIL IF NOT PROVIDED
  // =====================================================
  if (!userEmail) {
    const userDoc =
      (await usersCol.findOne({ _id: user_id })) ||
      (await usersCol.findOne({ user_id }));

    if (userDoc?.email) {
      userEmail = userDoc.email;
    }
  }

  if (!userEmail) {
    userEmail = "";
  }

  const filter = { user_id };

  // =====================================================
  // CHECK EXISTING
  // =====================================================
  const existing = await profilesCol.findOne(filter);

  const createdAt = existing?.createdAt ?? now;

  // =====================================================
  // UPSERT OPERATION
  // =====================================================
  await profilesCol.updateOne(filter, {
    $set: {
      userEmail,
      username,
      resumeUrl,
      profileData,
      updatedAt: now,
    },
    $setOnInsert: {
      createdAt,
    },
  }, {
    upsert: true,
  });

  // =====================================================
  // RETURN UPDATED DOC
  // =====================================================
  return await profilesCol.findOne(filter);
}