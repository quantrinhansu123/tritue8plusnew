import { createClient } from "@supabase/supabase-js";

const FIREBASE_DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  process.env.VITE_FIREBASE_DATABASE_URL ||
  "https://upedu2-5df07-default-rtdb.asia-southeast1.firebasedatabase.app";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  "https://mldlabfnewfgygpadfka.supabase.co";

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGxhYmZuZXdmZ3lncGFkZmthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA2NzQ3NywiZXhwIjoyMDg2NjQzNDc3fQ.x9xGSJ5Y4xBOfdJpcG_EQ_If4Bi21SX5WNNCPWJyGS0";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const nodeUrl = (nodeName) =>
  `${FIREBASE_DATABASE_URL}/datasheet/${encodeURIComponent(nodeName)}.json`;

const fetchFirebaseNode = async (nodeName) => {
  const response = await fetch(nodeUrl(nodeName));
  if (!response.ok) {
    throw new Error(`Fetch Firebase node ${nodeName} failed: ${response.status}`);
  }
  return response.json();
};

const chunk = (items, size = 500) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const mapSession = (id, session) => ({
  id,
  ma_lop: session?.["Mã lớp"] ?? null,
  ten_lop: session?.["Tên lớp"] ?? null,
  class_id: session?.["Class ID"] ?? null,
  ngay: session?.["Ngày"] ?? null,
  gio_bat_dau: session?.["Giờ bắt đầu"] ?? null,
  gio_ket_thuc: session?.["Giờ kết thúc"] ?? null,
  giao_vien: session?.["Giáo viên"] ?? null,
  teacher_id: session?.["Teacher ID"] ?? null,
  trang_thai: session?.["Trạng thái"] ?? null,
  diem_danh: session?.["Điểm danh"] ?? null,
  thoi_gian_diem_danh: session?.["Thời gian điểm danh"] ?? null,
  nguoi_diem_danh: session?.["Người điểm danh"] ?? null,
  thoi_gian_hoan_thanh: session?.["Thời gian hoàn thành"] ?? null,
  nguoi_hoan_thanh: session?.["Người hoàn thành"] ?? null,
  noi_dung_buoi_hoc: session?.["Nội dung buổi học"] ?? null,
  tai_lieu_noi_dung: session?.["Tài liệu nội dung"] ?? null,
  bai_tap: session?.["Bài tập"] ?? null,
  timestamp: session?.["Timestamp"] ?? null,
  hoc_phi_moi_buoi:
    session?.["Học phí mỗi buổi"] !== undefined && session?.["Học phí mỗi buổi"] !== null
      ? Number(session["Học phí mỗi buổi"]) || 0
      : null,
  luong_gv:
    session?.["Lương GV"] !== undefined && session?.["Lương GV"] !== null
      ? Number(session["Lương GV"]) || 0
      : null,
});

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  // Try to parse various date formats
  // YYYY-MM-DD (ISO format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + "T00:00:00Z");
    if (!isNaN(d.getTime())) return dateStr;
  }
  
  // DD/MM/YYYY
  const ddmmyyyyMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return `${year}-${month}-${day}`;
  }
  
  // YY-MM-DD (2-digit year) - convert to 4-digit
  const yymmddMatch = /^(\d{2})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (yymmddMatch) {
    const [, year, month, day] = yymmddMatch;
    const fullYear = parseInt(year) > 30 ? `19${year}` : `20${year}`;
    return `${fullYear}-${month}-${day}`;
  }
  
  // If could not parse, return null
  return null;
};

const mapTimetableEntry = (id, entry) => ({
  id,
  class_id: entry?.["Class ID"] ?? null,
  ma_lop: entry?.["Mã lớp"] ?? null,
  ten_lop: entry?.["Tên lớp"] ?? null,
  ngay: parseDate(entry?.["Ngày"]),
  thu:
    entry?.["Thứ"] !== undefined && entry?.["Thứ"] !== null
      ? Number(entry["Thứ"]) || null
      : null,
  gio_bat_dau: entry?.["Giờ bắt đầu"] ?? null,
  gio_ket_thuc: entry?.["Giờ kết thúc"] ?? null,
  phong_hoc: entry?.["Phòng học"] ?? null,
  ghi_chu: entry?.["Ghi chú"] ?? null,
  thay_the_ngay: parseDate(entry?.["Thay thế ngày"]),
  thay_the_thu:
    entry?.["Thay thế thứ"] !== undefined && entry?.["Thay thế thứ"] !== null
      ? Number(entry["Thay thế thứ"]) || null
      : null,
  teacher_id: entry?.["Teacher ID"] ?? null,
  giao_vien: entry?.["Giáo viên"] ?? null,
  timestamp: entry?.["Timestamp"] ?? null,
});

const upsertMany = async (tableName, rows) => {
  if (rows.length === 0) {
    return { total: 0, succeeded: 0 };
  }

  let succeeded = 0;
  const groups = chunk(rows, 500);

  for (const batch of groups) {
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: "id" });

    if (error) {
      throw new Error(`Upsert ${tableName} failed: ${error.message}`);
    }

    succeeded += batch.length;
    console.log(`✅ ${tableName}: ${succeeded}/${rows.length}`);
  }

  return { total: rows.length, succeeded };
};

const run = async () => {
  console.log("🚀 Start migration Firebase -> Supabase");
  console.log(`Firebase: ${FIREBASE_DATABASE_URL}`);
  console.log(`Supabase: ${SUPABASE_URL}`);

  const sessionsData = (await fetchFirebaseNode("Điểm_danh_sessions")) || {};
  const sessions = Object.entries(sessionsData).map(([id, value]) => mapSession(id, value));

  const timetableData = (await fetchFirebaseNode("Thời_khoá_biểu")) || {};
  const timetable = Object.entries(timetableData).map(([id, value]) =>
    mapTimetableEntry(id, value)
  );

  const sessionsResult = await upsertMany("diem_danh_sessions", sessions);
  const timetableResult = await upsertMany("thoi_khoa_bieu", timetable);

  console.log("\n🎉 Migration complete");
  console.log(
    `- diem_danh_sessions: ${sessionsResult.succeeded}/${sessionsResult.total}`
  );
  console.log(`- thoi_khoa_bieu: ${timetableResult.succeeded}/${timetableResult.total}`);
};

run().catch((error) => {
  console.error("❌ Migration failed:", error.message);
  process.exit(1);
});
