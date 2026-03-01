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

// ============================================
// TABLE MAPPING: Firebase path -> Supabase table
// ============================================
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
// FIELD MAPPING FOR EACH TABLE
// ============================================
const FIELD_MAPPINGS = {
  hoc_sinh: {
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
  },
  lop_hoc: {
    "Tên lớp": "ten_lop",
    "Mã lớp": "ma_lop",
    "Môn học": "mon_hoc",
    "Khối": "khoi",
    "Giáo viên chủ nhiệm": "giao_vien_chu_nhiem",
    "Teacher ID": "teacher_id",
    "Phòng học": "phong_hoc",
    "Lương GV": "luong_gv",
    "Học phí mỗi buổi": "hoc_phi_moi_buoi",
    "Ghi chú": "ghi_chu",
    "Trạng thái": "trang_thai",
    "Ngày tạo": "ngay_tao",
    "Người tạo": "nguoi_tao",
    "Lịch học": "lich_hoc",
    "Học sinh": "hoc_sinh",
    "Student IDs": "student_ids",
    "Student Enrollments": "student_enrollments",
    "Ngày bắt đầu": "ngay_bat_dau",
    "Ngày kết thúc": "ngay_ket_thuc",
    "Tài liệu": "tai_lieu",
    "Địa điểm": "dia_diem",
  },
  phong_hoc: {
    "Tên phòng": "ten_phong",
    "Mã phòng": "ma_phong",
    "Địa điểm": "dia_diem",
    "Sức chứa": "suc_chua",
    "Ghi chú": "ghi_chu",
  },
  giao_vien: {
    "Họ và tên": "ho_va_ten",
    "Mã giáo viên": "ma_giao_vien",
    "Số điện thoại": "so_dien_thoai",
    "Email": "email",
    "Môn dạy": "mon_day",
    "Trạng thái": "trang_thai",
    "Ghi chú": "ghi_chu",
  },
  diem_danh_sessions: {
    "Mã lớp": "ma_lop",
    "Tên lớp": "ten_lop",
    "Class ID": "class_id",
    "Ngày": "ngay",
    "Giờ bắt đầu": "gio_bat_dau",
    "Giờ kết thúc": "gio_ket_thuc",
    "Giáo viên": "giao_vien",
    "Teacher ID": "teacher_id",
    "Trạng thái": "trang_thai",
    "Điểm danh": "diem_danh",
    "Thời gian điểm danh": "thoi_gian_diem_danh",
    "Người điểm danh": "nguoi_diem_danh",
    "Thời gian hoàn thành": "thoi_gian_hoan_thanh",
    "Người hoàn thành": "nguoi_hoan_thanh",
    "Nội dung buổi học": "noi_dung_buoi_hoc",
    "Tài liệu nội dung": "tai_lieu_noi_dung",
    "Bài tập": "bai_tap",
    "Timestamp": "timestamp",
    "Học phí mỗi buổi": "hoc_phi_moi_buoi",
    "Lương GV": "luong_gv",
  },
  thoi_khoa_bieu: {
    "Class ID": "class_id",
    "Mã lớp": "ma_lop",
    "Tên lớp": "ten_lop",
    "Ngày": "ngay",
    "Thứ": "thu",
    "Giờ bắt đầu": "gio_bat_dau",
    "Giờ kết thúc": "gio_ket_thuc",
    "Phòng học": "phong_hoc",
    "Ghi chú": "ghi_chu",
    "Thay thế ngày": "thay_the_ngay",
    "Thay thế thứ": "thay_the_thu",
    "Teacher ID": "teacher_id",
    "Giáo viên": "giao_vien",
    "Timestamp": "timestamp",
  },
  phieu_thu_hoc_phi: {
    studentId: "student_id",
    studentName: "student_name",
    studentCode: "student_code",
    totalSessions: "total_sessions",
    totalAmount: "total_amount",
    finalAmount: "final_amount",
    pricePerSession: "price_per_session",
    paidAt: "paid_at",
    sessionPrices: "session_prices",
    invoiceImage: "invoice_image",
    firebaseId: "firebase_id",
  },
  phieu_luong_giao_vien: {
    teacherId: "teacher_id",
    teacherName: "teacher_name",
    teacherCode: "teacher_code",
    totalSessions: "total_sessions",
    totalSalary: "total_salary",
    totalAllowance: "total_allowance",
    totalHours: "total_hours",
    totalMinutes: "total_minutes",
    salaryPerSession: "salary_per_session",
    sessionSalaries: "session_salaries",
    paidAt: "paid_at",
    invoiceImage: "invoice_image",
  },
  gia_han: {
    studentId: "student_id",
    "Giờ đã học": "gio_da_hoc",
    "Giờ còn lại": "gio_con_lai",
    "Giờ nhập thêm": "gio_nhap_them",
    "Người nhập": "nguoi_nhap",
    "Ngày nhập": "ngay_nhap",
    "Giờ nhập": "gio_nhap",
    "Adjustment Type": "adjustment_type",
    "Old Total": "old_total",
    "New Total": "new_total",
    "Note": "note",
    Timestamp: "timestamp",
  },
  lich_su_sao_thuong: {
    studentId: "student_id",
    "Thay đổi": "thay_doi",
    "Số sao trước": "so_sao_truoc",
    "Số sao sau": "so_sao_sau",
    "Lý do": "ly_do",
    "Người chỉnh sửa": "nguoi_chinh_sua",
    "Ngày chỉnh sửa": "ngay_chinh_sua",
    "Giờ chỉnh sửa": "gio_chinh_sua",
    "Loại thay đổi": "loai_thay_doi",
    Timestamp: "timestamp",
  },
  diem_tu_nhap: {
    "Class ID": "class_id",
  },
  khoa_hoc: {
    "Tên khóa học": "ten_khoa_hoc",
    "Mã khóa học": "ma_khoa_hoc",
    "Mô tả": "mo_ta",
    "Trạng thái": "trang_thai",
    "Ngày bắt đầu": "ngay_bat_dau",
    "Ngày kết thúc": "ngay_ket_thuc",
  },
  lich_truc_tung_tam: {
    "Tên nhân viên": "ten_nhan_vien",
    "Thứ": "thu",
    "Giờ bắt đầu": "gio_bat_dau",
    "Giờ kết thúc": "gio_ket_thuc",
    "Ngày": "ngay",
    "Ghi chú": "ghi_chu",
  },
  nhan_xet_thang: {
    "Student ID": "student_id",
    "Class ID": "class_id",
    "Tháng": "thang",
    "Năm": "nam",
    "Nhận xét": "nhan_xet",
    "Người nhập": "nguoi_nhap",
    "Ngày nhập": "ngay_nhap",
  },
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
      if (response.status === 404) {
        console.log(`⚠️  Node ${nodeName} not found in Firebase (404)`);
        return null;
      }
      throw new Error(`Fetch Firebase node ${nodeName} failed: ${response.status}`);
    }
    const data = await response.json();
    return data || null;
  } catch (error) {
    console.error(`❌ Error fetching ${nodeName}:`, error.message);
    return null;
  }
};

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const ddmmyyyyMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return `${year}-${month}-${day}`;
  }
  return null;
};

