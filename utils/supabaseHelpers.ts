import { supabase, supabaseAdmin, getTableName } from "@/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helper functions to replace Firebase Realtime Database operations with Supabase
 */

// Generate Firebase-compatible ID (similar to Firebase's push() ID format)
export const generateFirebaseId = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const timestamp = Date.now().toString(36);
  let id = "-" + timestamp;
  for (let i = 0; i < 15; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

// Track tables that don't exist to avoid repeated 404s
const missingTables = new Set<string>();

// Get Supabase client (prefer admin for write operations, regular for read)
const getClient = (useAdmin: boolean = false): SupabaseClient | null => {
  const client = useAdmin ? supabaseAdmin : supabase;
  if (!client) {
    console.error("❌ Supabase client is null! Check Supabase initialization.");
    return null;
  }
  return client;
};

/**
 * Convert Supabase format (snake_case) back to camelCase for frontend
 */
export const convertFromSupabaseFormat = (data: any, tableName: string): any => {
  if (!data || typeof data !== "object") return data;

  const converted = { ...data };

  // For phieu_thu_hoc_phi table, convert field names from snake_case to camelCase
  if (tableName === "phieu_thu_hoc_phi" || tableName === "Phieu_thu_hoc_phi") {
    const fieldMapping: Record<string, string> = {
      student_id: "studentId",
      student_name: "studentName",
      student_code: "studentCode",
      class_id: "classId",
      class_name: "className",
      class_code: "classCode",
      total_sessions: "totalSessions",
      total_amount: "totalAmount",
      final_amount: "finalAmount",
      price_per_session: "pricePerSession",
      paid_at: "paidAt",
      session_prices: "sessionPrices",
      invoice_image: "invoiceImage",
      firebase_id: "firebaseId",
    };

    // Convert field names from snake_case to camelCase
    Object.entries(fieldMapping).forEach(([snakeCase, camelCase]) => {
      if (converted[snakeCase] !== undefined) {
        converted[camelCase] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });
  }

  // For phieu_thu_hoc_phi_chi_tiet table (bảng chi tiết mới)
  if (tableName === "phieu_thu_hoc_phi_chi_tiet" || tableName === "Phieu_thu_hoc_phi_chi_tiet") {
    const fieldMapping: Record<string, string> = {
      student_id: "studentId",
      student_name: "studentName",
      student_code: "studentCode",
      class_id: "classId",
      class_name: "className",
      class_code: "classCode",
      total_sessions: "totalSessions",
      total_amount: "totalAmount",
      final_amount: "finalAmount",
      price_per_session: "pricePerSession",
      paid_at: "paidAt",
      invoice_image: "invoiceImage",
    };

    // Convert field names from snake_case to camelCase
    Object.entries(fieldMapping).forEach(([snakeCase, camelCase]) => {
      if (converted[snakeCase] !== undefined) {
        converted[camelCase] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });

    // Giữ nguyên month 1-12 như database (không convert sang 0-11)
    // Month từ database là 1-12, giữ nguyên
  }

  // For Phieu_luong_giao_vien table
  if (tableName === "Phieu_luong_giao_vien") {
    const fieldMapping: Record<string, string> = {
      teacher_id: "teacherId",
      teacher_name: "teacherName",
      teacher_code: "teacherCode",
      total_sessions: "totalSessions",
      total_salary: "totalSalary",
      total_allowance: "totalAllowance",
      total_hours: "totalHours",
      total_minutes: "totalMinutes",
      salary_per_session: "salaryPerSession",
      session_salaries: "sessionSalaries",
      paid_at: "paidAt",
      invoice_image: "invoiceImage",
    };

    Object.entries(fieldMapping).forEach(([snakeCase, camelCase]) => {
      if (converted[snakeCase] !== undefined) {
        converted[camelCase] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });
  }

  // For lop_hoc table (Lớp học)
  if (tableName === "lop_hoc" || tableName === "Lop_hoc" || tableName === "Lớp_học" || tableName === "datasheet/Lớp_học") {
    const fieldMapping: Record<string, string> = {
      ten_lop: "Tên lớp",
      ma_lop: "Mã lớp",
      mon_hoc: "Môn học",
      khoi: "Khối",
      giao_vien_chu_nhiem: "Giáo viên chủ nhiệm",
      teacher_id: "Teacher ID",
      phong_hoc: "Phòng học",
      luong_gv: "Lương GV",
      hoc_phi_moi_buoi: "Học phí mỗi buổi",
      ghi_chu: "Ghi chú",
      trang_thai: "Trạng thái",
      ngay_tao: "Ngày tạo",
      nguoi_tao: "Người tạo",
      lich_hoc: "Lịch học",
      hoc_sinh: "Học sinh",
      student_ids: "Student IDs",
      student_enrollments: "Student Enrollments",
      ngay_bat_dau: "Ngày bắt đầu",
      ngay_ket_thuc: "Ngày kết thúc",
      tai_lieu: "Tài liệu",
    };

    Object.entries(fieldMapping).forEach(([snakeCase, camelCase]) => {
      if (converted[snakeCase] !== undefined) {
        converted[camelCase] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });
  }

  // For giao_vien table (Giáo viên)
  if (tableName === "giao_vien" || tableName === "Giáo_viên") {
    const fieldMapping: Record<string, string> = {
      ten_giao_vien: "Họ và tên",
      ma_giao_vien: "Mã giáo viên",
      so_dien_thoai: "SĐT",
      email: "Email",
      password: "Password",
      bien_che: "Biên chế",
      vi_tri: "Vị trí",
      ngan_hang: "Ngân hàng",
      stk: "STK",
      dia_chi: "Địa chỉ",
      luong_theo_buoi: "Lương theo buổi",
    };

    Object.entries(fieldMapping).forEach(([snakeCase, firebaseField]) => {
      if (converted[snakeCase] !== undefined) {
        converted[firebaseField] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });
  }

  // For phong_hoc table (Phòng học)
  if (tableName === "phong_hoc" || tableName === "Phòng_học" || tableName === "datasheet/Phòng_học") {
    const fieldMapping: Record<string, string> = {
      ten_phong: "Tên phòng",
      ma_phong: "Mã phòng",
      dia_diem: "Địa điểm",
      suc_chua: "Sức chứa",
      ghi_chu: "Ghi chú",
    };

    Object.entries(fieldMapping).forEach(([snakeCase, firebaseField]) => {
      if (converted[snakeCase] !== undefined) {
        converted[firebaseField] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });

    // Merge metadata
    if (converted.metadata && typeof converted.metadata === "object") {
      Object.assign(converted, converted.metadata);
      delete converted.metadata;
    }
  }

  // For lop_hoc_hoc_sinh table (Chi tiết học sinh trong lớp)
  if (tableName === "lop_hoc_hoc_sinh") {
    const fieldMapping: Record<string, string> = {
      class_id: "classId",
      student_id: "studentId",
      student_name: "studentName",
      student_code: "studentCode",
      hoc_phi_rieng: "hocPhiRieng",
      enrollment_date: "enrollmentDate",
      created_at: "createdAt",
      updated_at: "updatedAt",
    };

    Object.entries(fieldMapping).forEach(([snakeCase, camelCase]) => {
      if (converted[snakeCase] !== undefined) {
        converted[camelCase] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });
  }

  // For hoc_sinh table (Học sinh)
  if (tableName === "hoc_sinh" || tableName === "Học_sinh" || tableName === "datasheet/Học_sinh") {
    const fieldMapping: Record<string, string> = {
      ho_va_ten: "Họ và tên",
      ma_hoc_sinh: "Mã học sinh",
      ngay_sinh: "Ngày sinh",
      gioi_tinh: "Giới tính",
      so_dien_thoai: "Số điện thoại",
      sdt_phu_huynh: "SĐT phụ huynh",
      ho_ten_phu_huynh: "Họ tên phụ huynh",
      dia_chi: "Địa chỉ",
      truong: "Trường",
      khoi: "Khối",
      email: "Email",
      username: "Username",
      password: "Mật khẩu",
      diem_so: "Điểm số",
      trang_thai: "Trạng thái",
      so_gio_da_gia_han: "Số giờ đã gia hạn",
      so_gio_con_lai: "Số giờ còn lại",
      so_gio_da_hoc: "Số giờ đã học",
      ghi_chu: "Ghi chú",
      created_at: "createdAt",
      updated_at: "updatedAt",
    };

    Object.entries(fieldMapping).forEach(([snakeCase, firebaseField]) => {
      if (converted[snakeCase] !== undefined) {
        converted[firebaseField] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });

    // Merge metadata fields back
    if (converted.metadata && typeof converted.metadata === "object") {
      Object.assign(converted, converted.metadata);
      delete converted.metadata;
    }
  }

  // For gia_han table (Extension History)
  if (tableName === "gia_han" || tableName === "Gia_hạn") {
    const fieldMapping: Record<string, string> = {
      student_id: "studentId",
      gio_da_hoc: "Giờ đã học",
      gio_con_lai: "Giờ còn lại",
      gio_nhap_them: "Giờ nhập thêm",
      nguoi_nhap: "Người nhập",
      ngay_nhap: "Ngày nhập",
      gio_nhap: "Giờ nhập",
      adjustment_type: "Adjustment Type",
      old_total: "Old Total",
      new_total: "New Total",
      note: "Note",
    };

    Object.entries(fieldMapping).forEach(([snakeCase, firebaseField]) => {
      if (converted[snakeCase] !== undefined) {
        converted[firebaseField] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });

    // Merge metadata
    if (converted.metadata && typeof converted.metadata === "object") {
      Object.assign(converted, converted.metadata);
      delete converted.metadata;
    }
  }

  // For lich_su_sao_thuong table (Stars History)
  if (tableName === "lich_su_sao_thuong" || tableName === "Lịch_sử_sao_thưởng") {
    const fieldMapping: Record<string, string> = {
      student_id: "studentId",
      thay_doi: "Thay đổi",
      so_sao_truoc: "Số sao trước",
      so_sao_sau: "Số sao sau",
      ly_do: "Lý do",
      nguoi_chinh_sua: "Người chỉnh sửa",
      ngay_chinh_sua: "Ngày chỉnh sửa",
      gio_chinh_sua: "Giờ chỉnh sửa",
      loai_thay_doi: "Loại thay đổi",
    };

    Object.entries(fieldMapping).forEach(([snakeCase, firebaseField]) => {
      if (converted[snakeCase] !== undefined) {
        converted[firebaseField] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });

    // Merge metadata
    if (converted.metadata && typeof converted.metadata === "object") {
      Object.assign(converted, converted.metadata);
      delete converted.metadata;
    }
  }

  // For diem_danh_sessions table (Attendance Sessions)
  if (tableName === "diem_danh_sessions" || tableName === "Điểm_danh_sessions") {
    const fieldMapping: Record<string, string> = {
      ma_lop: "Mã lớp",
      ten_lop: "Tên lớp",
      class_id: "Class ID",
      ngay: "Ngày",
      gio_bat_dau: "Giờ bắt đầu",
      gio_ket_thuc: "Giờ kết thúc",
      giao_vien: "Giáo viên",
      teacher_id: "Teacher ID",
      trang_thai: "Trạng thái",
      diem_danh: "Điểm danh",
      thoi_gian_diem_danh: "Thời gian điểm danh",
      nguoi_diem_danh: "Người điểm danh",
      thoi_gian_hoan_thanh: "Thời gian hoàn thành",
      nguoi_hoan_thanh: "Người hoàn thành",
      noi_dung_buoi_hoc: "Nội dung buổi học",
      tai_lieu_noi_dung: "Tài liệu nội dung",
      bai_tap: "Bài tập",
      timestamp: "Timestamp",
      hoc_phi_moi_buoi: "Học phí mỗi buổi",
      luong_gv: "Lương GV",
    };

    Object.entries(fieldMapping).forEach(([snakeCase, firebaseField]) => {
      if (converted[snakeCase] !== undefined) {
        converted[firebaseField] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });
  }

  // For thoi_khoa_bieu table (Custom Timetable)
  if (tableName === "thoi_khoa_bieu" || tableName === "Thời_khoá_biểu") {
    const fieldMapping: Record<string, string> = {
      class_id: "Class ID",
      ma_lop: "Mã lớp",
      ten_lop: "Tên lớp",
      ngay: "Ngày",
      thu: "Thứ",
      gio_bat_dau: "Giờ bắt đầu",
      gio_ket_thuc: "Giờ kết thúc",
      phong_hoc: "Phòng học",
      ghi_chu: "Ghi chú",
      thay_the_ngay: "Thay thế ngày",
      thay_the_thu: "Thay thế thứ",
      teacher_id: "Teacher ID",
      giao_vien: "Giáo viên",
      timestamp: "Timestamp",
    };

    Object.entries(fieldMapping).forEach(([snakeCase, firebaseField]) => {
      if (converted[snakeCase] !== undefined) {
        converted[firebaseField] = converted[snakeCase];
        delete converted[snakeCase];
      }
    });
  }

  // For diem_tu_nhap table (Custom Scores)
  if (tableName === "diem_tu_nhap" || tableName === "Điểm_tự_nhập") {
    // Keep structure as is (columns and scores are JSONB)
    // Just convert class_id if needed
    if (converted.class_id !== undefined && !converted["Class ID"]) {
      converted["Class ID"] = converted.class_id;
    }
  }

  return converted;
};

// Cache for fetching status to prevent redundant calls
const fetchLocks = new Map<string, Promise<any>>();

/**
 * Get all records from a table (replaces Firebase ref + get)
 */
export const supabaseGetAll = async <T = any>(tablePath: string, force: boolean = false): Promise<Record<string, T> | null> => {
  // Use lock to prevent simultaneous redundant fetches, unless forced
  if (!force && fetchLocks.has(tablePath)) {
    return fetchLocks.get(tablePath);
  }

  const fetchPromise = (async () => {
    const tableName = getTableName(tablePath);
    // Use admin for all tables to bypass RLS issues globally during migration
    const useAdmin = true;
    const client = getClient(useAdmin);

    if (missingTables.has(tableName)) {
      return null;
    }

    try {
      const { data, error } = await client.from(tableName).select("*");

      if (error) {
        // If table doesn't exist, return null instead of logging error (table might not be created yet)
        // PGRST205 = table not found, 404 = not found (HTTP status)
        if (error.code === "PGRST205" || error.message?.includes("404") || error.message?.includes("not found")) {
          missingTables.add(tableName);
          return null;
        }
        console.error(`Error fetching from ${tableName}:`, error);
        return null;
      }

      // Convert array to object with id as key, and convert field names
      if (data && Array.isArray(data)) {
        const result: Record<string, T> = {};
        data.forEach((item: any) => {
          if (item.id) {
            // Convert from Supabase format (snake_case) to camelCase
            const convertedItem = convertFromSupabaseFormat(item, tableName);
            result[item.id] = convertedItem as T;
          }
        });
        return result;
      }
      return null;
    } catch (err) {
      console.error(`❌ Error in supabaseGetAll for ${tablePath}:`, err);
      return null;
    }
  })();

  fetchLocks.set(tablePath, fetchPromise);
  // Clear lock after a short delay to allow fresh fetches later
  fetchPromise.finally(() => setTimeout(() => fetchLocks.delete(tablePath), 1000));

  return fetchPromise;
};

/**
 * Get a single record by ID
 */
export const supabaseGetById = async <T = any>(tablePath: string, id: string, useAdmin: boolean = false): Promise<T | null> => {
  const client = getClient(useAdmin);
  const tableName = getTableName(tablePath);

  const { data, error } = await client
    .from(tableName)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching ${id} from ${tableName}:`, error);
    return null;
  }

  // Convert from Supabase format (snake_case) to camelCase
  const convertedData = convertFromSupabaseFormat(data, tableName);
  return convertedData as T;
};

/**
 * Get records filtered by student_id, month, and year
 */
export const supabaseGetByStudentMonthYear = async <T = any>(
  tablePath: string,
  studentId: string,
  month: number,
  year: number
): Promise<Record<string, T> | null> => {
  const client = getClient(false);
  const tableName = getTableName(tablePath);

  console.log(`🔍 Querying ${tableName} with filters:`, { studentId, month, year });

  const { data, error } = await client
    .from(tableName)
    .select("*")
    .eq("student_id", studentId)
    .eq("month", month)
    .eq("year", year);

  if (error) {
    console.error(`Error fetching from ${tableName} with filters:`, error);
    return null;
  }

  // Convert array to object with id as key, and convert field names
  if (data && Array.isArray(data)) {
    const result: Record<string, T> = {};
    data.forEach((item: any) => {
      if (item.id) {
        // Convert from Supabase format (snake_case) to camelCase
        const convertedItem = convertFromSupabaseFormat(item, tableName);
        result[item.id] = convertedItem as T;
      }
    });
    console.log(`✅ Found ${Object.keys(result).length} records matching filters`);
    return result;
  }

  return null;
};

/**
 * Get invoice by student_id, month, year, and optionally class_id
 * Returns the first matching invoice or null
 * Note: For phieu_thu_hoc_phi (old format), class_id is ignored
 *       For phieu_thu_hoc_phi_chi_tiet (new format), class_id is required
 */
export const supabaseGetInvoiceByKey = async (
  tablePath: string,
  studentId: string,
  month: number,
  year: number,
  classId?: string
): Promise<any | null> => {
  const client = getClient(false);
  const tableName = getTableName(tablePath);

  let query = client
    .from(tableName)
    .select("*")
    .eq("student_id", studentId)
    .eq("month", month)
    .eq("year", year);

  // If classId is provided and table supports it (phieu_thu_hoc_phi_chi_tiet), filter by it
  if (classId && (tableName === "phieu_thu_hoc_phi_chi_tiet" || tableName === "Phieu_thu_hoc_phi_chi_tiet")) {
    query = query.eq("class_id", classId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    // If no record found, that's okay - return null
    if (error.code === "PGRST116") {
      return null;
    }
    console.error(`Error fetching invoice from ${tableName}:`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Convert from Supabase format
  const convertedData = convertFromSupabaseFormat(data, tableName);
  return convertedData;
};

/**
 * Insert/Update a record (replaces Firebase ref + set)
 */
export const supabaseSet = async (
  tablePath: string,
  data: any,
  options?: { upsert?: boolean; onConflict?: string }
): Promise<boolean> => {
  const client = getClient(true); // Use admin for write operations
  if (!client) {
    console.error("❌ Cannot get Supabase client. Check initialization.");
    return false;
  }

  // Extract ID from path if not in data
  const parts = tablePath.split("/");
  // If path is like "datasheet/TableName/ID", the last part is the ID
  // parts[0] = "datasheet", parts[1] = "TableName", parts[2] = "ID"
  if (parts.length >= 3) {
    const pathId = parts[parts.length - 1];
    if (pathId && !data.id) {
      data.id = pathId;
      console.log(`🆔 Extracted ID from path: ${pathId}`);
    }
  }

  const tableName = getTableName(tablePath);
  
  // Clear fetch lock for this table path after write operation to ensure next fetch gets fresh data
  fetchLocks.delete(tablePath);
  // Also clear the table name without parts if it's different
  if (tablePath.includes("/")) {
    fetchLocks.delete(tableName);
  }

  console.log(`📤 Saving to Supabase table: ${tableName}`, { id: data.id, dataKeys: Object.keys(data) });

  // Convert camelCase to snake_case for database fields
  const convertedData = convertToSupabaseFormat(data, tableName);
  console.log(`📤 Converted data keys:`, Object.keys(convertedData));
  // console.log(`📤 Converted data (full):`, JSON.stringify(convertedData, null, 2));

  // Remove null/undefined values that might cause issues (except for required fields)
  const cleanedData: any = { ...convertedData };
  Object.keys(cleanedData).forEach(key => {
    if (cleanedData[key] === undefined) {
      delete cleanedData[key];
    }
  });

  // Ensure ID is present if we're doing an upsert on ID
  if (data.id && !cleanedData.id) {
    cleanedData.id = data.id;
  }

  // QUAN TRỌNG: Bảng phieu_thu_hoc_phi KHÔNG có các cột: subjects, class_id, class_name, class_code, classCode, subject, price_per_session, session_prices, sessions, total_sessions
  // Xóa các field này nếu có (danh sách môn học chi tiết đã được lưu trong phieu_thu_hoc_phi_chi_tiet)
  if (tableName === "phieu_thu_hoc_phi" || tableName === "Phieu_thu_hoc_phi") {
    const fieldsToRemove = ['subjects', 'class_id', 'class_name', 'class_code', 'classCode', 'subject', 'price_per_session', 'session_prices', 'sessions', 'total_sessions'];
    fieldsToRemove.forEach(field => {
      if (cleanedData[field] !== undefined) {
        delete cleanedData[field];
        console.log(`🗑️ Đã xóa field '${field}' khỏi cleanedData vì bảng ${tableName} không có cột này`);
      }
    });
  }

  // If data has id, use upsert; otherwise insert
  const isUpsert = options?.upsert || (data.id !== undefined);

  // Xác định onConflict dựa trên table name
  let onConflict = options?.onConflict || "id";
  if (tableName === "phieu_thu_hoc_phi_chi_tiet") {
    // Bảng chi tiết có constraint unique trên (student_id, class_id, month, year)
    // Nếu có đủ các trường này, sử dụng danh sách các cột cho onConflict
    if (cleanedData.student_id && cleanedData.class_id && cleanedData.month !== undefined && cleanedData.year !== undefined) {
      onConflict = "student_id,class_id,month,year";
    } else if (cleanedData.id) {
      onConflict = "id";
    } else {
      // Nếu không có id và không đủ các trường, vẫn dùng id (sẽ tạo mới)
      onConflict = "id";
    }
  } else if (tableName === "phieu_thu_hoc_phi") {
    // Bảng phieu_thu_hoc_phi có constraint unique trên (student_id, month, year)
    // Nếu có đủ các trường này, sử dụng constraint unique để upsert
    if (cleanedData.student_id && cleanedData.month !== undefined && cleanedData.year !== undefined) {
      onConflict = "student_id,month,year";
    } else if (cleanedData.id) {
      // Fallback: sử dụng id nếu không có đủ student_id, month, year
      onConflict = "id";
    } else {
      // Nếu không có id, vẫn dùng id (sẽ tạo mới với ID tự động)
      onConflict = "id";
    }
  } else if (tableName === "phieu_luong_giao_vien") {
    // Bảng phieu_luong_giao_vien có constraint unique trên (teacher_id, month, year)
    // BẮT BUỘC dùng business key cho onConflict để tránh lỗi 23505 (Duplicate key)
    if (cleanedData.teacher_id && cleanedData.month !== undefined && cleanedData.year !== undefined) {
      onConflict = "teacher_id,month,year";
    } else if (cleanedData.id) {
      onConflict = "id";
    } else {
      onConflict = "id";
    }
  }

  if (isUpsert) {
    console.log(`📤 Attempting to upsert to ${tableName} (Path: ${tablePath}) with onConflict: ${onConflict}...`);
    console.log(`📤 Final cleanedData to Supabase:`, JSON.stringify(cleanedData, null, 2));
    const { data: upsertData, error } = await client
      .from(tableName)
      .upsert(cleanedData, {
        onConflict: onConflict,
      })
      .select();

    if (error) {
      console.error(`❌ Error upserting to ${tableName}:`, error);
      console.error("🔍 Full error object:", JSON.stringify(error, null, 2));
      console.error("Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      console.error("📋 Data that failed:", JSON.stringify(cleanedData, null, 2));

      // Show detailed error message
      let errorMessage = `Lỗi khi lưu vào ${tableName}: ${error.message || "Unknown error"}`;
      if (error.code) {
        errorMessage += ` (Code: ${error.code})`;
      }
      if (error.hint) {
        errorMessage += `\n💡 Gợi ý: ${error.hint}`;
      }
      console.error("🚨 ERROR MESSAGE:", errorMessage);

      // Check for common issues
      if (error.code === "42501") {
        console.error("💡 Có thể là lỗi RLS (Row Level Security). Hãy tắt RLS hoặc thêm policy trong Supabase.");
        console.error("💡 Chạy script: scripts/check_and_fix_rls.sql");
      } else if (error.code === "42P01") {
        console.error("💡 Bảng không tồn tại. Hãy chạy script SQL để tạo bảng.");
        console.error("💡 Chạy script: scripts/setup_student_tables_complete.sql");
      } else if (error.code === "42P10") {
        // Lỗi: không có UNIQUE constraint matching ON CONFLICT
        // Fallback về sử dụng id làm onConflict
        console.warn(`⚠️ Constraint cho onConflict "${onConflict}" không tồn tại. Thử lại với onConflict="id"...`);
        if (onConflict !== "id" && cleanedData.id) {
          // Thử lại với id
          const { data: retryData, error: retryError } = await client
            .from(tableName)
            .upsert(cleanedData, {
              onConflict: "id",
            })
            .select();

          if (retryError) {
            console.error(`❌ Error upserting to ${tableName} (retry with id):`, retryError);
            console.error("📋 Data that failed:", JSON.stringify(cleanedData, null, 2));
            return false;
          }

          console.log(`✅ Successfully upserted to ${tableName} (using id as fallback):`, retryData);
          console.warn(`💡 Để sử dụng onConflict="${onConflict}", hãy chạy script: scripts/add_unique_constraint_to_phieu_thu_hoc_phi.sql`);
          return true;
        } else {
          console.error("💡 Không thể fallback vì không có id. Hãy chạy script SQL để tạo constraint:");
          console.error("💡 Chạy script: scripts/add_unique_constraint_to_phieu_thu_hoc_phi.sql");
        }
      } else if (error.code === "23502") {
        console.error("💡 Thiếu trường bắt buộc (NOT NULL constraint). Kiểm tra lại dữ liệu.");
        console.error("💡 Trường bắt buộc: ho_va_ten (NOT NULL)");
      } else if (error.code === "23514") {
        console.error("💡 Vi phạm constraint (CHECK constraint).");
      }

      // Nếu không phải lỗi 42P10 (đã được xử lý ở trên), return false
      if (error.code !== "42P10") {
        return false;
      }
    }
    console.log(`✅ Successfully upserted to ${tableName}:`, data);
  } else {
    console.log(`📤 Attempting to insert to ${tableName}...`);
    const { data, error } = await client.from(tableName).insert(cleanedData).select();

    if (error) {
      console.error(`❌ Error inserting to ${tableName}:`, error);
      console.error("🔍 Full error object:", JSON.stringify(error, null, 2));
      console.error("Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      console.error("📋 Data that failed:", JSON.stringify(cleanedData, null, 2));

      // Check for common issues
      if (error.code === "42501") {
        console.error("💡 Có thể là lỗi RLS (Row Level Security). Hãy tắt RLS hoặc thêm policy trong Supabase.");
      } else if (error.code === "42P01") {
        console.error("💡 Bảng không tồn tại. Hãy chạy script SQL để tạo bảng Phieu_thu_hoc_phi.");
      } else if (error.code === "23502") {
        console.error("💡 Thiếu trường bắt buộc (NOT NULL constraint). Kiểm tra lại dữ liệu.");
      } else if (error.code === "23514") {
        console.error("💡 Vi phạm constraint (CHECK constraint). Kiểm tra month (0-11), year (>2000), status (paid/unpaid).");
      }

      return false;
    }
    console.log(`✅ Successfully inserted to ${tableName}:`, data);
  }

  return true;
};

/**
 * Update a record (replaces Firebase ref + update)
 */
export const supabaseUpdate = async (
  tablePath: string,
  id: string,
  updates: any
): Promise<boolean> => {
  const client = getClient(true); // Use admin for write operations
  if (!client) {
    console.error("❌ Cannot get Supabase client. Check initialization.");
    return false;
  }

  const tableName = getTableName(tablePath);

  // Clear fetch lock
  fetchLocks.delete(tablePath);
  if (tablePath.includes("/")) {
    fetchLocks.delete(tableName);
  }

  // Convert updates format for Supabase (skip defaults for update operations)
  let convertedUpdates = convertToSupabaseFormat(updates, tableName, true);

  console.log(`🔄 Updating in Supabase table: ${tableName}`, { id, updatesKeys: Object.keys(convertedUpdates) });
  console.log(`🔄 Full converted updates:`, JSON.stringify(convertedUpdates, null, 2));

  // First, check if the record exists
  const { data: existingData, error: checkError } = await client
    .from(tableName)
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (checkError) {
    console.error(`❌ Error checking if record exists in ${tableName}:`, checkError);
    console.error(`   Error code: ${checkError.code}`);
    console.error(`   Error message: ${checkError.message}`);
    console.error(`   Error details: ${checkError.details}`);
    return false;
  }

  // If record doesn't exist, return false (don't upsert with partial data)
  if (!existingData) {
    console.warn(`⚠️ Record with id ${id} doesn't exist in ${tableName}. Cannot update non-existent record.`);
    console.warn(`⚠️ For update operations, the record must already exist in the database.`);
    return false;
  }

  // Record exists, proceed with update
  const { data, error } = await client
    .from(tableName)
    .update(convertedUpdates)
    .eq("id", id)
    .select();

  if (error) {
    console.error(`❌ Error updating ${tableName}:`, error);
    console.error(`   Error code: ${error.code}`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error details: ${error.details}`);
    console.error(`   Error hint: ${error.hint}`);
    console.error("Updates that failed:", JSON.stringify(convertedUpdates, null, 2));

    return false;
  }

  if (!data || data.length === 0) {
    console.warn(`⚠️ Update succeeded but no rows were updated in ${tableName} for id: ${id}`);
    console.warn(`   This might mean the record doesn't exist or the id doesn't match`);
    return false;
  }

  console.log(`✅ Successfully updated ${data.length} row(s) in ${tableName}`, { id, updatedFields: Object.keys(convertedUpdates) });
  return true;
};

/**
 * Update multiple records by filter (e.g. student_id, month, year)
 */
export const supabaseUpdateMany = async (
  tablePath: string,
  filters: Record<string, any>,
  updates: any
): Promise<boolean> => {
  const client = getClient(true);
  if (!client) {
    console.error("❌ Cannot get Supabase client. Check initialization.");
    return false;
  }

  const tableName = getTableName(tablePath);

  // Clear fetch lock
  fetchLocks.delete(tablePath);
  if (tablePath.includes("/")) {
    fetchLocks.delete(tableName);
  }
  
  // Convert updates to snake_case
  const convertedUpdates = convertToSupabaseFormat(updates, tableName, true);

  console.log(`📤 Updating many in ${tableName} with filters:`, filters);
  
  let query = client.from(tableName).update(convertedUpdates);

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { error, data } = await query.select();

  if (error) {
    console.error(`❌ Error updating many in ${tableName}:`, error);
    return false;
  }

  console.log(`✅ Successfully updated ${data?.length || 0} row(s) in ${tableName} by filters`);
  return true;
};

/**
 * Delete a record (replaces Firebase ref + remove)
 */
export const supabaseRemove = async (tablePath: string, id: string): Promise<boolean> => {
  const client = getClient(true); // Use admin for write operations
  const tableName = getTableName(tablePath);

  // Clear fetch lock
  fetchLocks.delete(tablePath);
  if (tablePath.includes("/")) {
    fetchLocks.delete(tableName);
  }

  const { error } = await client
    .from(tableName)
    .delete()
    .eq("id", id);

  if (error) {
    console.error(`❌ Error deleting from ${tableName}:`, error);
    return false;
  }

  console.log(`✅ Successfully deleted from ${tableName}`);
  return true;
};

/**
 * Subscribe to changes (replaces Firebase onValue)
 * Like Firebase onValue: fires immediately with current data, then on every change
 */
export const supabaseOnValue = (
  tablePath: string,
  callback: (data: any) => void
): (() => void) => {
  const tableName = getTableName(tablePath);
  // Use admin for all tables to bypass RLS issues globally during migration
  const useAdmin = true;
  const client = getClient(useAdmin);

  // Keep track of the last data sent to the callback to prevent redundant updates
  let lastDataJson = "";

  // Helper to safely call callback with change detection
  const safeCallback = (data: any) => {
    const currentDataJson = JSON.stringify(data);
    if (currentDataJson !== lastDataJson) {
      lastDataJson = currentDataJson;
      callback(data);
    }
  };

  if (missingTables.has(tableName)) {
    safeCallback({});
    return () => { };
  }

  // Initial fetch - giống Firebase onValue, gọi callback ngay với data hiện tại
  supabaseGetAll(tablePath).then((data) => {
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      console.log(`📡 Initial load from ${tableName}: ${Object.keys(data).length} records`);
      safeCallback(data);
    } else {
      console.log(`📡 Initial load from ${tableName}: no data`);
      safeCallback({});
      if (missingTables.has(tableName)) {
        return;
      }
    }
  }).catch((error) => {
    console.error(`📡 Error initial loading from ${tableName}:`, error);
    safeCallback({});
  });

  if (missingTables.has(tableName)) {
    return () => { };
  }

  // Then subscribe to real-time changes
  let channel: any = null;
  try {
    const realtimeClient = client;

    // Generate a unique channel ID to avoid conflicts when multiple components subscribe to the same table
    const channelId = Math.random().toString(36).substring(2, 10);
    const channelName = `${tableName}_changes_${channelId}`;

    channel = realtimeClient
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
        },
        (payload) => {
          console.log(`📡 [${channelName}] Real-time update:`, payload.eventType);
          // Fetch all data when change occurs - FORCE fresh fetch bypassing cache/locks
          supabaseGetAll(tablePath, true).then((data) => {
            if (data && typeof data === 'object' && Object.keys(data).length > 0) {
              console.log(`📡 [${channelName}] Fetched ${Object.keys(data).length} records`);
              safeCallback(data);
            } else {
              safeCallback({});
            }
          }).catch((error) => {
            console.error(`📡 [${channelName}] Error fetching data:`, error);
            safeCallback({});
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime subscribed to ${tableName} (Channel: ${channelName})`);
        } else if (status === 'CLOSED') {
          console.warn(`⚠️ Realtime subscription closed for ${tableName} (Channel: ${channelName})`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Realtime channel error for ${tableName} (Channel: ${channelName})`);
        }
      });
  } catch (error) {
    console.warn(`⚠️ Realtime subscription failed for ${tableName}:`, error);
  }

  // Return unsubscribe function
  return () => {
    if (channel) {
      client.removeChannel(channel);
    }
  };
};

// Helper to convert Firebase data format to Supabase format
export const convertToSupabaseFormat = (data: any, tableName: string, skipDefaults: boolean = false): any => {
  const converted = { ...data };

  // For phieu_thu_hoc_phi table, convert field names from camelCase to snake_case
  if (tableName === "phieu_thu_hoc_phi" || tableName === "Phieu_thu_hoc_phi") {
    const fieldMapping: Record<string, string> = {
      studentId: "student_id",
      studentName: "student_name",
      studentCode: "student_code",
      classId: "class_id",
      className: "class_name",
      // classCode: "class_code", // Bỏ cột này - không điền vào database nữa
      totalSessions: "total_sessions",
      totalAmount: "total_amount",
      finalAmount: "final_amount",
      pricePerSession: "price_per_session",
      paidAt: "paid_at",
      sessionPrices: "session_prices",
      invoiceImage: "invoice_image",
      firebaseId: "firebase_id",
    };

    // Convert field names
    Object.entries(fieldMapping).forEach(([camelCase, snakeCase]) => {
      if (converted[camelCase] !== undefined) {
        converted[snakeCase] = converted[camelCase];
        delete converted[camelCase];
      }
    });

    // Xóa classCode và class_code khỏi data trước khi lưu (không điền vào database nữa)
    if (converted.class_code !== undefined) delete converted.class_code;
    if (converted.classCode !== undefined) delete converted.classCode;

    // Only add default values if skipDefaults is false (for insert/upsert operations)
    // For update operations, skipDefaults should be true to avoid setting fields to null
    // LƯU Ý: Bảng phieu_thu_hoc_phi KHÔNG có các cột: class_id, class_name, class_code, price_per_session, subject
    // Chỉ xử lý các cột có trong bảng
    if (!skipDefaults) {
      // Ensure required fields have default values if missing (chỉ các cột có trong bảng)
      if (converted.debt === undefined) converted.debt = 0;
    }

    // Ensure numeric fields are numbers, not strings (chỉ các cột có trong bảng)
    // LƯU Ý: Bảng phieu_thu_hoc_phi KHÔNG có cột total_sessions
    if (typeof converted.total_amount === "string") converted.total_amount = parseFloat(converted.total_amount) || 0;
    if (typeof converted.final_amount === "string") converted.final_amount = parseFloat(converted.final_amount) || 0;
    if (typeof converted.discount === "string") converted.discount = parseFloat(converted.discount) || 0;
    if (typeof converted.debt === "string") converted.debt = parseFloat(converted.debt) || 0;
    // QUAN TRỌNG: Month đã là 1-12 từ filter UI, KHÔNG cộng thêm 1
    // Không convert từ 0-11 → 1-12 vì month đã là 1-12 từ filter
    if (converted.month !== undefined && converted.month !== null) {
      if (typeof converted.month === "string") {
        converted.month = parseInt(converted.month) || 1;
      }
      // Đảm bảo month là number và trong khoảng 1-12 (KHÔNG cộng thêm)
      if (typeof converted.month === "number") {
        // KHÔNG cộng 1 - month đã là 1-12 từ filter
        // Chỉ validate và đảm bảo trong khoảng 1-12
        if (converted.month < 1) converted.month = 1;
        if (converted.month > 12) converted.month = 12;
        // Ví dụ: month = 2 (từ filter) → giữ nguyên 2, KHÔNG cộng thành 3
      }
    }

    if (typeof converted.year === "string") converted.year = parseInt(converted.year) || 0;

    // LƯU Ý: Bảng phieu_thu_hoc_phi KHÔNG có cột sessions và session_prices
    // Không xử lý các cột này

    // Đảm bảo field "status" được giữ nguyên (không bị xóa)
    // Status không cần convert vì tên field giống nhau trong cả camelCase và snake_case
    if (converted.status === undefined && data.status !== undefined) {
      converted.status = data.status;
    }
  }

  // For phieu_thu_hoc_phi_chi_tiet table (bảng chi tiết mới)
  if (tableName === "phieu_thu_hoc_phi_chi_tiet" || tableName === "Phieu_thu_hoc_phi_chi_tiet") {
    const fieldMapping: Record<string, string> = {
      studentId: "student_id",
      studentName: "student_name",
      studentCode: "student_code",
      classId: "class_id",
      className: "class_name",
      // classCode: "class_code", // Bỏ cột này - không điền vào database nữa
      totalSessions: "total_sessions",
      totalAmount: "total_amount",
      // finalAmount: "final_amount", // Bỏ cột này vì không tồn tại trong phieu_thu_hoc_phi_chi_tiet
      pricePerSession: "price_per_session",
      paidAt: "paid_at",
      invoiceImage: "invoice_image",
    };

    // Convert field names from camelCase to snake_case
    Object.entries(fieldMapping).forEach(([camelCase, snakeCase]) => {
      if (converted[camelCase] !== undefined) {
        converted[snakeCase] = converted[camelCase];
        delete converted[camelCase];
      }
    });

    // Xóa class_code và classCode khỏi data trước khi lưu (không điền vào database nữa)
    if (converted.class_code !== undefined) delete converted.class_code;
    if (converted.classCode !== undefined) delete converted.classCode;

    // Only add default values if skipDefaults is false
    if (!skipDefaults) {
      if (converted.class_id === undefined) converted.class_id = null;
      if (converted.class_name === undefined) converted.class_name = null;
      // if (converted.class_code === undefined) converted.class_code = null; // Bỏ cột này - không điền vào database nữa
      if (converted.subject === undefined) converted.subject = null;
      if (converted.price_per_session === undefined) converted.price_per_session = 0;
      if (converted.debt === undefined) converted.debt = 0;
      if (converted.notes === undefined) converted.notes = null;
    }

    // Ensure numeric fields are numbers, not strings
    if (typeof converted.total_sessions === "string") converted.total_sessions = parseInt(converted.total_sessions) || 0;
    if (typeof converted.total_amount === "string") converted.total_amount = parseFloat(converted.total_amount) || 0;
    // if (typeof converted.final_amount === "string") converted.final_amount = parseFloat(converted.final_amount) || 0; // Bỏ cột này
    if (typeof converted.discount === "string") converted.discount = parseFloat(converted.discount) || 0;
    if (typeof converted.debt === "string") converted.debt = parseFloat(converted.debt) || 0;
    if (typeof converted.price_per_session === "string") converted.price_per_session = parseFloat(converted.price_per_session) || 0;

    // Xóa final_amount vì không tồn tại trong phieu_thu_hoc_phi_chi_tiet
    if (converted.final_amount !== undefined) delete converted.final_amount;
    if (converted.finalAmount !== undefined) delete converted.finalAmount;

    // QUAN TRỌNG: Month đã là 1-12 từ filter UI, KHÔNG cộng thêm 1
    // Không convert từ 0-11 → 1-12 vì month đã là 1-12 từ filter
    if (converted.month !== undefined && converted.month !== null) {
      if (typeof converted.month === "string") {
        converted.month = parseInt(converted.month) || 1;
      }
      // Đảm bảo month là number và trong khoảng 1-12 (KHÔNG cộng thêm)
      if (typeof converted.month === "number") {
        // KHÔNG cộng 1 - month đã là 1-12 từ filter
        // Chỉ validate và đảm bảo trong khoảng 1-12
        if (converted.month < 1) converted.month = 1;
        if (converted.month > 12) converted.month = 12;
        // Ví dụ: month = 2 (từ filter) → giữ nguyên 2, KHÔNG cộng thành 3
      }
    }

    if (typeof converted.year === "string") converted.year = parseInt(converted.year) || 0;

    // Ensure sessions is properly formatted as JSONB
    if (!skipDefaults) {
      if (converted.sessions && Array.isArray(converted.sessions)) {
        converted.sessions = converted.sessions;
      } else if (!converted.sessions) {
        converted.sessions = [];
      }

      // Ensure metadata is properly formatted
      if (converted.metadata && typeof converted.metadata === "object") {
        converted.metadata = converted.metadata;
      } else if (!converted.metadata) {
        converted.metadata = {};
      }
    }
  }

  // For phieu_luong_giao_vien table
  if (tableName === "phieu_luong_giao_vien" || tableName === "Phieu_luong_giao_vien") {
    const fieldMapping: Record<string, string> = {
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
    };

    Object.entries(fieldMapping).forEach(([camelCase, snakeCase]) => {
      if (converted[camelCase] !== undefined) {
        converted[snakeCase] = converted[camelCase];
        delete converted[camelCase];
      }
    });

    // Ensure numeric fields are numbers
    if (typeof converted.total_sessions === "string") converted.total_sessions = parseInt(converted.total_sessions) || 0;
    if (typeof converted.total_salary === "string") converted.total_salary = parseFloat(converted.total_salary) || 0;
    if (typeof converted.total_allowance === "string") converted.total_allowance = parseFloat(converted.total_allowance) || 0;
    if (typeof converted.salary_per_session === "string") converted.salary_per_session = parseFloat(converted.salary_per_session) || 0;
    if (typeof converted.total_hours === "string") converted.total_hours = parseFloat(converted.total_hours) || 0;
    if (typeof converted.total_minutes === "string") converted.total_minutes = parseFloat(converted.total_minutes) || 0;

    // Handle month and year (Ensure month is 1-12)
    if (converted.month !== undefined && converted.month !== null) {
      const m = parseInt(String(converted.month));
      // If month is 0-11 (from JS Date), convert to 1-12
      // Note: We check if it's less than 12 to be safe, but usually it's 0-11
      if (m >= 0 && m < 12) {
        converted.month = m + 1;
      } else {
        converted.month = m;
      }
    }
    if (typeof converted.year === "string") converted.year = parseInt(converted.year) || 0;
  }

  // For lop_hoc_hoc_sinh table (Chi tiết học sinh trong lớp)
  if (tableName === "lop_hoc_hoc_sinh" || tableName === "Lop_hoc_hoc_sinh") {
    const fieldMapping: Record<string, string> = {
      classId: "class_id",
      studentId: "student_id",
      studentName: "student_name",
      studentCode: "student_code",
      hocPhiRieng: "hoc_phi_rieng",
      enrollmentDate: "enrollment_date",
      createdAt: "created_at",
      updatedAt: "updated_at",
    };

    // Convert field names from camelCase to snake_case
    Object.entries(fieldMapping).forEach(([camelCase, snakeCase]) => {
      if (converted[camelCase] !== undefined) {
        converted[snakeCase] = converted[camelCase];
        delete converted[camelCase];
      }
    });

    // Ensure numeric fields are numbers
    if (typeof converted.hoc_phi_rieng === "string") {
      converted.hoc_phi_rieng = parseFloat(converted.hoc_phi_rieng) || null;
    }

    // Ensure status has default value if not provided
    if (!converted.status) {
      converted.status = "active";
    }
  }

  // For hoc_sinh table (Học sinh)
  if (tableName === "hoc_sinh" || tableName === "Học_sinh" || tableName === "datasheet/Học_sinh") {
    const fieldMapping: Record<string, string> = {
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
      "Mật khẩu": "password",
      "Điểm số": "diem_so",
      "Trạng thái": "trang_thai",
      "Số giờ đã gia hạn": "so_gio_da_gia_han",
      "Số giờ còn lại": "so_gio_con_lai",
      "Số giờ đã học": "so_gio_da_hoc",
      "Ghi chú": "ghi_chu",
    };

    // Convert Firebase field names to Supabase column names
    const metadata: any = {};
    Object.entries(fieldMapping).forEach(([firebaseField, supabaseField]) => {
      if (converted[firebaseField] !== undefined && converted[firebaseField] !== null) {
        let value = converted[firebaseField];

        // Convert empty strings to null for TEXT fields (except ho_va_ten which is NOT NULL)
        if (typeof value === "string" && value === "" && supabaseField !== "ho_va_ten") {
          value = null;
        }

        // Convert numeric fields
        if (["so_gio_da_gia_han", "so_gio_con_lai", "so_gio_da_hoc", "diem_so"].includes(supabaseField)) {
          value = typeof value === "string" ? parseFloat(value) || 0 : (value || 0);
        }

        // Set default for trang_thai
        if (supabaseField === "trang_thai") {
          value = value || "active";
        }

        // Only set if value is not null (or if it's ho_va_ten which is required)
        if (value !== null || supabaseField === "ho_va_ten") {
          converted[supabaseField] = value;
        }
        delete converted[firebaseField];
      }
    });

    // Ensure ho_va_ten is not empty (required field)
    if (!converted.ho_va_ten || converted.ho_va_ten === "") {
      converted.ho_va_ten = "Chưa có tên"; // Default value if empty
    }

    // Store unknown fields in metadata
    // Important: we must NOT move the already converted snake_case fields to metadata
    const supabaseFields = Object.values(fieldMapping);
    Object.keys(converted).forEach((key) => {
      if (!fieldMapping[key] && !supabaseFields.includes(key) && key !== "id" && !key.includes("_") && key !== "createdAt" && key !== "updatedAt") {
        metadata[key] = converted[key];
        delete converted[key];
      }
    });

    if (Object.keys(metadata).length > 0) {
      converted.metadata = metadata;
    }
  }

  // For gia_han table (Extension History)
  if (tableName === "gia_han" || tableName === "Gia_hạn" || tableName === "datasheet/Gia_hạn") {
    const fieldMapping: Record<string, string> = {
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
    };

    const metadata: any = {};
    Object.entries(fieldMapping).forEach(([firebaseField, supabaseField]) => {
      if (converted[firebaseField] !== undefined && converted[firebaseField] !== null) {
        let value = converted[firebaseField];

        // Convert numeric fields
        if (["gio_nhap_them", "old_total", "new_total"].includes(supabaseField)) {
          value = typeof value === "string" ? parseFloat(value) || 0 : (value || 0);
        }

        // Convert date fields
        if (supabaseField === "ngay_nhap" && typeof value === "string") {
          // Keep as date string (YYYY-MM-DD)
          value = value;
        }

        // Convert time fields
        if (supabaseField === "gio_nhap" && typeof value === "string") {
          // Keep as time string (HH:MM:SS)
          value = value;
        }

        converted[supabaseField] = value;
        delete converted[firebaseField];
      }
    });

    // Store unknown fields in metadata
    Object.keys(converted).forEach((key) => {
      if (!fieldMapping[key] && key !== "id" && !key.includes("_") && key !== "Timestamp") {
        metadata[key] = converted[key];
        delete converted[key];
      }
    });

    if (Object.keys(metadata).length > 0) {
      converted.metadata = metadata;
    }
  }

  // For lich_su_sao_thuong table (Stars History)
  if (tableName === "lich_su_sao_thuong" || tableName === "Lịch_sử_sao_thưởng" || tableName === "datasheet/Lịch_sử_sao_thưởng") {
    const fieldMapping: Record<string, string> = {
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
    };

    const metadata: any = {};
    Object.entries(fieldMapping).forEach(([firebaseField, supabaseField]) => {
      if (converted[firebaseField] !== undefined && converted[firebaseField] !== null) {
        let value = converted[firebaseField];

        // Convert numeric fields
        if (["thay_doi", "so_sao_truoc", "so_sao_sau"].includes(supabaseField)) {
          value = typeof value === "string" ? parseFloat(value) || 0 : (value || 0);
        }

        // Convert date fields
        if (supabaseField === "ngay_chinh_sua" && typeof value === "string") {
          value = value;
        }

        // Convert time fields
        if (supabaseField === "gio_chinh_sua" && typeof value === "string") {
          value = value;
        }

        converted[supabaseField] = value;
        delete converted[firebaseField];
      }
    });

    // Store unknown fields in metadata
    Object.keys(converted).forEach((key) => {
      if (!fieldMapping[key] && key !== "id" && !key.includes("_") && key !== "Timestamp") {
        metadata[key] = converted[key];
        delete converted[key];
      }
    });

    if (Object.keys(metadata).length > 0) {
      converted.metadata = metadata;
    }
  }

  // For giao_vien table (Teachers) - convert FROM Supabase
  if (tableName === "giao_vien" || tableName === "Giáo_viên") {
    const fieldMapping: Record<string, string> = {
      ten_giao_vien: "Họ và tên",
      ma_giao_vien: "Mã giáo viên",
      so_dien_thoai: "SĐT",
      email: "Email",
      password: "Password",
      bien_che: "Biên chế",
      vi_tri: "Vị trí",
      ngan_hang: "Ngân hàng",
      stk: "STK",
      dia_chi: "Địa chỉ",
      luong_theo_buoi: "Lương theo buổi",
    };

    Object.entries(fieldMapping).forEach(([supabaseField, firebaseField]) => {
      if (converted[supabaseField] !== undefined) {
        converted[firebaseField] = converted[supabaseField];
      }
    });
  }

  // For lop_hoc table (Lớp học)
  if (tableName === "lop_hoc" || tableName === "Lop_hoc" || tableName === "Lớp_học" || tableName === "datasheet/Lớp_học") {
    const fieldMapping: Record<string, string> = {
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
    };

    Object.entries(fieldMapping).forEach(([camelCase, snakeCase]) => {
      if (converted[camelCase] !== undefined) {
        converted[snakeCase] = converted[camelCase];
        delete converted[camelCase];
      }
    });

    // Ensure numeric fields are numbers
    if (typeof converted.hoc_phi_moi_buoi === "string") converted.hoc_phi_moi_buoi = parseFloat(converted.hoc_phi_moi_buoi) || 0;
    if (typeof converted.luong_gv === "string") converted.luong_gv = parseFloat(converted.luong_gv) || 0;
  }

  // For phong_hoc table (Phòng học)
  if (tableName === "phong_hoc" || tableName === "Phòng_học" || tableName === "datasheet/Phòng_học") {
    const fieldMapping: Record<string, string> = {
      "Tên phòng": "ten_phong",
      "Mã phòng": "ma_phong",
      "Địa điểm": "dia_diem",
      "Sức chứa": "suc_chua",
      "Ghi chú": "ghi_chu",
    };

    const metadata: any = {};
    Object.entries(fieldMapping).forEach(([firebaseField, supabaseField]) => {
      if (converted[firebaseField] !== undefined && converted[firebaseField] !== null) {
        let value = converted[firebaseField];

        // Convert numeric fields
        if (supabaseField === "suc_chua") {
          value = typeof value === "string" ? parseFloat(value) || null : (value || null);
        }

        converted[supabaseField] = value;
        delete converted[firebaseField];
      }
    });

    // Store unknown fields in metadata
    const supabaseFields = Object.values(fieldMapping);
    Object.keys(converted).forEach((key) => {
      if (!fieldMapping[key] && !supabaseFields.includes(key) && key !== "id" && !key.includes("_") && key !== "createdAt" && key !== "updatedAt") {
        metadata[key] = converted[key];
        delete converted[key];
      }
    });

    if (Object.keys(metadata).length > 0) {
      converted.metadata = metadata;
    }
  }

  // For lop_hoc_hoc_sinh table (Chi tiết học sinh trong lớp)
  if (tableName === "lop_hoc_hoc_sinh") {
    const fieldMapping: Record<string, string> = {
      classId: "class_id",
      studentId: "student_id",
      studentName: "student_name",
      studentCode: "student_code",
      hocPhiRieng: "hoc_phi_rieng",
      enrollmentDate: "enrollment_date",
    };

    Object.entries(fieldMapping).forEach(([camelCase, snakeCase]) => {
      if (converted[camelCase] !== undefined) {
        converted[snakeCase] = converted[camelCase];
        delete converted[camelCase];
      }
    });

    if (typeof converted.hoc_phi_rieng === "string") {
      converted.hoc_phi_rieng = parseFloat(converted.hoc_phi_rieng) || 0;
    }
  }

  // For diem_danh_sessions table (Attendance Sessions) - convert TO Supabase
  if (tableName === "diem_danh_sessions" || tableName === "Điểm_danh_sessions") {
    const fieldMapping: Record<string, string> = {
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
    };

    Object.entries(fieldMapping).forEach(([firebaseField, supabaseField]) => {
      if (converted[firebaseField] !== undefined) {
        converted[supabaseField] = converted[firebaseField];
        delete converted[firebaseField];
      }
    });

    // Ensure numeric fields are numbers
    if (typeof converted.hoc_phi_moi_buoi === "string") converted.hoc_phi_moi_buoi = parseFloat(converted.hoc_phi_moi_buoi) || null;
    if (typeof converted.luong_gv === "string") converted.luong_gv = parseFloat(converted.luong_gv) || null;
  }

  // For thoi_khoa_bieu table (Custom Timetable) - convert TO Supabase
  if (tableName === "thoi_khoa_bieu" || tableName === "Thời_khoá_biểu") {
    const fieldMapping: Record<string, string> = {
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
    };

    Object.entries(fieldMapping).forEach(([firebaseField, supabaseField]) => {
      if (converted[firebaseField] !== undefined) {
        converted[supabaseField] = converted[firebaseField];
        delete converted[firebaseField];
      }
    });

    if (typeof converted.thu === "string") converted.thu = parseInt(converted.thu, 10) || null;
    if (typeof converted.thay_the_thu === "string") converted.thay_the_thu = parseInt(converted.thay_the_thu, 10) || null;
  }

  // For diem_tu_nhap table (Custom Scores) - convert TO Supabase
  if (tableName === "diem_tu_nhap" || tableName === "Điểm_tự_nhập") {
    // Convert class_id if using "Class ID"
    if (converted["Class ID"] !== undefined && !converted.class_id) {
      converted.class_id = converted["Class ID"];
      delete converted["Class ID"];
    }
    // Keep columns and scores as JSONB (already in correct format)
  }

  // For giao_vien table (Teachers) - convert TO Supabase
  if (tableName === "giao_vien" || tableName === "Giáo_viên") {
    const fieldMapping: Record<string, string> = {
      "Họ và tên": "ten_giao_vien",
      "Mã giáo viên": "ma_giao_vien",
      "SĐT": "so_dien_thoai",
      "Email": "email",
      "Password": "password",
      "Biên chế": "bien_che",
      "Vị trí": "vi_tri",
      "Ngân hàng": "ngan_hang",
      "STK": "stk",
      "Địa chỉ": "dia_chi",
      "Lương theo buổi": "luong_theo_buoi",
    };

    Object.entries(fieldMapping).forEach(([firebaseField, supabaseField]) => {
      if (converted[firebaseField] !== undefined) {
        converted[supabaseField] = converted[firebaseField];
        delete converted[firebaseField];
      }
    });

    if (typeof converted.luong_theo_buoi === "string") {
      converted.luong_theo_buoi = parseFloat(converted.luong_theo_buoi) || 0;
    }
  }

  return converted;
};
