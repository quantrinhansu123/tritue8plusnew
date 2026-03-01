import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const SUPABASE_URL = "https://mldlabfnewfgygpadfka.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_KEY environment variable is not set");
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

async function createTable() {
  try {
    console.log("📋 Reading SQL file...");
    const sqlFile = "./scripts/create_thoi_khoa_bieu_table.sql";
    let sql = fs.readFileSync(sqlFile, "utf-8");

    // Remove comments and extra whitespace
    sql = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    console.log("🔨 Creating thoi_khoa_bieu table...");
    const { error } = await client.rpc("exec_sql", { sql });

    if (error && error.code !== "42P07") {
      // 42P07 = table already exists
      console.error("❌ Error creating table:", error.message);
      process.exit(1);
    }

    console.log("✅ Table created successfully or already exists");

    // Verify table exists
    console.log("🔍 Verifying table structure...");
    const { data: tables, error: listError } = await client.from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_name", "thoi_khoa_bieu");

    if (listError) {
      console.log("⚠️  Could not verify table with information_schema query");
      // Try direct query instead
      const { data, error: queryError } = await client.from("thoi_khoa_bieu").select("*").limit(1);
      if (queryError && queryError.message.includes("does not exist")) {
        console.error("❌ Table still does not exist");
        process.exit(1);
      }
      console.log("✅ Table exists (verified via direct query)");
    } else if (tables && tables.length > 0) {
      console.log("✅ Table exists", tables);
    }
  } catch (err) {
    console.error("❌ Script error:", err.message);
    process.exit(1);
  }
}

createTable();