const convertNumeric = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

const convertToSupabaseFormat = (firebaseData, recordId, tableName) => {
  const fieldMapping = FIELD_MAPPINGS[tableName] || {};
  const converted = { id: recordId, metadata: {} };

  // Map known fields
  Object.entries(fieldMapping).forEach(([firebaseField, supabaseField]) => {
    if (firebaseData[firebaseField] !== undefined && firebaseData[firebaseField] !== null) {
      let value = firebaseData[firebaseField];

      // Convert dates
      if (supabaseField.includes("ngay") || supabaseField.includes("date")) {
        value = parseDate(value);
      }

      // Convert numeric fields
      if (
        supabaseField.includes("so_") ||
        supabaseField.includes("_amount") ||
        supabaseField.includes("_salary") ||
        supabaseField.includes("_sessions") ||
        supabaseField.includes("_hours") ||
        supabaseField.includes("_minutes") ||
        supabaseField.includes("_price") ||
        supabaseField.includes("suc_chua") ||
        supabaseField.includes("luong") ||
        supabaseField.includes("hoc_phi") ||
        supabaseField.includes("diem_so") ||
        supabaseField.includes("thu") ||
        supabaseField.includes("thang") ||
        supabaseField.includes("nam")
      ) {
        value = convertNumeric(value);
      }

      // Convert JSON fields
      if (
        supabaseField === "diem_danh" ||
        supabaseField === "tai_lieu_noi_dung" ||
        supabaseField === "bai_tap" ||
        supabaseField === "lich_hoc" ||
        supabaseField === "hoc_sinh" ||
        supabaseField === "student_ids" ||
        supabaseField === "student_enrollments" ||
        supabaseField === "tai_lieu" ||
        supabaseField === "session_prices" ||
        supabaseField === "session_salaries"
      ) {
        if (typeof value === "string") {
          try {
            value = JSON.parse(value);
          } catch {
            value = value;
          }
        }
      }

      converted[supabaseField] = value;
    }
  });

  // Store unknown fields in metadata (only if table supports it)
  const tablesWithMetadata = ["hoc_sinh", "phong_hoc", "gia_han", "lich_su_sao_thuong"];
  if (tablesWithMetadata.includes(tableName)) {
    Object.keys(firebaseData).forEach((key) => {
      if (!fieldMapping[key] && key !== "id") {
        converted.metadata[key] = firebaseData[key];
      }
    });
  } else {
    // For tables without metadata column, just skip unknown fields
    // or you can log them for debugging
  }

  // Handle special cases
  if (tableName === "gia_han" && !converted.student_id) {
    // Try to get student_id from metadata or other fields
    if (firebaseData["Student ID"]) {
      converted.student_id = firebaseData["Student ID"];
    } else if (firebaseData.studentId) {
      converted.student_id = firebaseData.studentId;
    } else {
      console.warn(`⚠️  Warning: gia_han record ${recordId} missing student_id, skipping...`);
      return null; // Skip this record
    }
  }

  // Handle duplicate ma_hoc_sinh for hoc_sinh
  if (tableName === "hoc_sinh" && converted.ma_hoc_sinh) {
    // If ma_hoc_sinh already exists, append suffix or skip
    // This will be handled by upsert with onConflict
  }

  return converted;
};

