// src/services/cloudinary.service.ts

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadPdf = async (
  fileBytes: Buffer,
  filename: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: `resumes/${filename}.pdf`,
        type: "upload",
        access_mode: "public",
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result?.secure_url || "");
      }
    );

    stream.end(fileBytes);
  });
};