import { createClient } from "@supabase/supabase-js";

// Configuration
const FIREBASE_DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  process.env.VITE_FIREBASE_DATABASE_URL ||
  "https://upedu2-5df07-default-rtdb.asia-southeast1.firebasedatabase.app";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://mldlabfnewfgygpadfka.supabase.co";

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGxhYmZuZXdmZ3lncGFkZmthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA2NzQ3NywiZXhwIjoyMDg2NjQzNDc3fQ.x9xGSJ5Y4xBOfdJpcG_EQ_If4Bi21SX5WNNCPWJyGS0";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Field mapping
const fieldMapping = {
  "Họ và tên": "ho_va_ten",
  "Mã học sinh": "ma_hoc_sinh",
  "Ngày sinh": "ngay_sinh",
  "Giới tính": "gioi_tinh",
  "Số điện thoại": "so_dien_thoai",
  "SĐT phụ huynh": "sdt_phu_huynh",
  "Họ tên phụ huynh": "ho_ten_phu_huynh",
  "Phụ huynh": "ho_ten_phu_huynh",
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

      // Convert date strings
      if (supabaseField === "ngay_sinh" && typeof value === "string") {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          value = value;
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

// Main migration function with duplicate handling
async function migrateStudents() {
  try {
    console.log("🔄 Starting hoc_sinh migration with duplicate handling...\n");

    // Fetch from Firebase
    const url = `${FIREBASE_DATABASE_URL}/datasheet/Danh_s%C3%A1ch_h%E1%BB%8Dc_sinh.json`;
    console.log(`📥 Fetching from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const firebaseStudents = await response.json();
    if (!firebaseStudents) {
      console.log("❌ No students found in Firebase");
      return;
    }

    const studentEntries = Object.entries(firebaseStudents);
    console.log(`✅ Found ${studentEntries.length} students in Firebase\n`);

    // Get existing students from Supabase
    const { data: existingStudents, error: fetchError } = await supabase
      .from("hoc_sinh")
      .select("id, ma_hoc_sinh");

    if (fetchError) {
      console.error("❌ Error fetching existing students:", fetchError);
    }

    const existingIds = new Set(existingStudents?.map((s) => s.id) || []);
    const existingMaHocSinh = new Map(
      existingStudents?.filter((s) => s.ma_hoc_sinh).map((s) => [s.ma_hoc_sinh, s.id]) || []
    );

    console.log(`✅ Found ${existingIds.size} existing students in Supabase\n`);

    // Migrate each student
    let successCount = 0;
    let updateCount = 0;
    let insertCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const [studentId, studentData] of studentEntries) {
      try {
        const supabaseData = convertToSupabaseFormat(studentData, studentId);
        const isUpdate = existingIds.has(studentId);

        // Check for duplicate ma_hoc_sinh
        if (supabaseData.ma_hoc_sinh) {
          const existingIdWithSameMa = existingMaHocSinh.get(supabaseData.ma_hoc_sinh);
          if (existingIdWithSameMa && existingIdWithSameMa !== studentId) {
            console.log(`⚠️  Skipping ${studentId}: duplicate ma_hoc_sinh "${supabaseData.ma_hoc_sinh}" (exists as ${existingIdWithSameMa})`);
            skipCount++;
            continue;
          }
        }

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
    console.log(`⚠️  Skipped (duplicates): ${skipCount}`);
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