const chunk = (items, size = 500) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const upsertMany = async (tableName, rows) => {
  if (rows.length === 0) {
    return { total: 0, succeeded: 0, errors: [] };
  }

  let succeeded = 0;
  const errors = [];
  const groups = chunk(rows, 500);

  // Remove metadata field for tables that don't have it
  const tablesWithoutMetadata = ["thoi_khoa_bieu", "diem_danh_sessions", "phieu_thu_hoc_phi", "phieu_luong_giao_vien"];
  const cleanedRows = rows.map((row) => {
    const cleaned = { ...row };
    if (tablesWithoutMetadata.includes(tableName) && cleaned.metadata) {
      delete cleaned.metadata;
    }
    return cleaned;
  });

  const cleanedGroups = chunk(cleanedRows, 500);

  for (const batch of cleanedGroups) {
    try {
      // For hoc_sinh, handle duplicates by updating existing records
      let onConflict = "id";
      if (tableName === "hoc_sinh") {
        // For duplicate ma_hoc_sinh, we'll update by id instead
        // First, try to get existing records with same ma_hoc_sinh
        // and update them, or insert new ones
        onConflict = "id";
      }

      const { error } = await supabase.from(tableName).upsert(batch, { onConflict });

      if (error) {
        errors.push({ batch: batch.length, error: error.message });
        console.error(`❌ Error upserting batch to ${tableName}:`, error.message);
      } else {
        succeeded += batch.length;
        console.log(`✅ ${tableName}: ${succeeded}/${rows.length}`);
      }
    } catch (error) {
      errors.push({ batch: batch.length, error: error.message });
      console.error(`❌ Exception upserting batch to ${tableName}:`, error.message);
    }
  }

  return { total: rows.length, succeeded, errors };
};

