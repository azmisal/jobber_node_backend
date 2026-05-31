import express from "express";
import cors from "cors";

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
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// =========================================================
// LIFESPAN (FASTAPI EQUIVALENT)
// =========================================================

function startServer() {
  console.log("🚀 NEXUS CV BACKEND ENGINE IS ONLINE!");
  console.log("📡 Listening at: http://127.0.0.1:8000");
  const PORT = 8000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
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