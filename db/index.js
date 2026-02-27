// ============================================================
// DATABASE CONNECTION POOL
//
// A "pool" keeps several database connections open and ready.
// When your code needs to run a query, it borrows a connection
// from the pool, uses it, then returns it. This is much faster
// than opening a new connection for every single request.
//
// We export the pool so any file can do:
//   const db = require("./db");
//   const result = await db.query("SELECT ...");
// ============================================================

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

pool.on("connect", () => {
  console.log("  [DB] Connected to PostgreSQL");
});

pool.on("error", (err) => {
  console.error("  [DB] Unexpected error:", err.message);
});

// Auto-setup: run setup.sql to create tables if they don't exist.
async function setupDatabase() {
  try {
    const sqlPath = path.join(__dirname, "setup.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    await pool.query(sql);
    console.log("  [DB] Tables ready");
  } catch (err) {
    console.error("  [DB] Setup error:", err.message);
  }
}

module.exports = pool;
module.exports.setupDatabase = setupDatabase;