// ============================================
// MIGRATION FUNCTIONS FOR EACH TABLE
// ============================================
const migrateTable = async (firebaseNodeName, supabaseTableName) => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔄 Migrating: ${firebaseNodeName} -> ${supabaseTableName}`);
  console.log(`${"=".repeat(60)}`);

  // Fetch data from Firebase
  const firebaseData = await fetchFirebaseNode(firebaseNodeName);
  if (!firebaseData || Object.keys(firebaseData).length === 0) {
    console.log(`⚠️  No data found in Firebase for ${firebaseNodeName}`);
    return { total: 0, succeeded: 0, errors: [] };
  }

  // Convert to Supabase format
  const rows = Object.entries(firebaseData)
    .map(([id, value]) => convertToSupabaseFormat(value, id, supabaseTableName))
    .filter((row) => row !== null); // Filter out null records (skipped)

  console.log(`📊 Found ${rows.length} records to migrate`);

  // Upsert to Supabase
  const result = await upsertMany(supabaseTableName, rows);

  console.log(`\n✅ Migration complete for ${firebaseNodeName}`);
  console.log(`   Total: ${result.total}`);
  console.log(`   Succeeded: ${result.succeeded}`);
  if (result.errors.length > 0) {
    console.log(`   Errors: ${result.errors.length}`);
  }

  return result;
};

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================
const migrateAll = async () => {
  console.log("🚀 Starting migration from Firebase to Supabase");
  
  // Detect Firebase URL
  FIREBASE_DATABASE_URL = await detectFirebaseUrl();
  
  console.log(`Firebase: ${FIREBASE_DATABASE_URL}`);
  console.log(`Supabase: ${SUPABASE_URL}\n`);

  const results = {};
  const allErrors = [];

  // Migrate each table
  for (const [firebaseNode, supabaseTable] of Object.entries(TABLE_MAPPING)) {
    try {
      const result = await migrateTable(firebaseNode, supabaseTable);
      results[firebaseNode] = result;
      if (result.errors && result.errors.length > 0) {
        allErrors.push(...result.errors.map((e) => ({ table: supabaseTable, ...e })));
      }
    } catch (error) {
      console.error(`❌ Failed to migrate ${firebaseNode}:`, error.message);
      results[firebaseNode] = { total: 0, succeeded: 0, errors: [error.message] };
      allErrors.push({ table: supabaseTable, error: error.message });
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 MIGRATION SUMMARY");
  console.log("=".repeat(60));

  let totalRecords = 0;
  let totalSucceeded = 0;
  let totalErrors = 0;

  Object.entries(results).forEach(([table, result]) => {
    totalRecords += result.total;
    totalSucceeded += result.succeeded;
    totalErrors += result.errors ? result.errors.length : 0;
    console.log(
      `${table.padEnd(30)} ${result.succeeded.toString().padStart(6)}/${result.total.toString().padStart(6)}`
    );
  });

  console.log("=".repeat(60));
  console.log(`Total records: ${totalRecords}`);
  console.log(`✅ Succeeded: ${totalSucceeded}`);
  console.log(`❌ Errors: ${totalErrors}`);

  if (allErrors.length > 0) {
    console.log("\n❌ Error details:");
    allErrors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.table}: ${err.error}`);
    });
  }

  console.log("\n✅ Migration completed!");
};

// ============================================
// RUN MIGRATION
// ============================================
migrateAll()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
