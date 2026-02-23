import { createClient } from "@supabase/supabase-js";

// Firebase database URL - Try multiple possible URLs
// You can find it in Firebase Console → Realtime Database
const POSSIBLE_FIREBASE_URLS = [
  process.env.FIREBASE_DATABASE_URL,
  "https://morata-a9eba-default-rtdb.asia-southeast1.firebasedatabase.app",
  "https://tritue-8plus-default-rtdb.asia-southeast1.firebasedatabase.app",
].filter(Boolean);

// Supabase configuration
const SUPABASE_URL = "https://mldlabfnewfgygpadfka.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGxhYmZuZXdmZ3lncGFkZmthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA2NzQ3NywiZXhwIjoyMDg2NjQzNDc3fQ.x9xGSJ5Y4xBOfdJpcG_EQ_If4Bi21SX5WNNCPWJyGS0";

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Mapping từ Firebase field names sang Supabase column names
const fieldMapping = {
  "Họ và tên": "ho_va_ten",
  "Mã học sinh": "ma_hoc_sinh",
  "Ngày sinh": "ngay_sinh",
  "Giới tính": "gioi_tinh",
  "Số điện thoại": "so_dien_thoai",
  "SĐT phụ huynh": "sdt_phu_huynh",
  "Họ tên phụ huynh": "ho_ten_phu_huynh",
  "Phụ huynh": "ho_ten_phu_huynh", // Fallback
  "Địa chỉ": "dia_chi",
  "Trường": "truong",
  "Khối": "khoi",
  "Email": "email",
  "Username": "username",
  "Password": "password",
  "Điểm số": "diem_so",
  "Trạng thái": "trang_thai",
  "Số giờ đã gia hạn": "so_gio_da_gia_han",
  "Số giờ còn lại": "so_gio_con_lai",
  "Số giờ đã học": "so_gio_da_hoc",
  "Ghi chú": "ghi_chu",
};

// Convert Firebase data to Supabase format
function convertToSupabaseFormat(firebaseData, studentId) {
  const supabaseData = {
    id: studentId,
    metadata: {},
  };

  // Map known fields
  Object.entries(fieldMapping).forEach(([firebaseField, supabaseField]) => {
    if (firebaseData[firebaseField] !== undefined && firebaseData[firebaseField] !== null) {
      let value = firebaseData[firebaseField];
      
      // Convert date strings to Date objects
      if (supabaseField === "ngay_sinh" && typeof value === "string") {
        // Try to parse date (format: YYYY-MM-DD)
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          value = value; // Keep as string for DATE type
        }
      }
      
      // Convert numeric fields
      if (["so_gio_da_gia_han", "so_gio_con_lai", "so_gio_da_hoc", "diem_so"].includes(supabaseField)) {
        value = typeof value === "string" ? parseFloat(value) || 0 : (value || 0);
      }
      
      // Set default for trang_thai
      if (supabaseField === "trang_thai") {
        value = value || "active";
      }
      
      supabaseData[supabaseField] = value;
    }
  });

  // Store unknown fields in metadata
  Object.keys(firebaseData).forEach((key) => {
    if (!fieldMapping[key] && key !== "id") {
      supabaseData.metadata[key] = firebaseData[key];
    }
  });

  return supabaseData;
}

// Main migration function
async function migrateStudents() {
  try {
    console.log("🔄 Starting migration from Firebase to Supabase...\n");

    // Read students from Firebase using REST API
    console.log("📥 Reading students from Firebase...");
    
    let firebaseStudents = null;
    let firebaseUrl = null;
    
    // Try each possible Firebase URL
    for (const baseUrl of POSSIBLE_FIREBASE_URLS) {
      const url = `${baseUrl}/datasheet/Danh_s%C3%A1ch_h%E1%BB%8Dc_sinh.json`;
      console.log(`📡 Trying: ${url}`);
      
      try {
        const response = await fetch(url);
        if (response.ok) {
          firebaseStudents = await response.json();
          firebaseUrl = baseUrl;
          console.log(`✅ Successfully connected to: ${baseUrl}`);
          break;
        } else {
          console.log(`❌ Failed with status ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }
    
    if (!firebaseStudents) {
      throw new Error("Could not connect to Firebase. Please check the database URL.");
    }

    if (!firebaseStudents) {
      console.log("❌ No students found in Firebase");
      return;
    }

    const studentEntries = Object.entries(firebaseStudents);
    console.log(`✅ Found ${studentEntries.length} students in Firebase\n`);

    // Get existing students from Supabase
    console.log("📥 Reading existing students from Supabase...");
    const { data: existingStudents, error: fetchError } = await supabase
      .from("hoc_sinh")
      .select("id");

    if (fetchError) {
      console.error("❌ Error fetching existing students:", fetchError);
      // Continue anyway - might be first migration
    }

    const existingIds = new Set(existingStudents?.map((s) => s.id) || []);
    console.log(`✅ Found ${existingIds.size} existing students in Supabase\n`);

    // Migrate each student
    let successCount = 0;
    let updateCount = 0;
    let insertCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const [studentId, studentData] of studentEntries) {
      try {
        const supabaseData = convertToSupabaseFormat(studentData, studentId);
        const isUpdate = existingIds.has(studentId);

        if (isUpdate) {
          // Update existing student
          const { error } = await supabase
            .from("hoc_sinh")
            .update(supabaseData)
            .eq("id", studentId);

          if (error) {
            throw error;
          }
          updateCount++;
          console.log(`✅ Updated: ${supabaseData.ho_va_ten || studentId}`);
        } else {
          // Insert new student
          const { error } = await supabase
            .from("hoc_sinh")
            .insert(supabaseData);

          if (error) {
            throw error;
          }
          insertCount++;
          console.log(`✅ Inserted: ${supabaseData.ho_va_ten || studentId}`);
        }
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `Error migrating student ${studentId}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Migration Summary");
    console.log("=".repeat(60));
    console.log(`Total students in Firebase: ${studentEntries.length}`);
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`   - Inserted: ${insertCount}`);
    console.log(`   - Updated: ${updateCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log("\n❌ Error details:");
      errors.forEach((err) => console.log(`   - ${err}`));
    }
    
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateStudents()
  .then(() => {
    console.log("\n✅ Migration completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
