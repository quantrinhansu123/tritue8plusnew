import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase configuration
const SUPABASE_URL = "https://mldlabfnewfgygpadfka.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGxhYmZuZXdmZ3lncGFkZmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNjc0NzcsImV4cCI6MjA4NjY0MzQ3N30.8ifnsiZvRxeTQ6DUyXegy5uHXMPAKhlPV6Y6zeUBROI";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGxhYmZuZXdmZ3lncGFkZmthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA2NzQ3NywiZXhwIjoyMDg2NjQzNDc3fQ.x9xGSJ5Y4xBOfdJpcG_EQ_If4Bi21SX5WNNCPWJyGS0";

// Create Supabase client with anon key (for client-side operations)
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create Supabase client with service key (for admin operations)
export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
  };

  // Try exact match first
  if (tableMapping[firebasePath]) {
    return tableMapping[firebasePath];
  }

  // If path contains an ID (e.g., "datasheet/Học_sinh/-OgBnlEHOk4DQEkPfRdU")
  // Extract the table name part (before the ID)
  const parts = firebasePath.split("/");
  
  // Check if last part looks like an ID (starts with - or is a long alphanumeric string)
  const lastPart = parts[parts.length - 1];
  const isId = lastPart.startsWith("-") || lastPart.length > 20 || /^[a-zA-Z0-9_-]{20,}$/.test(lastPart);
  
  if (isId && parts.length >= 2) {
    // Remove the ID part and try to match the table path
    const tablePath = parts.slice(0, -1).join("/");
    if (tableMapping[tablePath]) {
      return tableMapping[tablePath];
    }
  }

  // Try to extract table name from path (use second-to-last if last looks like ID)
  const tableName = isId && parts.length >= 2 ? parts[parts.length - 2] : lastPart;
  
  // Convert Vietnamese to non-accented and lowercase
  return tableName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
};

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabase !== null && SUPABASE_URL.length > 0;
};
