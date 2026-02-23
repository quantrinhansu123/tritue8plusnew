# Hướng dẫn chuyển toàn bộ database học sinh sang Supabase

## Cách 1: Sử dụng nút đồng bộ trong UI (Khuyến nghị)

1. **Tạo bảng trong Supabase trước:**
   - Mở Supabase Dashboard: https://supabase.com/dashboard/project/mldlabfnewfgygpadfka/sql/new
   - Copy và chạy nội dung file `scripts/create_hoc_sinh_table.sql`
   - Hoặc chạy lệnh: `npm run sql:run create_hoc_sinh_table.sql` (nếu có connection string)

2. **Đồng bộ dữ liệu:**
   - Mở ứng dụng và đăng nhập
   - Vào trang **"Quản lý học sinh"** (Student List)
   - Click nút **"Đồng bộ sang Supabase"** ở toolbar phía trên
   - Hệ thống sẽ tự động:
     - Đọc tất cả học sinh từ Firebase
     - Chuyển đổi format
     - Ghi vào Supabase bảng `hoc_sinh`
   - Xem kết quả trong thông báo

## Cách 2: Chạy script migrate (Cần Firebase authentication)

Nếu muốn chạy script trực tiếp, bạn cần:

1. **Cập nhật Firebase URL trong script:**
   - Mở file `scripts/migrate_hoc_sinh_to_supabase.js`
   - Tìm dòng `POSSIBLE_FIREBASE_URLS` và thêm URL Firebase của bạn
   - Hoặc set environment variable: `FIREBASE_DATABASE_URL=your-url`

2. **Chạy script:**
   ```bash
   node scripts/migrate_hoc_sinh_to_supabase.js
   ```

## Lưu ý:

- Script sẽ tự động:
  - Insert học sinh mới
  - Update học sinh đã tồn tại (dựa trên ID)
  - Lưu các trường không map vào `metadata` (JSONB)
  
- Sau khi migrate, bạn có thể:
  - Sử dụng Supabase để query học sinh
  - Cập nhật code để đọc từ Supabase thay vì Firebase
  - Giữ Firebase làm backup

## Kiểm tra kết quả:

Sau khi migrate, kiểm tra trong Supabase:
```sql
SELECT COUNT(*) FROM public.hoc_sinh;
SELECT * FROM public.hoc_sinh LIMIT 10;
```
