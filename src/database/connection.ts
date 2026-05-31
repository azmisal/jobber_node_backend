import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined in .env");
}

if (!DB_NAME) {
  throw new Error("DB_NAME is not defined in .env");
}

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState >= 1) {
    console.log("Using cached MongoDB connection");
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      dbName: DB_NAME,
    });

    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
};