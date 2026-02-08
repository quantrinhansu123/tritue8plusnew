import { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Table,
  Space,
  message,
  DatePicker,
  Popconfirm,
  Card,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, PrinterOutlined } from "@ant-design/icons";
import { ref, update, get } from "firebase/database";
import { database } from "../firebase";
import { AttendanceSession, ScoreDetail } from "../types";
import dayjs from "dayjs";

interface ScoreDetailModalProps {
  visible: boolean;
  onClose: () => void;
  session: AttendanceSession | null;
  studentId: string;
  studentName: string;
}

const ScoreDetailModal = ({
  visible,
  onClose,
  session,
  studentId,
  studentName,
}: ScoreDetailModalProps) => {
  const [form] = Form.useForm();
  const [scores, setScores] = useState<ScoreDetail[]>([]);
  const [editingScore, setEditingScore] = useState<ScoreDetail | null>(null);

  useEffect(() => {
    if (session && studentId) {
      const studentRecord = session["Điểm danh"]?.find(
        (r) => r["Student ID"] === studentId
      );
      
      // Get manually added scores from CURRENT SESSION ONLY
      // Only show scores that belong to this specific session/class
      const manualScores = studentRecord?.["Chi tiết điểm"] || [];
      
      // Filter and add sessionId/classId to scores from current session
      // Only include scores that either:
      // 1. Don't have Session ID (old data, assume belongs to current session)
      // 2. Have Session ID matching current session
      const manualScoresWithSession = manualScores
        .filter((score: ScoreDetail) => {
          // If score has Session ID, only include if it matches current session
          if (score["Session ID"]) {
            return score["Session ID"] === session.id;
          }
          // If no Session ID, assume it belongs to current session (old data)
          return true;
        })
        .map((score: ScoreDetail) => ({
          ...score,
          "Session ID": score["Session ID"] || session.id,
          "Class ID": score["Class ID"] || session["Class ID"],
        }));
      
      // Get test score from current session only (if exists)
      const currentSessionTestScore: ScoreDetail[] = [];
      if (studentRecord && studentRecord["Bài kiểm tra"] && studentRecord["Điểm kiểm tra"] != null) {
        currentSessionTestScore.push({
          "Tên điểm": studentRecord["Bài kiểm tra"],
          "Điểm": studentRecord["Điểm kiểm tra"],
          "Ngày": session["Ngày"],
          "Ghi chú": `Từ buổi học: ${session["Tên lớp"]} - ${dayjs(session["Ngày"]).format("DD/MM/YYYY")}`,
          "Session ID": session.id,
          "Class ID": session["Class ID"],
        });
      }
      
      // Only show scores from current session
      const combinedScores = [...currentSessionTestScore, ...manualScoresWithSession];
      setScores(combinedScores);
    }
  }, [session, studentId]);

  const handleAddScore = async (values: any) => {
    try {
      const newScore: ScoreDetail = {
        "Tên điểm": values.scoreName,
        "Điểm": values.score,
        "Ngày": values.date.format("YYYY-MM-DD"),
        "Ghi chú": values.note || "",
        "Session ID": session?.id,
        "Class ID": session?.["Class ID"],
      };

      // If editing, find the score by sessionId, classId, name and date to ensure we update the correct one
      const updatedScores = editingScore
        ? scores.map((s) =>
            s["Tên điểm"] === editingScore["Tên điểm"] &&
            s["Ngày"] === editingScore["Ngày"] &&
            s["Session ID"] === editingScore["Session ID"] &&
            s["Class ID"] === editingScore["Class ID"]
              ? newScore
              : s
          )
        : [...scores, newScore];

      // Only update the session that this score belongs to
      const targetSessionId = editingScore?.["Session ID"] || session?.id;
      const targetClassId = editingScore?.["Class ID"] || session?.["Class ID"];
      
      // Validate: ensure we're only updating the current session
      if (targetSessionId !== session?.id) {
        console.warn("⚠️ Attempting to update score from different session. Current:", session?.id, "Target:", targetSessionId);
        message.error("Không thể sửa điểm từ môn học khác. Vui lòng mở modal từ đúng môn học.");
        return;
      }
      
      if (targetSessionId && targetClassId) {
        // Fetch the target session
        const sessionRef = ref(
          database,
          `datasheet/Điểm_danh_sessions/${targetSessionId}`
        );
        
        // Get current session data
        const snapshot = await get(sessionRef);
        const targetSession = snapshot.val();
        if (!targetSession) {
          message.error("Không tìm thấy buổi học");
          return;
        }

        // Validate Class ID matches
        if (targetSession["Class ID"] !== targetClassId) {
          console.warn("⚠️ Class ID mismatch. Session Class ID:", targetSession["Class ID"], "Expected:", targetClassId);
          message.error("Lỗi: Môn học không khớp. Vui lòng thử lại.");
          return;
        }

        // Filter scores to only include those from this session
        const scoresForThisSession = updatedScores.filter(
          (s) => s["Session ID"] === targetSessionId && s["Class ID"] === targetClassId
        );

        console.log("💾 Saving scores for session:", targetSessionId, "class:", targetClassId, "scores count:", scoresForThisSession.length);

        const updatedAttendance = (targetSession["Điểm danh"] || []).map((record: any) => {
          if (record["Student ID"] === studentId) {
            return {
              ...record,
              "Chi tiết điểm": scoresForThisSession,
            };
          }
          return record;
        });

        await update(sessionRef, {
          "Điểm danh": updatedAttendance,
        });

        setScores(updatedScores);
        form.resetFields();
        setEditingScore(null);
        message.success(editingScore ? "Đã cập nhật điểm" : "Đã thêm điểm");
      }
    } catch (error) {
      console.error("Error saving score:", error);
      message.error("Lỗi khi lưu điểm");
    }
  };

  const handleDeleteScore = async (score: ScoreDetail) => {
    try {
      // Only remove the specific score (matching by sessionId, classId, name and date)
      const updatedScores = scores.filter(
        (s) =>
          !(
            s["Tên điểm"] === score["Tên điểm"] && 
            s["Ngày"] === score["Ngày"] &&
            s["Session ID"] === score["Session ID"] &&
            s["Class ID"] === score["Class ID"]
          )
      );

      // Only update the session that this score belongs to
      const targetSessionId = score["Session ID"] || session?.id;
      const targetClassId = score["Class ID"] || session?.["Class ID"];
      
      // Validate: ensure we're only updating the current session
      if (targetSessionId !== session?.id) {
        console.warn("⚠️ Attempting to delete score from different session. Current:", session?.id, "Target:", targetSessionId);
        message.error("Không thể xóa điểm từ môn học khác. Vui lòng mở modal từ đúng môn học.");
        return;
      }
      
      if (targetSessionId && targetClassId) {
        // Fetch the target session
        const sessionRef = ref(
          database,
          `datasheet/Điểm_danh_sessions/${targetSessionId}`
        );
        
        // Get current session data
        const snapshot = await get(sessionRef);
        const targetSession = snapshot.val();
        if (!targetSession) {
          message.error("Không tìm thấy buổi học");
          return;
        }

        // Validate Class ID matches
        if (targetSession["Class ID"] !== targetClassId) {
          console.warn("⚠️ Class ID mismatch. Session Class ID:", targetSession["Class ID"], "Expected:", targetClassId);
          message.error("Lỗi: Môn học không khớp. Vui lòng thử lại.");
          return;
        }

        // Filter scores to only include those from this session
        const scoresForThisSession = updatedScores.filter(
          (s) => s["Session ID"] === targetSessionId && s["Class ID"] === targetClassId
        );

        console.log("🗑️ Deleting score from session:", targetSessionId, "class:", targetClassId, "remaining scores:", scoresForThisSession.length);

        const updatedAttendance = (targetSession["Điểm danh"] || []).map((record: any) => {
          if (record["Student ID"] === studentId) {
            return {
              ...record,
              "Chi tiết điểm": scoresForThisSession,
            };
          }
          return record;
        });

        await update(sessionRef, {
          "Điểm danh": updatedAttendance,
        });

        setScores(updatedScores);
        message.success("Đã xóa điểm");
      }
    } catch (error) {
      console.error("Error deleting score:", error);
      message.error("Lỗi khi xóa điểm");
    }
  };

  const handleEditScore = (score: ScoreDetail) => {
    setEditingScore(score);
    form.setFieldsValue({
      scoreName: score["Tên điểm"],
      score: score["Điểm"],
      date: dayjs(score["Ngày"]),
      note: score["Ghi chú"],
    });
  };

  const handlePrint = () => {
    if (!session || !studentRecord) {
      message.warning("Không có dữ liệu để in");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      message.error("Không thể mở cửa sổ in");
      return;
    }

    const attendance = studentRecord["Có mặt"]
      ? studentRecord["Đi muộn"]
        ? "Đi muộn"
        : "Có mặt"
      : studentRecord["Vắng có phép"]
      ? "Vắng có phép"
      : "Vắng";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Bảng điểm - ${studentName}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 15mm;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              text-align: center;
              color: #1890ff;
              margin-bottom: 10px;
            }
            h2 {
              text-align: center;
              color: #333;
              margin-bottom: 20px;
            }
            .info {
              background: #f0f0f0;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 5px;
            }
            .info span {
              margin-right: 30px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #000;
              padding: 10px;
              text-align: center;
              font-size: 12px;
            }
            th {
              background: #f0f0f0;
              font-weight: bold;
            }
            td:last-child {
              text-align: left;
            }
            .header-title {
              background: #e6f7ff;
              font-weight: bold;
              font-size: 14px;
              text-align: left;
              padding: 10px;
              margin-top: 20px;
            }
            @media print {
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <h1>BẢNG ĐIỂM CHI TIẾT</h1>
          <h2>Trung tâm Trí Tuệ 8+</h2>
          
          <div class="info">
            <span><strong>Học sinh:</strong> ${studentName}</span>
            <span><strong>Lớp:</strong> ${session["Tên lớp"]}</span>
            <span><strong>Ngày:</strong> ${dayjs(session["Ngày"]).format("DD/MM/YYYY")}</span>
            <span><strong>Giờ:</strong> ${session["Giờ bắt đầu"]} - ${session["Giờ kết thúc"]}</span>
            <span><strong>Giáo viên:</strong> ${session["Giáo viên"]}</span>
          </div>
          
          <div class="header-title">Môn ${session["Tên lớp"]?.split(" - ")[0] || "Học tập"}</div>
          <table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Tên HS</th>
                <th>Chuyên cần</th>
                <th>% BTVN</th>
                <th>Tên bài kiểm tra</th>
                <th>Điểm</th>
                <th>Điểm thưởng</th>
                <th>Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${dayjs(session["Ngày"]).format("DD/MM/YYYY")}</td>
                <td>${studentName}</td>
                <td>${attendance}</td>
                <td>${studentRecord["% Hoàn thành BTVN"] ?? "-"}</td>
                <td>${studentRecord["Bài kiểm tra"] || "-"}</td>
                <td><strong>${studentRecord["Điểm kiểm tra"] ?? studentRecord["Điểm"] ?? "-"}</strong></td>
                <td>${studentRecord["Điểm thưởng"] ?? "-"}</td>
                <td style="text-align: left;">${studentRecord["Ghi chú"] || "-"}</td>
              </tr>
            </tbody>
          </table>
          
          <p style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
            Ngày in: ${dayjs().format("DD/MM/YYYY HH:mm")}
          </p>
          
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Get student record from session
  const studentRecord = session?.["Điểm danh"]?.find(
    (r) => r["Student ID"] === studentId
  );

  const columns = [
    {
      title: "Ngày",
      dataIndex: "Ngày",
      key: "date",
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
      width: 120,
    },
    {
      title: "Tên điểm",
      dataIndex: "Tên điểm",
      key: "scoreName",
      width: 200,
    },
    {
      title: "Điểm",
      dataIndex: "Điểm",
      key: "score",
      width: 80,
      render: (score: number) => <strong>{score}</strong>,
    },
    {
      title: "Ghi chú",
      dataIndex: "Ghi chú",
      key: "note",
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 150,
      render: (_: any, record: ScoreDetail) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditScore(record)}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xác nhận xóa?"
            onConfirm={() => handleDeleteScore(record)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={`Bảng điểm chi tiết - ${studentName}`}
      open={visible}
      onCancel={() => {
        onClose();
        form.resetFields();
        setEditingScore(null);
      }}
      width={1200}
      footer={null}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        {/* Session Info */}
        {session && (
          <Card size="small" style={{ background: "#f0f0f0" }}>
            <Space split="|" size="large">
              <span><strong>Lớp:</strong> {session["Tên lớp"]}</span>
              <span><strong>Ngày:</strong> {dayjs(session["Ngày"]).format("DD/MM/YYYY")}</span>
              <span><strong>Giờ:</strong> {session["Giờ bắt đầu"]} - {session["Giờ kết thúc"]}</span>
              <span><strong>Giáo viên:</strong> {session["Giáo viên"]}</span>
            </Space>
          </Card>
        )}

        {/* Score Table in Format */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0, color: "#1890ff" }}>Bảng điểm theo định dạng</h4>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              In bảng điểm
            </Button>
          </div>
          <table style={{ 
            width: "100%", 
            borderCollapse: "collapse",
            fontSize: "13px"
          }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ border: "1px solid #d9d9d9", padding: "10px", textAlign: "center", fontWeight: "bold" }}>Ngày</th>
                <th style={{ border: "1px solid #d9d9d9", padding: "10px", textAlign: "center", fontWeight: "bold" }}>Tên HS</th>
                <th style={{ border: "1px solid #d9d9d9", padding: "10px", textAlign: "center", fontWeight: "bold" }}>Chuyên cần</th>
                <th style={{ border: "1px solid #d9d9d9", padding: "10px", textAlign: "center", fontWeight: "bold" }}>% BTVN</th>
                <th style={{ border: "1px solid #d9d9d9", padding: "10px", textAlign: "center", fontWeight: "bold" }}>Tên bài kiểm tra</th>
                <th style={{ border: "1px solid #d9d9d9", padding: "10px", textAlign: "center", fontWeight: "bold" }}>Điểm</th>
                <th style={{ border: "1px solid #d9d9d9", padding: "10px", textAlign: "center", fontWeight: "bold" }}>Điểm thưởng</th>
                <th style={{ border: "1px solid #d9d9d9", padding: "10px", textAlign: "center", fontWeight: "bold" }}>Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              {session && studentRecord && (
                <tr>
                  <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center" }}>
                    {dayjs(session["Ngày"]).format("DD/MM/YYYY")}
                  </td>
                  <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center" }}>
                    {studentName}
                  </td>
                  <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center" }}>
                    {studentRecord["Có mặt"]
                      ? studentRecord["Đi muộn"]
                        ? "Đi muộn"
                        : "Có mặt"
                      : studentRecord["Vắng có phép"]
                      ? "Vắng có phép"
                      : "Vắng"}
                  </td>
                  <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center" }}>
                    {studentRecord["% Hoàn thành BTVN"] ?? "-"}
                  </td>
                  <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center" }}>
                    {studentRecord["Bài kiểm tra"] || "-"}
                  </td>
                  <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center", fontWeight: "bold" }}>
                    {studentRecord["Điểm kiểm tra"] ?? studentRecord["Điểm"] ?? "-"}
                  </td>
                  <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center" }}>
                    {studentRecord["Điểm thưởng"] ?? "-"}
                  </td>
                  <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "left", paddingLeft: "12px" }}>
                    {studentRecord["Ghi chú"] || "-"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Form */}
        <Card title={editingScore ? "Sửa điểm" : "Thêm điểm mới"} size="small">
          <Form
            form={form}
            layout="inline"
            onFinish={handleAddScore}
            initialValues={{
              date: dayjs(),
            }}
          >
            <Form.Item
              name="date"
              label="Ngày"
              rules={[{ required: true, message: "Chọn ngày" }]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item
              name="scoreName"
              label="Tên điểm"
              rules={[{ required: true, message: "Nhập tên điểm" }]}
            >
              <Input placeholder="VD: Kiểm tra 15 phút" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item
              name="score"
              label="Điểm"
              rules={[
                { required: true, message: "Nhập điểm" },
                { type: "number", min: 0, max: 10, message: "Điểm từ 0-10" },
              ]}
            >
              <InputNumber
                min={0}
                max={10}
                step={0.5}
                style={{ width: 100 }}
              />
            </Form.Item>
            <Form.Item name="note" label="Ghi chú">
              <Input placeholder="Ghi chú" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                {editingScore ? "Cập nhật" : "Thêm"}
              </Button>
              {editingScore && (
                <Button
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    form.resetFields();
                    setEditingScore(null);
                  }}
                >
                  Hủy
                </Button>
              )}
            </Form.Item>
          </Form>
        </Card>

        {/* Scores Table */}
        <Card title="Danh sách điểm chi tiết" size="small">
          <Table
            columns={columns}
            dataSource={scores}
            rowKey={(record) => `${record["Ngày"]}-${record["Tên điểm"]}`}
            pagination={false}
            size="small"
            locale={{ emptyText: "Chưa có điểm nào" }}
          />
        </Card>
      </Space>
    </Modal>
  );
};

export default ScoreDetailModal;
