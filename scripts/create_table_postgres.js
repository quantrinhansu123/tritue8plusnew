import { Client } from "pg";
import * as fs from "fs";

// Supabase PostgreSQL connection details
const dbConfig = {
  user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD || "postgres", // Default for local, will be overridden
  host: "mldlabfnewfgygpadfka.supabase.co",
  port: 5432,
  database: "postgres",
  ssl: true,
  rejectUnauthorized: false,
};

// Try to get password from environment or use default
if (process.env.SUPABASE_DB_PASSWORD) {
  dbConfig.password = process.env.SUPABASE_DB_PASSWORD;
} else {
  console.log("⚠️  SUPABASE_DB_PASSWORD not set, attempting with default postgres password");
}

async function createTable() {
  const client = new Client(dbConfig);

  try {
    console.log("🔗 Connecting to Supabase PostgreSQL...");
    await client.connect();
    console.log("✅ Connected");

    console.log("📋 Reading SQL file...");
    const sql = fs.readFileSync("./scripts/create_thoi_khoa_bieu_table.sql", "utf-8");

    console.log("🔨 Executing SQL...");
    const result = await client.query(sql);
    console.log("✅ SQL executed successfully");

    // Verify table exists and has correct structure
    console.log("🔍 Verifying table...");
    const countResult = await client.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'thoi_khoa_bieu' AND table_schema = 'public';"
    );

    if (countResult.rows[0].count > 0) {
      console.log("✅ Table thoi_khoa_bieu exists");

      // Show table structure
      const structResult = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'thoi_khoa_bieu' ORDER BY ordinal_position;"
      );
      console.log("📊 Table structure:");
      structResult.rows.forEach((row) => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.error("❌ Table was not created");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.code);
    process.exit(1);
  } finally {
    await client.end();
    console.log("🔌 Disconnected");
  }
}

createTable();
