import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase configuration
const SUPABASE_URL = "https://mldlabfnewfgygpadfka.supabase.co";
const SUPABASE_PROJECT_REF = "mldlabfnewfgygpadfka";

// Get SQL file path from command line argument
const sqlFileArg = process.argv[2];
let sqlFilePath;

if (sqlFileArg) {
  // If argument is provided, use it (can be relative or absolute)
  sqlFilePath = sqlFileArg.startsWith('/') || sqlFileArg.match(/^[A-Za-z]:/) 
    ? sqlFileArg 
    : join(__dirname, sqlFileArg);
} else {
  // Default: use the currently open file
  sqlFilePath = join(__dirname, "add_hoc_phi_rieng_to_lop_hoc_hoc_sinh.sql");
  console.log(`📝 No file specified, using default: ${sqlFilePath}\n`);
}

try {
  // Read SQL file
  console.log(`📖 Reading SQL file: ${sqlFilePath}`);
  const sqlContent = readFileSync(sqlFilePath, "utf-8");
  
  if (!sqlContent.trim()) {
    console.error("❌ SQL file is empty!");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 SQL Content:");
  console.log("=".repeat(60));
  console.log(sqlContent);
  console.log("=".repeat(60));

  // Try different methods to execute SQL
  console.log("\n🔍 Checking available methods to execute SQL...\n");

  // Method 1: Try Supabase CLI
  let method = null;
  try {
    execSync("supabase --version", { stdio: "ignore" });
    method = "supabase-cli";
    console.log("✅ Found Supabase CLI");
  } catch (e) {
    console.log("❌ Supabase CLI not found");
  }

  // Method 2: Try psql
  if (!method) {
    try {
      execSync("psql --version", { stdio: "ignore" });
      method = "psql";
      console.log("✅ Found psql");
    } catch (e) {
      console.log("❌ psql not found");
    }
  }

  // Method 3: Try pg package (Node.js)
  if (!method) {
    try {
      const pg = await import("pg");
      method = "pg";
      console.log("✅ Found pg package");
    } catch (e) {
      console.log("❌ pg package not found");
    }
  }

  if (!method) {
    console.log("\n" + "=".repeat(60));
    console.log("⚠️  No SQL execution method found!");
    console.log("=".repeat(60));
    console.log("\n💡 Options to execute this SQL:");
    console.log("\n1. Supabase Dashboard (Recommended):");
    console.log("   - Go to: https://supabase.com/dashboard/project/" + SUPABASE_PROJECT_REF + "/sql/new");
    console.log("   - Copy and paste the SQL above");
    console.log("   - Click 'Run'");
    console.log("\n2. Install Supabase CLI:");
    console.log("   npm install -g supabase");
    console.log("   Then run: npm run sql:run " + sqlFileArg || "add_hoc_phi_rieng_to_lop_hoc_hoc_sinh.sql");
    console.log("\n3. Install pg package:");
    console.log("   npm install pg");
    console.log("   Then run: npm run sql:run " + sqlFileArg || "add_hoc_phi_rieng_to_lop_hoc_hoc_sinh.sql");
    console.log("\n4. Use psql directly:");
    console.log("   psql -h db." + SUPABASE_PROJECT_REF + ".supabase.co -U postgres -d postgres -f " + sqlFilePath);
    process.exit(0);
  }

  // Execute SQL based on available method
  console.log(`\n🚀 Executing SQL using ${method}...\n`);

  if (method === "supabase-cli") {
    // Use Supabase CLI
    const tempFile = join(__dirname, `temp_sql_${Date.now()}.sql`);
    try {
      const fs = await import("fs");
      fs.writeFileSync(tempFile, sqlContent);
      console.log("Executing via Supabase CLI...");
      const result = execSync(
        `supabase db execute --project-ref ${SUPABASE_PROJECT_REF} --file "${tempFile}"`,
        { encoding: "utf-8", stdio: "inherit" }
      );
      fs.unlinkSync(tempFile);
      console.log("\n✅ SQL executed successfully!");
    } catch (err) {
      const fs = await import("fs");
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      throw err;
    }
  } else if (method === "psql") {
    // Use psql - need connection string
    console.log("⚠️  psql requires database connection string.");
    console.log("Please set environment variables:");
    console.log("  PGHOST=db." + SUPABASE_PROJECT_REF + ".supabase.co");
    console.log("  PGPORT=5432");
    console.log("  PGDATABASE=postgres");
    console.log("  PGUSER=postgres");
    console.log("  PGPASSWORD=<your-password>");
    console.log("\nOr use Supabase Dashboard instead.");
    process.exit(1);
  } else if (method === "pg") {
    // Use pg package
    const { Client } = await import("pg");
    
    // Get connection string from environment variable
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    
    if (!connectionString) {
      console.log("⚠️  Database connection string not found!");
      console.log("\n💡 To use pg package, set one of these environment variables:");
      console.log("   DATABASE_URL=postgresql://postgres:[PASSWORD]@db." + SUPABASE_PROJECT_REF + ".supabase.co:5432/postgres");
      console.log("   or");
      console.log("   SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db." + SUPABASE_PROJECT_REF + ".supabase.co:5432/postgres");
      console.log("\n📝 You can get the connection string from:");
      console.log("   Supabase Dashboard → Settings → Database → Connection string");
      console.log("\n💡 Or use Supabase Dashboard to run SQL directly:");
      console.log("   https://supabase.com/dashboard/project/" + SUPABASE_PROJECT_REF + "/sql/new");
      process.exit(1);
    }

    const client = new Client({ connectionString });
    
    try {
      await client.connect();
      console.log("✅ Connected to database");
      
      // Split SQL into statements and execute each
      const statements = sqlContent
        .split(";")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0 && !stmt.match(/^--/));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
        try {
          const result = await client.query(statement);
          console.log("✅ Statement executed successfully!");
          if (result.rows && result.rows.length > 0) {
            console.log(`📊 Returned ${result.rows.length} row(s)`);
            if (result.rows.length <= 5) {
              console.log(JSON.stringify(result.rows, null, 2));
            }
          }
        } catch (err) {
          console.error(`❌ Error in statement ${i + 1}:`, err.message);
          throw err;
        }
      }
      
      await client.end();
      console.log("\n✅ All SQL statements executed successfully!");
    } catch (err) {
      await client.end();
      throw err;
    }
  }

} catch (error) {
  console.error("\n❌ Error:", error.message);
  if (error.code === "ENOENT") {
    console.error(`File not found: ${sqlFilePath}`);
  }
  process.exit(1);
}
