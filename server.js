// ============================================================
// NICHESCORE SERVER
//
// Standalone server for the NicheScore problem discovery
// pipeline. Runs the scheduled collectors and provides
// a health check endpoint.
// ============================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { setupDatabase } = require("./db");
const { startScheduler } = require("./pipeline");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);
app.use(express.static("public"));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "nichescore",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Start server
app.listen(PORT, async () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║       NicheScore Server Running       ║");
  console.log(`  ║       Port: ${PORT}                      ║`);
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log("");

  // Set up database tables
  await setupDatabase();

  // Start scheduled collection
  if (process.env.NICHESCORE_ENABLED === "true") {
    startScheduler();
    console.log("  NicheScore: ENABLED (collecting on schedule)");
  } else {
    console.log("  NicheScore: disabled (set NICHESCORE_ENABLED=true to enable)");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("  WARNING: ANTHROPIC_API_KEY is not set!");
  }
  if (!process.env.DATABASE_URL) {
    console.log("  WARNING: DATABASE_URL is not set!");
  }
  console.log("");
});
