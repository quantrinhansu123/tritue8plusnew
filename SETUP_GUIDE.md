# 🛠️ SETUP & CONFIGURATION GUIDE

## ⚙️ CÁCH SETUP `.env.local`

### 1️⃣ Tạo file `.env.local`

```bash
# Tại root dự án (cùng level với package.json)
# Copy nội dung từ .env.example:
cp .env.example .env.local
```

### 2️⃣ Điền Supabase Credentials

**Tìm thông tin:**
1. Đăng nhập vào [Supabase](https://supabase.com)
2. Chọn project `Trí Tuệ 8+`
3. Vào **Settings → API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role secret** → `VITE_SUPABASE_SERVICE_KEY`

### 3️⃣ Điền Firebase Credentials (Nếu cần)

**Nếu vẫn dùng Firebase:**
1. Đăng nhập vào [Firebase Console](https://console.firebase.google.com)
2. Vào project settings
3. Copy các giá trị từ config object

---

## 🔐 SECURITY WARNINGS

❌ **KHÔNG BỎ HARDCODE:**
- **Service Key**: Có toàn quyền database, KHÔNG share công khai

✅ **LÀM ĐÚNG:**
- Lưu credential trong `.env.local`
- Add `.env.local` vào `.gitignore` (đã có)
- Share `.env.example` (không có values)

---

## 📂 FILE STRUCTURE

```
tritue8plusnew/
├── .env.example          ← Template (commit vào git)
├── .env.local            ← Actual credentials (KHÔNG commit)
├── supabase.ts           ← Config đã update dùng import.meta.env
├── DATABASE_SCHEMA.md    ← This file - Mô tả tất cả bảng
└── scripts/
    ├── create_*.sql      ← SQL scripts tạo bảng
    └── migrate_*.js      ← Migration scripts
```

---

## ✅ VERIFY SETUP

```bash
# Kiểm tra .env.local đã có giá trị
cat .env.local

# Start dev server
npm run dev

# Kiểm tra console, không nên có error về Supabase config
```

---

## 📊 DATABASE TABLES - QUICK REFERENCE

| Bảng | Mục đích | Bản ghi |
|------|---------|--------|
| `hoc_sinh` | Thông tin học sinh | ~500-1000 HS |
| `lop_hoc` | Thông tin lớp học | ~50-100 lớp |
| `phieu_thu_hoc_phi_chi_tiet` | Phiếu thu (theo môn/tháng) | ~5000+ records |
| `lop_hoc_hoc_sinh` | HS trong lớp (junction) | ~2000-5000 |
| `gia_han` | Lịch sử gia hạn giờ | History |
| `lich_su_sao_thuong` | Lịch sử sao thưởng | History |
| `thoi_khoa_bieu` | Timetable lớp | ~100-200 |
| `diem_danh_sessions` | Sessions điểm danh | History |

---

## 🐛 TROUBLESHOOTING

### Error: "Supabase client is not initialized"
```
→ Check .env.local có VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
→ Restart dev server sau khi thêm .env.local
```

### Error: "Permission denied" trên database
```
→ RLS có thể bật
→ Tắt RLS hoặc setup policies
→ Xem scripts/disable_rls.sql
```

### Error: "Table does not exist"
```
→ Chạy SQL scripts trong Supabase SQL Editor
→ scripts/setup_student_tables_complete.sql
```

---

## 📞 CONTACTS

- **Supabase URL**: https://mldlabfnewfgygpadfka.supabase.co
- **Database**: PostgreSQL 15+
- **Realtime**: Enabled
- **Auth**: Firebase (Optional)

