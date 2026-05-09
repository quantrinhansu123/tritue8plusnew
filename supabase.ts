import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase configuration from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || "";

// Create Supabase client with anon key (for client-side operations)
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'tritue-anon-auth', // Tránh xung đột instance
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  }
});

// Create Supabase client with service key (for admin operations)
// WARNING: This is dangerous in a frontend app. Disable auth persistence to avoid instance conflicts.
export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    storageKey: 'tritue-admin-auth', // Tránh xung đột instance
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  }
});

// Helper to get table name mapping (Firebase path -> Supabase table name)
export const getTableName = (firebasePath: string): string => {
  const tableMapping: Record<string, string> = {
    "datasheet/Phiếu_thu_học_phí": "phieu_thu_hoc_phi", // lowercase to match database (bảng cũ, giữ lại để tương thích)
    "datasheet/Phiếu_thu_học_phí_chi_tiết": "phieu_thu_hoc_phi_chi_tiet", // Bảng chi tiết mới - lưu từng môn học
    "datasheet/Điểm_danh": "diem_danh",
    "datasheet/Điểm_danh_sessions": "diem_danh_sessions", // Sessions table
    "datasheet/Học_sinh": "hoc_sinh",
    "datasheet/Lớp_học": "lop_hoc",
    "datasheet/Lớp_học/Học_sinh": "lop_hoc_hoc_sinh", // Chi tiết danh sách học sinh trong lớp
    "datasheet/Khóa_học": "khoa_hoc",
    "datasheet/Giáo_viên": "giao_vien",
    "datasheet/Phiếu_lương_giáo_viên": "phieu_luong_giao_vien",
    "datasheet/Phòng_học": "phong_hoc", // Phòng học table
    "datasheet/Gia_hạn": "gia_han", // Extension History
    "datasheet/Lịch_sử_sao_thưởng": "lich_su_sao_thuong", // Stars History
    "datasheet/Điểm_tự_nhập": "diem_tu_nhap", // Custom Scores
    "datasheet/Danh_sách_học_sinh": "hoc_sinh", // Alias for Học_sinh
    "datasheet/Thời_khoá_biểu": "thoi_khoa_bieu", // Timetable
    "datasheet/Lịch_trực_trung_tâm": "lich_truc_trung_tam", // Lịch trực trung tâm
  };

  // Try exact match first
  if (tableMapping[firebasePath]) {
    return tableMapping[firebasePath];
  }

  // If path contains an ID (e.g., "datasheet/Học_sinh/-OgBnlEHOk4DQEkPfRdU")
  // Extract the table name part (before the ID)
  const parts = firebasePath.split("/");

  // Check if last part looks like an ID
  const lastPart = parts[parts.length - 1];
  
  // An ID is likely if:
  // 1. It starts with '-' (Firebase style)
  // 2. It's long (> 15 chars)
  // 3. The path starts with 'datasheet/' and has 3+ parts (e.g., datasheet/Học_sinh/ID)
  const isId = lastPart.startsWith("-") || 
               lastPart.length > 15 || 
               (parts[0] === "datasheet" && parts.length >= 3);

  // Try to extract table name from path
  const tableName = isId ? parts[parts.length - 2] : lastPart;

  // Convert Vietnamese to non-accented and lowercase
  return tableName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "_")
    .toLowerCase();
};

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabase !== null && SUPABASE_URL.length > 0;
};
