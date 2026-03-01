import { createClient } from "@supabase/supabase-js";

// ============================================
// CONFIGURATION
// ============================================
// Try multiple possible Firebase URLs
const POSSIBLE_FIREBASE_URLS = [
  process.env.FIREBASE_DATABASE_URL,
  process.env.VITE_FIREBASE_DATABASE_URL,
  "https://tritue-8plus-default-rtdb.asia-southeast1.firebasedatabase.app",
  "https://morata-a9eba-default-rtdb.asia-southeast1.firebasedatabase.app",
  "https://upedu2-5df07-default-rtdb.asia-southeast1.firebasedatabase.app",
].filter(Boolean);

let FIREBASE_DATABASE_URL = null;

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://mldlabfnewfgygpadfka.supabase.co";

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGxhYmZuZXdmZ3lncGFkZmthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA2NzQ3NywiZXhwIjoyMDg2NjQzNDc3fQ.x9xGSJ5Y4xBOfdJpcG_EQ_If4Bi21SX5WNNCPWJyGS0";

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Table mapping
const TABLE_MAPPING = {
  "Danh_sách_học_sinh": "hoc_sinh",
  "Học_sinh": "hoc_sinh",
  "Lớp_học": "lop_hoc",
  "Phòng_học": "phong_hoc",
  "Giáo_viên": "giao_vien",
  "Điểm_danh_sessions": "diem_danh_sessions",
  "Thời_khoá_biểu": "thoi_khoa_bieu",
  "Phiếu_thu_học_phí": "phieu_thu_hoc_phi",
  "Phiếu_lương_giáo_viên": "phieu_luong_giao_vien",
  "Gia_hạn": "gia_han",
  "Lịch_sử_sao_thưởng": "lich_su_sao_thuong",
  "Điểm_tự_nhập": "diem_tu_nhap",
  "Khóa_học": "khoa_hoc",
  "Lịch_trực_trung_tâm": "lich_truc_tung_tam",
  "Nhận_xét_tháng": "nhan_xet_thang",
};

// ============================================
// HELPER FUNCTIONS
// ============================================
const nodeUrl = (nodeName, baseUrl) =>
  `${baseUrl}/datasheet/${encodeURIComponent(nodeName)}.json`;

const detectFirebaseUrl = async () => {
  // Try to detect the correct Firebase URL by testing a common node
  const testNodes = ["Danh_sách_học_sinh", "Học_sinh", "Lớp_học", "Phòng_học"];
  
  for (const baseUrl of POSSIBLE_FIREBASE_URLS) {
    for (const testNode of testNodes) {
      try {
        const url = nodeUrl(testNode, baseUrl);
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data === "object" && Object.keys(data).length > 0) {
            console.log(`✅ Detected Firebase URL: ${baseUrl} (via ${testNode})`);
            return baseUrl;
          }
        }
      } catch (error) {
        // Continue to next URL
      }
    }
  }
  
  // If no URL works, use the first one as default
  const defaultUrl = POSSIBLE_FIREBASE_URLS[0];
  console.log(`⚠️  Could not detect Firebase URL, using default: ${defaultUrl}`);
  return defaultUrl;
};

const fetchFirebaseNode = async (nodeName) => {
  if (!FIREBASE_DATABASE_URL) {
    FIREBASE_DATABASE_URL = await detectFirebaseUrl();
  }
  
  try {
    const response = await fetch(nodeUrl(nodeName, FIREBASE_DATABASE_URL));
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Fetch failed: ${response.status}`);
    }
    const data = await response.json();
    return data || null;
  } catch (error) {
    console.error(`❌ Error fetching ${nodeName}:`, error.message);
    return null;
  }
};

const getSupabaseCount = async (tableName) => {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error(`❌ Error counting ${tableName}:`, error.message);
      return null;
    }

    return count || 0;
  } catch (error) {
    console.error(`❌ Exception counting ${tableName}:`, error.message);
    return null;
  }
};

// ============================================
// VERIFY FUNCTION
// ============================================
const verifyMigration = async () => {
  console.log("🔍 Verifying migration from Firebase to Supabase");
  
  // Detect Firebase URL
  FIREBASE_DATABASE_URL = await detectFirebaseUrl();
  
  console.log(`Firebase: ${FIREBASE_DATABASE_URL}`);
  console.log(`Supabase: ${SUPABASE_URL}\n`);

  const results = [];
  let totalFirebase = 0;
  let totalSupabase = 0;
  let totalMatch = 0;
  let totalMismatch = 0;

  // Verify each table
  for (const [firebaseNode, supabaseTable] of Object.entries(TABLE_MAPPING)) {
    console.log(`\n📊 Checking: ${firebaseNode} -> ${supabaseTable}`);

    // Get Firebase count
    const firebaseData = await fetchFirebaseNode(firebaseNode);
    const firebaseCount = firebaseData ? Object.keys(firebaseData).length : 0;

    // Get Supabase count
    const supabaseCount = await getSupabaseCount(supabaseTable);

    const match = firebaseCount === supabaseCount;
    const status = match ? "✅" : "❌";

    results.push({
      table: supabaseTable,
      firebase: firebaseCount,
      supabase: supabaseCount,
      match,
    });

    totalFirebase += firebaseCount;
    totalSupabase += supabaseCount || 0;
    if (match) {
      totalMatch++;
    } else {
      totalMismatch++;
    }

    console.log(
      `   ${status} Firebase: ${firebaseCount.toString().padStart(6)} | Supabase: ${(supabaseCount || 0).toString().padStart(6)}`
    );
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 VERIFICATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Firebase records: ${totalFirebase}`);
  console.log(`Total Supabase records: ${totalSupabase}`);
  console.log(`✅ Tables matched: ${totalMatch}`);
  console.log(`❌ Tables mismatched: ${totalMismatch}`);

  if (totalMismatch > 0) {
    console.log("\n❌ Mismatched tables:");
    results
      .filter((r) => !r.match)
      .forEach((r) => {
        const diff = r.supabase - r.firebase;
        console.log(
          `   ${r.table.padEnd(30)} Firebase: ${r.firebase.toString().padStart(6)} | Supabase: ${r.supabase.toString().padStart(6)} | Diff: ${diff > 0 ? "+" : ""}${diff}`
        );
      });
  }

  console.log("\n" + "=".repeat(60));

  if (totalMismatch === 0) {
    console.log("✅ All tables verified successfully!");
    return 0;
  } else {
    console.log("⚠️  Some tables have mismatched counts. Please review.");
    return 1;
  }
};

// ============================================
// RUN VERIFICATION
// ============================================
verifyMigration()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  });
