import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mldlabfnewfgygpadfka.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGxhYmZuZXdmZ3lncGFkZmthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA2NzQ3NywiZXhwIjoyMDg2NjQzNDc3fQ.x9xGSJ5Y4xBOfdJpcG_EQ_If4Bi21SX5WNNCPWJyGS0";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function checkAndManuallyCreateTable() {
  console.log("🔍 Checking if thoi_khoa_bieu table exists...\n");

  try {
    // Try to query the table to see if it exists
    const { error } = await supabase.from("thoi_khoa_bieu").select("*").limit(1);

    if (!error) {
      console.log("✅ Table thoi_khoa_bieu already exists!");
      return;
    }

    if (error.message.includes("does not exist")) {
      console.log("❌ Table thoi_khoa_bieu does not exist yet.\n");
      console.log("📋 To create the table, follow these steps:\n");
      console.log("1. Go to Supabase Dashboard: https://app.supabase.com/");
      console.log("2. Select your project (mldlabfnewfgygpadfka)");
      console.log("3. Click on 'SQL Editor' in the left sidebar");
      console.log("4. Click 'New Query'");
      console.log("5. Copy and paste the SQL from: scripts/create_thoi_khoa_bieu_table.sql");
      console.log("6. Click 'Run' button\n");

      console.log("📔 SQL to execute:");
      console.log("─".repeat(80));
      const fs = await import("fs");
      const sql = fs.readFileSync("./scripts/create_thoi_khoa_bieu_table.sql", "utf-8");
      console.log(sql);
      console.log("─".repeat(80));
      console.log("\n✨ After executing the SQL, run:");
      console.log("   node scripts/migrate_attendance_schedule_to_supabase.js\n");
      console.log("to migrate the timetable data.\n");
      return;
    }

    // Other error
    console.error("⚠️  Error checking table:", error.message);
  } catch (err) {
    console.error("❌ Script error:", err.message);
    process.exit(1);
  }
}

checkAndManuallyCreateTable();
