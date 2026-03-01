# Hướng Dẫn Migration Data Từ Firebase Sang Supabase

## Tổng Quan

Script này sẽ migrate toàn bộ dữ liệu từ Firebase Realtime Database sang Supabase PostgreSQL.

## Các Bảng Được Migrate

1. **hoc_sinh** (Học_sinh, Danh_sách_học_sinh)
2. **lop_hoc** (Lớp_học)
3. **phong_hoc** (Phòng_học)
4. **giao_vien** (Giáo_viên)
5. **diem_danh_sessions** (Điểm_danh_sessions)
6. **thoi_khoa_bieu** (Thời_khoá_biểu)
7. **phieu_thu_hoc_phi** (Phiếu_thu_học_phí)
8. **phieu_luong_giao_vien** (Phiếu_lương_giáo_viên)
9. **gia_han** (Gia_hạn)
10. **lich_su_sao_thuong** (Lịch_sử_sao_thưởng)
11. **diem_tu_nhap** (Điểm_tự_nhập)
12. **khoa_hoc** (Khóa_học)
13. **lich_truc_tung_tam** (Lịch_trực_trung_tâm)
14. **nhan_xet_thang** (Nhận_xét_tháng)

## Yêu Cầu

1. Node.js đã được cài đặt
2. Các bảng Supabase đã được tạo (chạy các script SQL tạo bảng trước)
3. Firebase Database URL và Supabase credentials

## Cài Đặt

```bash
# Cài đặt dependencies (nếu chưa có)
npm install @supabase/supabase-js

# Hoặc nếu dùng yarn
yarn add @supabase/supabase-js
```

## Cấu Hình

Có thể cấu hình qua environment variables hoặc sửa trực tiếp trong file:

```bash
# .env file
FIREBASE_DATABASE_URL=https://your-firebase-database-url.firebasedatabase.app
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

## Chạy Migration

### Option 1: Chạy tất cả bảng

```bash
node scripts/migrate_all_firebase_to_supabase.js
```

### Option 2: Chạy từng bảng riêng lẻ

Sửa file `migrate_all_firebase_to_supabase.js` và comment các bảng không cần migrate.

## Quy Trình Migration

1. **Đọc dữ liệu từ Firebase**: Script sẽ fetch data từ Firebase REST API
2. **Convert format**: Chuyển đổi field names từ Firebase format (tiếng Việt) sang Supabase format (snake_case)
3. **Upsert vào Supabase**: Insert hoặc update records vào Supabase (batch 500 records/lần)
4. **Log kết quả**: Hiển thị số lượng records đã migrate thành công/thất bại

## Xử Lý Lỗi

- Script sẽ tiếp tục migrate các bảng khác nếu một bảng gặp lỗi
- Các lỗi sẽ được log và hiển thị trong summary cuối cùng
- Nếu bảng không tồn tại trong Firebase, script sẽ bỏ qua và tiếp tục

## Lưu Ý

1. **Backup dữ liệu**: Nên backup dữ liệu Supabase trước khi chạy migration
2. **Kiểm tra bảng**: Đảm bảo tất cả bảng đã được tạo trong Supabase
3. **RLS Policies**: Tắt RLS hoặc cấu hình policies phù hợp để cho phép insert/update
4. **Real-time**: Enable real-time replication cho các bảng cần thiết

## Verify Migration

Sau khi migration xong, chạy script verify:

```bash
node scripts/verify_migration.js
```

## Troubleshooting

### Lỗi: Table does not exist
- Chạy các script SQL tạo bảng trước (trong thư mục `scripts/`)

### Lỗi: Permission denied
- Kiểm tra Supabase service key
- Tắt RLS hoặc cấu hình policies

### Lỗi: Connection timeout
- Kiểm tra Firebase Database URL
- Kiểm tra network connection

### Dữ liệu không đầy đủ
- Kiểm tra field mapping trong script
- Kiểm tra metadata field (các field không có mapping sẽ được lưu vào metadata)

## Field Mapping

Mỗi bảng có field mapping riêng từ Firebase format (tiếng Việt) sang Supabase format (snake_case). Xem chi tiết trong file `migrate_all_firebase_to_supabase.js`.

## Support

Nếu gặp vấn đề, kiểm tra:
1. Console logs để xem lỗi chi tiết
2. Supabase dashboard để xem dữ liệu đã được insert chưa
3. Firebase console để verify dữ liệu nguồn
