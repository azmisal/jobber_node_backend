import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./database/connection";

// Import your routers (you will create these in Express version)
import authRouter from "./routes/auth";
import resumeRouter from "./routes/resume";
import optimizeRouter from "./routes/optimize";

// =========================================================
// APP INITIALIZATION
// =========================================================

const app = express();

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      "https://jobber.azmisal.in",

    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(cookieParser());

// =========================================================
// LIFESPAN (FASTAPI EQUIVALENT)
// =========================================================

async function startServer() {
  console.log("🚀 JOBBER BACKEND ENGINE IS ONLINE!");
  // console.log("📡 Listening at: http://127.0.0.1:8000");
  const PORT = 8000;

  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server due to database connection error:", err);
    process.exit(1);
  }
}

// =========================================================
// ROUTES
// =========================================================

app.use("/auth", authRouter);
app.use("/resume", resumeRouter);
app.use("/optimize", optimizeRouter);

// =========================================================
// HEALTH CHECK
// =========================================================

app.get("/", (req, res) => {
  res.json({
    status: "Online",
    msg: "API Layer Live",
  });
});

// =========================================================
// BOOT SERVER
// =========================================================

startServer();