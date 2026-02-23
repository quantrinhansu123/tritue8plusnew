import React, { useState } from "react";
import { Button, Card, Progress, message, Space, Typography, Divider, Alert } from "antd";
import { DatabaseOutlined, CheckCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { ref, get } from "firebase/database";
import { database } from "@/firebase";
import { supabaseSet, supabaseGetAll } from "@/utils/supabaseHelpers";
import WrapperContent from "@/components/WrapperContent";

const { Title, Text } = Typography;

interface MigrationProgress {
  students: { total: number; migrated: number };
  classes: { total: number; migrated: number };
  sessions: { total: number; migrated: number };
  customScores: { total: number; migrated: number };
}

const ReportMigrationPage = () => {
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress>({
    students: { total: 0, migrated: 0 },
    classes: { total: 0, migrated: 0 },
    sessions: { total: 0, migrated: 0 },
    customScores: { total: 0, migrated: 0 },
  });

  // Migrate students
  const migrateStudents = async () => {
    try {
      const studentsRef = ref(database, "datasheet/Danh_sách_học_sinh");
      const snapshot = await get(studentsRef);
      const data = snapshot.val();

      if (!data) {
        message.warning("Không có dữ liệu học sinh trong Firebase");
        return;
      }

      const students = Object.entries(data).map(([id, value]) => ({ id, ...(value as any) }));
      setProgress((prev) => ({ ...prev, students: { total: students.length, migrated: 0 } }));

      let migrated = 0;
      for (const student of students) {
        try {
          // Convert to Supabase format
          const supabaseData = {
            id: student.id,
            ho_va_ten: student["Họ và tên"] || "",
            ma_hoc_sinh: student["Mã học sinh"] || null,
            ngay_sinh: student["Ngày sinh"] || null,
            gioi_tinh: student["Giới tính"] || null,
            so_dien_thoai: student["Số điện thoại"] || null,
            sdt_phu_huynh: student["SĐT phụ huynh"] || null,
            ho_ten_phu_huynh: student["Họ tên phụ huynh"] || student["Phụ huynh"] || null,
            dia_chi: student["Địa chỉ"] || null,
            truong: student["Trường"] || null,
            khoi: student["Khối"] || null,
            email: student["Email"] || null,
            username: student["Username"] || null,
            password: student["Password"] || null,
            diem_so: student["Điểm số"] || null,
            trang_thai: student["Trạng thái"] || null,
            so_gio_da_gia_han: student["Số giờ đã gia hạn"] || null,
            so_gio_con_lai: student["Số giờ còn lại"] || null,
            so_gio_da_hoc: student["Số giờ đã học"] || null,
            ghi_chu: student["Ghi chú"] || null,
          };

          await supabaseSet("datasheet/Học_sinh", supabaseData, { upsert: true, onConflict: "id" });
          migrated++;
          setProgress((prev) => ({
            ...prev,
            students: { ...prev.students, migrated },
          }));
        } catch (error: any) {
          console.error(`Error migrating student ${student.id}:`, error);
        }
      }

      message.success(`Đã chuyển ${migrated}/${students.length} học sinh sang Supabase`);
    } catch (error: any) {
      console.error("Error migrating students:", error);
      message.error(`Lỗi khi chuyển học sinh: ${error.message}`);
    }
  };

  // Migrate classes
  const migrateClasses = async () => {
    try {
      const classesRef = ref(database, "datasheet/Lớp_học");
      const snapshot = await get(classesRef);
      const data = snapshot.val();

      if (!data) {
        message.warning("Không có dữ liệu lớp học trong Firebase");
        return;
      }

      const classes = Object.entries(data).map(([id, value]) => ({ id, ...(value as any) }));
      setProgress((prev) => ({ ...prev, classes: { total: classes.length, migrated: 0 } }));

      let migrated = 0;
      for (const classData of classes) {
        try {
          const supabaseData = {
            id: classData.id,
            ten_lop: classData["Tên lớp"] || "",
            ma_lop: classData["Mã lớp"] || null,
            mon_hoc: classData["Môn học"] || null,
            khoi: classData["Khối"] || null,
            giao_vien_chu_nhiem: classData["Giáo viên chủ nhiệm"] || null,
            teacher_id: classData["Teacher ID"] || null,
            phong_hoc: classData["Phòng học"] || null,
            luong_gv: classData["Lương GV"] || null,
            hoc_phi_moi_buoi: classData["Học phí mỗi buổi"] || null,
            ghi_chu: classData["Ghi chú"] || null,
            trang_thai: classData["Trạng thái"] || null,
            ngay_tao: classData["Ngày tạo"] || null,
            nguoi_tao: classData["Người tạo"] || null,
            lich_hoc: classData["Lịch học"] || null,
            hoc_sinh: classData["Học sinh"] || null,
            student_ids: classData["Student IDs"] || null,
            student_enrollments: classData["Student Enrollments"] || null,
            ngay_bat_dau: classData["Ngày bắt đầu"] || null,
            ngay_ket_thuc: classData["Ngày kết thúc"] || null,
            tai_lieu: classData["Tài liệu"] || null,
            dia_diem: classData["Địa điểm"] || null,
          };

          await supabaseSet("datasheet/Lớp_học", supabaseData, { upsert: true, onConflict: "id" });
          migrated++;
          setProgress((prev) => ({
            ...prev,
            classes: { ...prev.classes, migrated },
          }));
        } catch (error: any) {
          console.error(`Error migrating class ${classData.id}:`, error);
        }
      }

      message.success(`Đã chuyển ${migrated}/${classes.length} lớp học sang Supabase`);
    } catch (error: any) {
      console.error("Error migrating classes:", error);
      message.error(`Lỗi khi chuyển lớp học: ${error.message}`);
    }
  };

  // Migrate attendance sessions
  const migrateSessions = async () => {
    try {
      const sessionsRef = ref(database, "datasheet/Điểm_danh_sessions");
      const snapshot = await get(sessionsRef);
      const data = snapshot.val();

      if (!data) {
        message.warning("Không có dữ liệu sessions trong Firebase");
        return;
      }

      const sessions = Object.entries(data).map(([id, value]) => ({ id, ...(value as any) }));
      setProgress((prev) => ({ ...prev, sessions: { total: sessions.length, migrated: 0 } }));

      let migrated = 0;
      for (const session of sessions) {
        try {
          const supabaseData = {
            id: session.id,
            ma_lop: session["Mã lớp"] || null,
            ten_lop: session["Tên lớp"] || null,
            class_id: session["Class ID"] || null,
            ngay: session["Ngày"] || null,
            gio_bat_dau: session["Giờ bắt đầu"] || null,
            gio_ket_thuc: session["Giờ kết thúc"] || null,
            giao_vien: session["Giáo viên"] || null,
            teacher_id: session["Teacher ID"] || null,
            trang_thai: session["Trạng thái"] || null,
            diem_danh: session["Điểm danh"] || null,
            thoi_gian_diem_danh: session["Thời gian điểm danh"] || null,
            nguoi_diem_danh: session["Người điểm danh"] || null,
            thoi_gian_hoan_thanh: session["Thời gian hoàn thành"] || null,
            nguoi_hoan_thanh: session["Người hoàn thành"] || null,
            noi_dung_buoi_hoc: session["Nội dung buổi học"] || null,
            tai_lieu_noi_dung: session["Tài liệu nội dung"] || null,
            bai_tap: session["Bài tập"] || null,
            timestamp: session["Timestamp"] || null,
            hoc_phi_moi_buoi: session["Học phí mỗi buổi"] || null,
            luong_gv: session["Lương GV"] || null,
          };

          await supabaseSet("datasheet/Điểm_danh_sessions", supabaseData, { upsert: true, onConflict: "id" });
          migrated++;
          setProgress((prev) => ({
            ...prev,
            sessions: { ...prev.sessions, migrated },
          }));
        } catch (error: any) {
          console.error(`Error migrating session ${session.id}:`, error);
        }
      }

      message.success(`Đã chuyển ${migrated}/${sessions.length} sessions sang Supabase`);
    } catch (error: any) {
      console.error("Error migrating sessions:", error);
      message.error(`Lỗi khi chuyển sessions: ${error.message}`);
    }
  };

  // Migrate custom scores
  const migrateCustomScores = async () => {
    try {
      const scoresRef = ref(database, "datasheet/Điểm_tự_nhập");
      const snapshot = await get(scoresRef);
      const data = snapshot.val();

      if (!data) {
        message.warning("Không có dữ liệu điểm tự nhập trong Firebase");
        return;
      }

      // Điểm_tự_nhập có cấu trúc: { [classId]: { columns: [], scores: [] } }
      const classIds = Object.keys(data);
      setProgress((prev) => ({ ...prev, customScores: { total: classIds.length, migrated: 0 } }));

      let migrated = 0;
      for (const classId of classIds) {
        try {
          const classScores = data[classId];
          const supabaseData = {
            id: classId,
            class_id: classId,
            columns: classScores.columns || [],
            scores: classScores.scores || [],
          };

          await supabaseSet("datasheet/Điểm_tự_nhập", supabaseData, { upsert: true, onConflict: "id" });
          migrated++;
          setProgress((prev) => ({
            ...prev,
            customScores: { ...prev.customScores, migrated },
          }));
        } catch (error: any) {
          console.error(`Error migrating custom scores for class ${classId}:`, error);
        }
      }

      message.success(`Đã chuyển ${migrated}/${classIds.length} điểm tự nhập sang Supabase`);
    } catch (error: any) {
      console.error("Error migrating custom scores:", error);
      message.error(`Lỗi khi chuyển điểm tự nhập: ${error.message}`);
    }
  };

  // Migrate all
  const migrateAll = async () => {
    setMigrating(true);
    setProgress({
      students: { total: 0, migrated: 0 },
      classes: { total: 0, migrated: 0 },
      sessions: { total: 0, migrated: 0 },
      customScores: { total: 0, migrated: 0 },
    });

    try {
      await migrateStudents();
      await migrateClasses();
      await migrateSessions();
      await migrateCustomScores();
      message.success("✅ Hoàn thành chuyển đổi tất cả dữ liệu!");
    } catch (error: any) {
      message.error(`Lỗi: ${error.message}`);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <WrapperContent title="Chuyển Dữ Liệu Báo Cáo Học Tập">
      <Card>
        <Title level={2}>
          <DatabaseOutlined /> Chuyển Dữ Liệu Báo Cáo Học Tập
        </Title>
        <Alert
          message="Công cụ Migration"
          description="Chuyển dữ liệu từ Firebase sang Supabase cho báo cáo học tập. Dữ liệu sẽ được upsert (cập nhật nếu đã tồn tại)."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* Students */}
          <Card>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>Học sinh (Danh_sách_học_sinh)</Text>
              <Progress
                percent={
                  progress.students.total > 0
                    ? Math.round((progress.students.migrated / progress.students.total) * 100)
                    : 0
                }
                status={progress.students.migrated === progress.students.total && progress.students.total > 0 ? "success" : "active"}
                format={() => `${progress.students.migrated}/${progress.students.total}`}
              />
              <Button
                onClick={migrateStudents}
                disabled={migrating}
                icon={<DatabaseOutlined />}
              >
                Chuyển Học Sinh
              </Button>
            </Space>
          </Card>

          {/* Classes */}
          <Card>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>Lớp học (Lớp_học)</Text>
              <Progress
                percent={
                  progress.classes.total > 0
                    ? Math.round((progress.classes.migrated / progress.classes.total) * 100)
                    : 0
                }
                status={progress.classes.migrated === progress.classes.total && progress.classes.total > 0 ? "success" : "active"}
                format={() => `${progress.classes.migrated}/${progress.classes.total}`}
              />
              <Button
                onClick={migrateClasses}
                disabled={migrating}
                icon={<DatabaseOutlined />}
              >
                Chuyển Lớp Học
              </Button>
            </Space>
          </Card>

          {/* Sessions */}
          <Card>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>Sessions Điểm Danh (Điểm_danh_sessions)</Text>
              <Progress
                percent={
                  progress.sessions.total > 0
                    ? Math.round((progress.sessions.migrated / progress.sessions.total) * 100)
                    : 0
                }
                status={progress.sessions.migrated === progress.sessions.total && progress.sessions.total > 0 ? "success" : "active"}
                format={() => `${progress.sessions.migrated}/${progress.sessions.total}`}
              />
              <Button
                onClick={migrateSessions}
                disabled={migrating}
                icon={<DatabaseOutlined />}
              >
                Chuyển Sessions
              </Button>
            </Space>
          </Card>

          {/* Custom Scores */}
          <Card>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>Điểm Tự Nhập (Điểm_tự_nhập)</Text>
              <Progress
                percent={
                  progress.customScores.total > 0
                    ? Math.round((progress.customScores.migrated / progress.customScores.total) * 100)
                    : 0
                }
                status={progress.customScores.migrated === progress.customScores.total && progress.customScores.total > 0 ? "success" : "active"}
                format={() => `${progress.customScores.migrated}/${progress.customScores.total}`}
              />
              <Button
                onClick={migrateCustomScores}
                disabled={migrating}
                icon={<DatabaseOutlined />}
              >
                Chuyển Điểm Tự Nhập
              </Button>
            </Space>
          </Card>

          <Divider />

          {/* Migrate All */}
          <Button
            type="primary"
            size="large"
            onClick={migrateAll}
            disabled={migrating}
            icon={<ReloadOutlined />}
            block
          >
            Chuyển Tất Cả Dữ Liệu
          </Button>
        </Space>
      </Card>
    </WrapperContent>
  );
};

export default ReportMigrationPage;
