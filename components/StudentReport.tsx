import { useRef, useState, useEffect } from "react";
import {
  Modal,
  Button,
  Descriptions,
  Table,
  Tag,
  Divider,
  Card,
  Row,
  Col,
  Statistic,
  Radio,
  Space,
  DatePicker,
} from "antd";
import {
  PrinterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { ref, onValue } from "firebase/database";
import { database } from "../firebase";
import { supabaseGetAll, supabaseOnValue, convertFromSupabaseFormat } from "@/utils/supabaseHelpers";
import { useAttendanceStats } from "../hooks/useAttendanceStats";
import { AttendanceSession, MonthlyComment, ClassStats } from "../types";
import dayjs from "dayjs";
import "dayjs/locale/vi";

dayjs.locale("vi");

interface StudentReportProps {
  open: boolean;
  onClose: () => void;
  student: {
    id: string;
    "Họ và tên": string;
    "Mã học sinh"?: string;
    "Ngày sinh"?: string;
    "Số điện thoại"?: string;
    Email?: string;
    "Địa chỉ"?: string;
    [key: string]: any;
  };
  sessions: AttendanceSession[];
  teacherName?: string;
  initialMonth?: dayjs.Dayjs | null;
}

const StudentReport = ({
  open,
  onClose,
  student,
  sessions,
  teacherName,
  initialMonth,
}: StudentReportProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { getStudentStats } = useAttendanceStats();
  const [viewMode, setViewMode] = useState<"session" | "monthly">("session");
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs | null>(initialMonth ?? dayjs());
  const [monthlyComments, setMonthlyComments] = useState<MonthlyComment[]>([]);

  // Update selectedMonth when initialMonth changes
  useEffect(() => {
    if (initialMonth) {
      setSelectedMonth(initialMonth);
    }
  }, [initialMonth]);
  const [customScoresData, setCustomScoresData] = useState<{ [classId: string]: any }>({});
  const [classes, setClasses] = useState<any[]>([]);

  // Load classes from Supabase
  useEffect(() => {
    if (!open) return;
    
    const loadClasses = async () => {
      const data = await supabaseGetAll("datasheet/Lớp_học");
      if (data) {
        setClasses(Object.entries(data).map(([id, value]) => ({ id, ...(value as any) })));
      }
    };

    loadClasses();

    // Subscribe to real-time updates
    const unsubscribe = supabaseOnValue("datasheet/Lớp_học", (data) => {
      if (data) {
        setClasses(Object.entries(data).map(([id, value]) => ({ id, ...(value as any) })));
      }
    });
    return () => unsubscribe();
  }, [open]);

  // Load custom scores from Điểm_tự_nhập (Supabase) for all classes this student is in
  useEffect(() => {
    if (!open || !student?.id) return;

    // Get all class IDs this student is enrolled in
    const studentClassIds = new Set<string>();
    sessions.forEach((session) => {
      const record = session["Điểm danh"]?.find((r) => r["Student ID"] === student.id);
      if (record && session["Class ID"]) {
        studentClassIds.add(session["Class ID"]);
      }
    });

    if (studentClassIds.size === 0) return;

    const loadCustomScores = async () => {
      const data = await supabaseGetAll("datasheet/Điểm_tự_nhập");
      if (data) {
        const relevantScores: { [classId: string]: any } = {};
        studentClassIds.forEach((classId) => {
          // Find score data for this class (id = class_id)
          const scoreEntry = Object.values(data).find((item: any) => {
            const converted = convertFromSupabaseFormat(item, "diem_tu_nhap");
            return converted["Class ID"] === classId || converted.class_id === classId || item.class_id === classId;
          });
          if (scoreEntry) {
            const converted = convertFromSupabaseFormat(scoreEntry, "diem_tu_nhap") as any;
            relevantScores[classId] = {
              columns: converted?.columns || (scoreEntry as any)?.columns || [],
              scores: converted?.scores || (scoreEntry as any)?.scores || [],
            };
          }
        });
        setCustomScoresData(relevantScores);
      }
    };

    loadCustomScores();

    // Subscribe to real-time updates
    const unsubscribe = supabaseOnValue("datasheet/Điểm_tự_nhập", (data) => {
      if (data) {
        const relevantScores: { [classId: string]: any } = {};
        studentClassIds.forEach((classId) => {
          const scoreEntry = Object.values(data).find((item: any) => {
            const converted = convertFromSupabaseFormat(item, "diem_tu_nhap");
            return converted["Class ID"] === classId || converted.class_id === classId || item.class_id === classId;
          });
          if (scoreEntry) {
            const converted = convertFromSupabaseFormat(scoreEntry, "diem_tu_nhap") as any;
            relevantScores[classId] = {
              columns: converted?.columns || (scoreEntry as any)?.columns || [],
              scores: converted?.scores || (scoreEntry as any)?.scores || [],
            };
          }
        });
        setCustomScoresData(relevantScores);
      }
    });
    return () => unsubscribe();
  }, [open, student?.id, sessions]);

  // Helper function to get all scores for a student from Điểm_tự_nhập
  const getCustomScoresForStudent = (studentId: string) => {
    const scores: Array<{
      classId: string;
      className: string;
      columnName: string;
      testName: string;
      date: string;
      score: number;
    }> = [];

    Object.entries(customScoresData).forEach(([classId, classScores]: [string, any]) => {
      if (!classScores?.columns || !classScores?.scores) return;

      const classInfo = classes.find((c) => c.id === classId);
      const className = classInfo?.["Tên lớp"] || classId;

      const studentScore = classScores.scores.find((s: any) => s.studentId === studentId);
      if (!studentScore) return;

      classScores.columns.forEach((columnName: string) => {
        const scoreValue = studentScore[columnName];
        if (scoreValue !== null && scoreValue !== undefined && scoreValue !== "") {
          // Extract date and test name from column: "testName (DD-MM-YYYY)"
          const dateMatch = columnName.match(/\((\d{2}-\d{2}-\d{4})\)$/);
          let dateStr = "";
          let testName = columnName;

          if (dateMatch) {
            const [day, month, year] = dateMatch[1].split("-");
            dateStr = `${year}-${month}-${day}`;
            testName = columnName.replace(/\s*\(\d{2}-\d{2}-\d{4}\)$/, "").trim();
          }

          scores.push({
            classId,
            className,
            columnName,
            testName: testName || "Điểm",
            date: dateStr,
            score: Number(scoreValue),
          });
        }
      });
    });

    return scores;
  };

  // Helper function to get scores from attendance sessions (Điểm kiểm tra)
  const getScoresFromAttendance = (studentId: string) => {
    const scores: Array<{
      classId: string;
      className: string;
      testName: string;
      date: string;
      score: number;
    }> = [];

    sessions.forEach((session) => {
      const record = session["Điểm danh"]?.find((r) => r["Student ID"] === studentId);
      if (record) {
        const scoreValue = record["Điểm kiểm tra"] ?? record["Điểm"];
        if (scoreValue !== undefined && scoreValue !== null && !isNaN(Number(scoreValue))) {
          const classInfo = classes.find((c) => c.id === session["Class ID"]);
          const className = classInfo?.["Tên lớp"] || session["Tên lớp"] || session["Class ID"];
          scores.push({
            classId: session["Class ID"],
            className,
            testName: "Điểm buổi học",
            date: session["Ngày"],
            score: Number(scoreValue),
          });
        }
      }
    });

    return scores;
  };

  // Combined function to get all scores from both sources
  const getAllScoresForStudent = (studentId: string) => {
    const customScores = getCustomScoresForStudent(studentId);
    const attendanceScores = getScoresFromAttendance(studentId);
    
    // Merge: ưu tiên điểm từ Điểm_tự_nhập, nếu không có thì lấy từ attendance
    const mergedScores = [...customScores];
    
    attendanceScores.forEach((attScore) => {
      // Kiểm tra xem đã có điểm cho ngày này và lớp này chưa
      const exists = customScores.some(
        (cs) => cs.date === attScore.date && cs.classId === attScore.classId
      );
      if (!exists) {
        mergedScores.push({
          ...attScore,
          columnName: `Điểm buổi học (${dayjs(attScore.date).format("DD-MM-YYYY")})`,
        });
      }
    });
    
    return mergedScores;
  };

  // Load monthly comments from Supabase
  useEffect(() => {
    if (!open || !student?.id) return;

    const unsubscribe = supabaseOnValue(
      "datasheet/Nhận_xét_tháng",
      (data) => {
        if (data && typeof data === "object") {
          const commentList = Object.entries(data)
            .map(([id, value]) => {
              const converted = convertFromSupabaseFormat(value, "nhan_xet_thang");
              return {
                id,
                ...(converted as Omit<MonthlyComment, "id">),
              };
            })
            .filter((c) => c.studentId === student.id);
          setMonthlyComments(commentList);
        } else {
          setMonthlyComments([]);
        }
      }
    );
    return () => unsubscribe();
  }, [open, student?.id]);

  // Get comments for a specific class/subject from monthly comments
  // Hỗ trợ trường hợp học sinh học nhiều môn từ nhiều giáo viên khác nhau
  const getClassComment = (className: string): string => {
    if (!selectedMonth) return "";
    const monthStr = selectedMonth.format("YYYY-MM");
    
    // Tìm trong TẤT CẢ các MonthlyComment đã duyệt trong tháng này
    // (có thể từ nhiều giáo viên khác nhau)
    for (const monthComment of monthlyComments) {
      if (monthComment.month !== monthStr || monthComment.status !== "approved") {
        continue;
      }
      
      if (!monthComment?.stats?.classStats) continue;
      
      // Match linh hoạt: so sánh className hoặc subject với input
      // Cũng kiểm tra nếu className bắt đầu bằng input (để match "Toán 4" với "Toán 4 - Thầy ABC")
      const classStats = monthComment.stats.classStats.find(
        (cs) => {
          const csClassNameBase = cs.className?.split(" - ")[0] || "";
          return cs.className === className || 
                 cs.subject === className ||
                 csClassNameBase === className ||
                 cs.className?.startsWith(className);
        }
      );
      
      if (classStats?.comment) {
        return classStats.comment;
      }
    }
    
    return "";
  };

  // Reset state when modal closes
  const handleClose = () => {
    onClose();
  };

  const stats = getStudentStats(student.id);

  // Filter sessions for this student
  const studentSessions = sessions
    .filter((session) =>
      session["Điểm danh"]?.some(
        (record) => record["Student ID"] === student.id
      )
    )
    .sort(
      (a, b) => new Date(b["Ngày"]).getTime() - new Date(a["Ngày"]).getTime()
    );

  // Calculate attendance rate
  const attendanceRate =
    stats.totalSessions > 0
      ? Math.round((stats.presentSessions / stats.totalSessions) * 100)
      : 0;

  // Get status tag
  const getStatusTag = (record: any) => {
    if (record["Có mặt"]) {
      if (record["Đi muộn"]) {
        return <Tag color="orange">Đi muộn</Tag>;
      }
      return <Tag color="green">Có mặt</Tag>;
    } else {
      if (record["Vắng có phép"]) {
        return <Tag color="blue">Vắng có phép</Tag>;
      }
      if (record["Vắng không phép"]) {
        return <Tag color="red">Vắng không phép</Tag>;
      }
      // Default to unexcused absence if not explicitly marked
      return <Tag color="red">Vắng không phép</Tag>;
    }
  };

  const columns = [
    {
      title: "Ngày",
      dataIndex: "Ngày",
      key: "date",
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
      width: 100,
    },
    {
      title: "Lớp học",
      dataIndex: "Tên lớp",
      key: "class",
      width: 150,
    },
    {
      title: "Giờ học",
      key: "time",
      render: (_: any, record: AttendanceSession) =>
        `${record["Giờ bắt đầu"]} - ${record["Giờ kết thúc"]}`,
      width: 100,
    },
    {
      title: "Trạng thái",
      key: "status",
      render: (_: any, record: AttendanceSession) => {
        const studentRecord = record["Điểm danh"]?.find(
          (r) => r["Student ID"] === student.id
        );
        return studentRecord ? getStatusTag(studentRecord) : "-";
      },
      width: 120,
    },
    {
      title: "% BTVN",
      key: "homework_percentage",
      render: (_: any, record: AttendanceSession) => {
        const studentRecord = record["Điểm danh"]?.find(
          (r) => r["Student ID"] === student.id
        );
        const percent = studentRecord?.["% Hoàn thành BTVN"];
        return percent !== null && percent !== undefined ? `${percent}%` : "-";
      },
      width: 80,
    },
    {
      title: "Điểm thưởng",
      key: "bonus_points",
      render: (_: any, record: AttendanceSession) => {
        const studentRecord = record["Điểm danh"]?.find(
          (r) => r["Student ID"] === student.id
        );
        return studentRecord?.["Điểm thưởng"] ?? "-";
      },
      width: 90,
    },
    {
      title: "Bài kiểm tra",
      key: "test_name",
      render: (_: any, record: AttendanceSession) => {
        // Get scores from Điểm_tự_nhập for this date
        const sessionDate = dayjs(record["Ngày"]).format("DD/MM/YYYY");
        const allCustomScores = getAllScoresForStudent(student.id);
        const dateScores = allCustomScores.filter((s) => {
          const scoreDate = dayjs(s.date).format("DD/MM/YYYY");
          return scoreDate === sessionDate && s.className?.includes(record["Tên lớp"]?.split(" - ")[0] || "");
        });
        if (dateScores.length > 0) {
          return dateScores.map(s => s.testName).join(", ");
        }
        return "-";
      },
      width: 150,
    },
    {
      title: "Điểm KT",
      key: "test_score",
      render: (_: any, record: AttendanceSession) => {
        // Get scores from Điểm_tự_nhập for this date
        const sessionDate = dayjs(record["Ngày"]).format("DD/MM/YYYY");
        const allCustomScores = getAllScoresForStudent(student.id);
        const dateScores = allCustomScores.filter((s) => {
          const scoreDate = dayjs(s.date).format("DD/MM/YYYY");
          return scoreDate === sessionDate && s.className?.includes(record["Tên lớp"]?.split(" - ")[0] || "");
        });
        if (dateScores.length > 0) {
          return dateScores.map(s => s.score).join(", ");
        }
        return "-";
      },
      width: 80,
    },
    {
      title: "Điểm",
      key: "score",
      render: (_: any, record: AttendanceSession) => {
        // Get scores from Điểm_tự_nhập for this date  
        const sessionDate = dayjs(record["Ngày"]).format("DD/MM/YYYY");
        const allCustomScores = getAllScoresForStudent(student.id);
        const dateScores = allCustomScores.filter((s) => {
          const scoreDate = dayjs(s.date).format("DD/MM/YYYY");
          return scoreDate === sessionDate && s.className?.includes(record["Tên lớp"]?.split(" - ")[0] || "");
        });
        if (dateScores.length > 0) {
          return dateScores.map(s => s.score).join(", ");
        }
        return "-";
      },
      width: 80,
    },
    {
      title: "Bài tập",
      key: "homework",
      render: (_: any, record: AttendanceSession) => {
        const studentRecord = record["Điểm danh"]?.find(
          (r) => r["Student ID"] === student.id
        );
        const completed = studentRecord?.["Bài tập hoàn thành"];
        const total = record["Bài tập"]?.["Tổng số bài"];
        if (completed !== undefined && total) {
          return `${completed}/${total}`;
        }
        return "-";
      },
      width: 100,
    },
    {
      title: "Ghi chú",
      key: "note",
      render: (_: any, record: AttendanceSession) => {
        const studentRecord = record["Điểm danh"]?.find(
          (r) => r["Student ID"] === student.id
        );
        return studentRecord?.["Ghi chú"] || "-";
      },
    },
  ];

  const generateMonthlyPrintContent = () => {
    // Filter sessions by selected month
    const filteredSessions = selectedMonth
      ? studentSessions.filter((session) => {
          const sessionDate = dayjs(session["Ngày"]);
          return (
            sessionDate.month() === selectedMonth.month() &&
            sessionDate.year() === selectedMonth.year()
          );
        })
      : studentSessions;

    // Get status text and color
    const getStatusText = (record: any) => {
      if (record["Có mặt"]) {
        return record["Đi muộn"] ? "Đi muộn" : "Có mặt";
      } else {
        return record["Vắng có phép"] ? "Vắng có phép" : "Vắng không phép";
      }
    };

    const getStatusColor = (record: any) => {
      if (record["Có mặt"]) {
        return record["Đi muộn"] ? "#fa8c16" : "#52c41a";
      } else {
        return record["Vắng có phép"] ? "#1890ff" : "#f5222d";
      }
    };

    // Calculate stats for selected month
    let presentCount = 0;
    let absentCount = 0;

    filteredSessions.forEach((session) => {
      const record = session["Điểm danh"]?.find(
        (r) => r["Student ID"] === student.id
      );
      if (record) {
        if (record["Có mặt"]) {
          presentCount++;
        } else {
          absentCount++;
        }
      }
    });

    // Get scores from Điểm_tự_nhập (single source of truth) for selected month
    const allCustomScores = getAllScoresForStudent(student.id);
    const monthScores = selectedMonth
      ? allCustomScores.filter((s) => {
          if (!s.date) return false;
          const scoreDate = dayjs(s.date);
          return (
            scoreDate.month() === selectedMonth.month() &&
            scoreDate.year() === selectedMonth.year()
          );
        })
      : allCustomScores;
    
    const totalScore = monthScores.reduce((sum, s) => sum + s.score, 0);
    const scoreCount = monthScores.length;
    const avgScore = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : "0";
    const attendanceRate =
      filteredSessions.length > 0
        ? ((presentCount / filteredSessions.length) * 100).toFixed(1)
        : "0";

    // Group sessions by subject for attendance table
    const sessionsBySubject: { [subject: string]: AttendanceSession[] } = {};
    filteredSessions.forEach((session) => {
      const subject = session["Tên lớp"]?.split(" - ")[0] || "Chưa phân loại";
      if (!sessionsBySubject[subject]) {
        sessionsBySubject[subject] = [];
      }
      sessionsBySubject[subject].push(session);
    });

    // Group scores by className from Điểm_tự_nhập
    const scoresByClass: { [className: string]: typeof monthScores } = {};
    monthScores.forEach((score) => {
      const className = score.className?.split(" - ")[0] || score.className || "Chưa phân loại";
      if (!scoresByClass[className]) {
        scoresByClass[className] = [];
      }
      scoresByClass[className].push(score);
    });

    // Generate content by subject - Group: Bảng điểm → Nhận xét → Lịch sử
    let subjectContentsHTML = "";
    
    // Get all unique subjects from both sessions and scores
    const allSubjects = new Set([
      ...Object.keys(sessionsBySubject),
      ...Object.keys(scoresByClass),
    ]);

    allSubjects.forEach((subject) => {
      const subjectSessions = sessionsBySubject[subject] || [];
      const subjectScoresFromDB = scoresByClass[subject] || [];
      
      const sortedSessions = [...subjectSessions].sort(
        (a, b) => new Date(a["Ngày"]).getTime() - new Date(b["Ngày"]).getTime()
      );

      // Calculate subject stats from Điểm_tự_nhập
      const subjectAvg = subjectScoresFromDB.length > 0 
        ? (subjectScoresFromDB.reduce((sum, s) => sum + s.score, 0) / subjectScoresFromDB.length).toFixed(1)
        : "-";

      // Get comment for this subject from monthly comments
      const subjectComment = getClassComment(subject);

      // Build a map of date -> scores for this subject
      const scoresByDate: { [date: string]: Array<{ testName: string; score: number }> } = {};
      subjectScoresFromDB.forEach((s) => {
        const dateKey = dayjs(s.date).format("DD/MM");
        if (!scoresByDate[dateKey]) {
          scoresByDate[dateKey] = [];
        }
        scoresByDate[dateKey].push({ testName: s.testName, score: s.score });
      });

      // 1. BẢNG ĐIỂM - Chỉ hiển thị những ngày có điểm
      let scoreTableRows = "";
      Object.entries(scoresByDate)
        .sort((a, b) => {
          const dateA = dayjs(a[0], "DD/MM");
          const dateB = dayjs(b[0], "DD/MM");
          return dateA.isBefore(dateB) ? -1 : 1;
        })
        .forEach(([date, dateScores]) => {
          const testNamesStr = dateScores.map(s => s.testName).join(", ");
          const scoresStr = dateScores.map(s => s.score).join(", ");

          scoreTableRows += `
            <tr>
              <td style="text-align: center;">${date}</td>
              <td style="text-align: left; font-size: 11px;">${testNamesStr}</td>
              <td style="text-align: center; font-weight: bold;">${scoresStr}</td>
            </tr>
          `;
        });

      // 2. LỊCH SỬ HỌC TẬP CHI TIẾT cho môn này (chuyên cần, không có điểm)
      let historyTableRows = "";
      sortedSessions.forEach((session) => {
        const studentRecord = session["Điểm danh"]?.find(
          (r) => r["Student ID"] === student.id
        );
        if (studentRecord) {
          const dateFormatted = dayjs(session["Ngày"]).format("DD/MM/YYYY");
          const className = session["Tên lớp"] || "-";
          const timeRange = `${session["Giờ bắt đầu"]} - ${session["Giờ kết thúc"]}`;
          const statusText = getStatusText(studentRecord);
          const statusColor = getStatusColor(studentRecord);
          const note = studentRecord["Ghi chú"] || "-";

          historyTableRows += `
            <tr>
              <td style="text-align: center;">${dateFormatted}</td>
              <td style="text-align: left;">${className}</td>
              <td style="text-align: center;">${timeRange}</td>
              <td style="text-align: center; color: ${statusColor}; font-weight: 500;">${statusText}</td>
              <td style="text-align: left; font-size: 10px;">${note}</td>
            </tr>
          `;
        }
      });

      // Combine: Subject Header → Score Table → Comment → History Table
      subjectContentsHTML += `
        <div class="subject-section" style="page-break-inside: avoid; margin-bottom: 25px;">
          <div class="subject-header">
            <span class="subject-name">📚 Môn ${subject}</span>
            <span class="subject-avg">TB: <strong>${subjectAvg}</strong></span>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; color: #004aad; font-size: 12px; margin-bottom: 6px;">📊 Bảng điểm</div>
            <table class="score-table">
              <thead>
                <tr>
                  <th style="width: 80px;">Ngày</th>
                  <th style="width: auto;">Tên bài kiểm tra</th>
                  <th style="width: 80px;">Điểm</th>
                </tr>
              </thead>
              <tbody>
                ${scoreTableRows || '<tr><td colspan="3" style="text-align: center; color: #999;">Không có dữ liệu</td></tr>'}
              </tbody>
            </table>
          </div>

          ${subjectComment ? `
          <div class="subject-comment" style="margin-bottom: 12px;">
            <div class="comment-label">📝 Nhận xét</div>
            <div class="comment-content">${subjectComment.replace(/\n/g, "<br/>")}</div>
          </div>
          ` : ''}

          ${historyTableRows ? `
          <div style="margin-top: 12px;">
            <div style="font-weight: 600; color: #004aad; font-size: 12px; margin-bottom: 6px;">📋 Lịch sử học tập chi tiết</div>
            <table class="history-table">
              <thead>
                <tr>
                  <th style="width: 80px;">Ngày</th>
                  <th style="width: 150px;">Lớp học</th>
                  <th style="width: 80px;">Giờ học</th>
                  <th style="width: 80px;">Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                ${historyTableRows}
              </tbody>
            </table>
          </div>
          ` : ''}
        </div>
      `;
    });

    // Get unique classes for this month
    const uniqueClasses = Array.from(
      new Set(filteredSessions.map((s) => s["Tên lớp"] || ""))
    ).filter((name) => name);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Báo cáo học tập - ${student["Họ và tên"]}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              color: #333;
              line-height: 1.5;
              background: #fff;
              font-size: 12px;
            }
            .watermark-container { position: relative; }
            .watermark-logo {
              position: absolute; 
              top: 50%; 
              left: 50%;
              transform: translate(-50%, -50%);
              z-index: 0; 
              pointer-events: none;
            }
            .watermark-logo img {
              width: 600px; height: 600px;
              max-width: 80vw;
              object-fit: contain; opacity: 0.22; filter: grayscale(25%);
            }
            .report-content { position: relative; z-index: 1; }
            .header {
              text-align: center;
              border-bottom: 3px solid #004aad;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            .header h1 {
              color: #004aad;
              font-size: 22px;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .header p { color: #666; margin: 5px 0 0; font-size: 12px; }
            .section { margin-bottom: 18px; }
            .section-title {
              font-weight: bold;
              color: #004aad;
              border-left: 4px solid #004aad;
              padding-left: 10px;
              margin-bottom: 10px;
              font-size: 14px;
              text-transform: uppercase;
            }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; }
            th { background-color: #004aad; color: #fff; text-align: center; font-weight: 600; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            .info-table th { background: #f0f0f0; color: #333; text-align: left; width: 130px; }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 10px;
              margin-top: 10px;
            }
            .stat-card {
              border: 1px solid #ddd;
              border-radius: 6px;
              padding: 10px;
              text-align: center;
              background: #fafafa;
            }
            .stat-value { font-size: 20px; font-weight: bold; color: #004aad; }
            .stat-label { color: #666; font-size: 11px; margin-top: 3px; }
            .subject-section { margin-bottom: 15px; }
            .subject-header {
              background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
              padding: 8px 12px;
              border-left: 4px solid #1890ff;
              border-radius: 4px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 6px;
            }
            .subject-name { font-weight: bold; font-size: 13px; color: #004aad; }
            .subject-avg { font-size: 12px; color: #666; }
            .score-table th { background-color: #f5f5f5; color: #333; font-size: 11px; }
            .score-table td { font-size: 11px; }
            .history-table { margin-top: 10px; }
            .history-table th { background-color: #004aad; color: #fff; font-size: 11px; }
            .history-table td { font-size: 11px; }
            .subject-comment {
              margin-top: 8px;
              padding: 10px 12px;
              background: rgba(240, 250, 235, 0.4);
              border-left: 3px solid rgba(82, 196, 26, 0.7);
              border-radius: 4px;
            }
            .subject-comment .comment-label {
              font-weight: bold;
              color: #389e0d;
              margin-bottom: 5px;
              font-size: 12px;
            }
            .subject-comment .comment-content {
              color: #333;
              font-size: 12px;
              line-height: 1.6;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #888;
              font-size: 11px;
              border-top: 1px solid #ccc;
              padding-top: 10px;
            }
            .classes-list {
              display: flex;
              flex-wrap: wrap;
              gap: 5px;
              margin-top: 5px;
            }
            .class-tag {
              background: #e6f7ff;
              color: #1890ff;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
            }
            @media print { 
              body { margin: 0; } 
              .no-print { display: none; }
              .watermark-logo {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 0;
                pointer-events: none;
              }
              .watermark-logo img {
                width: 650px;
                height: 650px;
                opacity: 0.25;
                filter: grayscale(25%);
              }
            }
          </style>
        </head>
        <body>
          <div class="watermark-container">
            <div class="watermark-logo">
              <img src="/img/logo.png" alt="Background Logo" />
            </div>
            <div class="report-content">
              <div class="header">
                <h1>BÁO CÁO HỌC TẬP THÁNG ${selectedMonth?.format("MM/YYYY") || ""}</h1>
                <p>Ngày xuất: ${dayjs().format("DD/MM/YYYY HH:mm")}</p>
              </div>

              <div class="section">
                <div class="section-title">Thông tin học sinh</div>
                <table class="info-table">
                  <tr><th>Họ và tên</th><td><strong>${student["Họ và tên"]}</strong></td></tr>
                  <tr><th>Mã học sinh</th><td>${student["Mã học sinh"] || "-"}</td></tr>
                  <tr><th>Ngày sinh</th><td>${student["Ngày sinh"] ? dayjs(student["Ngày sinh"]).format("DD/MM/YYYY") : "-"}</td></tr>
                  <tr>
                    <th>Các lớp đang học</th>
                    <td>
                      <div class="classes-list">
                        ${uniqueClasses.map((name: string) => `<span class="class-tag">${name}</span>`).join("")}
                      </div>
                    </td>
                  </tr>
                  <tr><th>Số điện thoại</th><td>${student["Số điện thoại"] || "-"}</td></tr>
                  <tr><th>Email</th><td>${student["Email"] || "-"}</td></tr>
                </table>
              </div>

              <div class="section">
                <div class="section-title">Thống kê tháng ${selectedMonth?.format("MM/YYYY") || ""}</div>
                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-value">${filteredSessions.length}</div>
                    <div class="stat-label">Tổng số buổi</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-value" style="color: #52c41a;">${presentCount}</div>
                    <div class="stat-label">Số buổi có mặt</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-value" style="color: #ff4d4f;">${absentCount}</div>
                    <div class="stat-label">Số buổi vắng</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-value" style="color: #1890ff;">${attendanceRate}%</div>
                    <div class="stat-label">Tỷ lệ tham gia</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-value" style="color: #722ed1;">${avgScore}</div>
                    <div class="stat-label">Điểm trung bình</div>
                  </div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Chi tiết theo môn học</div>
                ${subjectContentsHTML || '<p style="color: #999; text-align: center;">Không có dữ liệu trong tháng này</p>'}
              </div>

              <div class="footer">
                <p>Báo cáo được tạo tự động từ hệ thống quản lý học sinh.</p>
                <p style="margin-top: 5px;">Mọi thắc mắc xin liên hệ giáo viên phụ trách.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const generateSessionPrintContent = () => {
    // Get all scores from Điểm_tự_nhập
    const allCustomScores = getAllScoresForStudent(student.id);

    // Get status text
    const getStatusText = (record: any) => {
      if (record["Có mặt"]) {
        return record["Đi muộn"] ? "Đi muộn" : "Có mặt";
      } else {
        return record["Vắng có phép"] ? "Vắng có phép" : "Vắng";
      }
    };

    // Get status color
    const getStatusColor = (record: any) => {
      if (record["Có mặt"]) {
        return record["Đi muộn"] ? "#fa8c16" : "#52c41a";
      } else {
        return record["Vắng có phép"] ? "#1890ff" : "#f5222d";
      }
    };

    // Calculate average score from Điểm_tự_nhập
    const averageScore =
      allCustomScores.length > 0
        ? (allCustomScores.reduce((a, b) => a + b.score, 0) / allCustomScores.length).toFixed(1)
        : "0";

    // Get unique classes
    const uniqueClasses = Array.from(
      new Set(studentSessions.map((s) => s["Tên lớp"] || ""))
    ).filter((name) => name);

    // Group sessions by subject
    const sessionsBySubject: { [subject: string]: AttendanceSession[] } = {};
    studentSessions.forEach((session) => {
      const subject = session["Tên lớp"]?.split(" - ")[0] || "Chưa phân loại";
      if (!sessionsBySubject[subject]) {
        sessionsBySubject[subject] = [];
      }
      sessionsBySubject[subject].push(session);
    });

    // Group scores by class
    const scoresByClass: { [className: string]: typeof allCustomScores } = {};
    allCustomScores.forEach((score) => {
      const className = score.className?.split(" - ")[0] || score.className || "Chưa phân loại";
      if (!scoresByClass[className]) {
        scoresByClass[className] = [];
      }
      scoresByClass[className].push(score);
    });

    // Get all unique subjects
    const allSubjects = new Set([
      ...Object.keys(sessionsBySubject),
      ...Object.keys(scoresByClass),
    ]);

    // Generate content grouped by subject: Bảng điểm → Nhận xét → Lịch sử
    let subjectContentsHTML = "";
    
    allSubjects.forEach((subject) => {
      const subjectSessions = sessionsBySubject[subject] || [];
      const subjectScoresFromDB = scoresByClass[subject] || [];
      
      const sortedSessions = [...subjectSessions].sort(
        (a, b) => new Date(a["Ngày"]).getTime() - new Date(b["Ngày"]).getTime()
      );

      // Calculate subject average from Điểm_tự_nhập
      const subjectAvg = subjectScoresFromDB.length > 0 
        ? (subjectScoresFromDB.reduce((sum, s) => sum + s.score, 0) / subjectScoresFromDB.length).toFixed(1)
        : "-";

      // Get comment for this subject
      const subjectComment = getClassComment(subject);

      // Build a map of date -> scores
      const scoresByDate: { [date: string]: Array<{ testName: string; score: number }> } = {};
      subjectScoresFromDB.forEach((s) => {
        const dateKey = dayjs(s.date).format("DD/MM");
        if (!scoresByDate[dateKey]) {
          scoresByDate[dateKey] = [];
        }
        scoresByDate[dateKey].push({ testName: s.testName, score: s.score });
      });

      // 1. BẢNG ĐIỂM - Chỉ hiển thị những ngày có điểm
      let scoreTableRows = "";
      Object.entries(scoresByDate)
        .sort((a, b) => {
          const dateA = dayjs(a[0], "DD/MM");
          const dateB = dayjs(b[0], "DD/MM");
          return dateA.isBefore(dateB) ? -1 : 1;
        })
        .forEach(([date, dateScores]) => {
          const testNamesStr = dateScores.map(s => s.testName).join(", ");
          const scoresStr = dateScores.map(s => s.score).join(", ");

          scoreTableRows += `
            <tr>
              <td style="text-align: center;">${date}</td>
              <td style="text-align: left; font-size: 11px;">${testNamesStr}</td>
              <td style="text-align: center; font-weight: bold;">${scoresStr}</td>
            </tr>
          `;
        });

      // 2. LỊCH SỬ HỌC TẬP cho môn này (chuyên cần, không có điểm)
      let historyTableRows = "";
      sortedSessions.forEach((session) => {
        const studentRecord = session["Điểm danh"]?.find(
          (r) => r["Student ID"] === student.id
        );
        if (studentRecord) {
          const dateFormatted = dayjs(session["Ngày"]).format("DD/MM/YYYY");
          const className = session["Tên lớp"] || "-";
          const timeRange = `${session["Giờ bắt đầu"]} - ${session["Giờ kết thúc"]}`;
          const statusText = getStatusText(studentRecord);
          const statusColor = getStatusColor(studentRecord);
          const note = studentRecord["Ghi chú"] || "-";

          historyTableRows += `
            <tr>
              <td style="text-align: center;">${dateFormatted}</td>
              <td style="text-align: left;">${className}</td>
              <td style="text-align: center;">${timeRange}</td>
              <td style="text-align: center; color: ${statusColor}; font-weight: 500;">${statusText}</td>
              <td style="text-align: left; font-size: 10px;">${note}</td>
            </tr>
          `;
        }
      });

      // Combine: Subject Header → Score Table → Comment → History Table
      subjectContentsHTML += `
        <div class="subject-section" style="page-break-inside: avoid; margin-bottom: 25px;">
          <div class="subject-header">
            <span class="subject-name">📚 ${subject}</span>
            <span class="subject-avg">TB: <strong>${subjectAvg}</strong></span>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; color: #004aad; font-size: 12px; margin-bottom: 6px;">📊 Bảng điểm</div>
            <table class="score-table">
              <thead>
                <tr>
                  <th style="width: 80px;">Ngày</th>
                  <th style="width: auto;">Tên bài kiểm tra</th>
                  <th style="width: 80px;">Điểm</th>
                </tr>
              </thead>
              <tbody>
                ${scoreTableRows || '<tr><td colspan="3" style="text-align: center; color: #999;">Chưa có dữ liệu</td></tr>'}
              </tbody>
            </table>
          </div>

          ${subjectComment ? `
            <div style="background: rgba(240, 250, 235, 0.4); border-left: 4px solid rgba(82, 196, 26, 0.7); padding: 12px 15px; margin: 12px 0; border-radius: 4px;">
              <div style="font-weight: 600; font-size: 12px; color: #389e0d; margin-bottom: 6px;">📝 Nhận xét:</div>
              <div style="font-size: 11px; line-height: 1.6; color: #333; white-space: pre-wrap;">${subjectComment}</div>
            </div>
          ` : ''}

          <div style="margin-top: 12px;">
            <div style="font-weight: 600; color: #004aad; font-size: 12px; margin-bottom: 6px;">📚 Lịch sử học tập</div>
            <table class="history-table">
              <thead>
                <tr>
                  <th style="width: 80px;">Ngày</th>
                  <th>Lớp</th>
                  <th style="width: 90px;">Thời gian</th>
                  <th style="width: 90px;">Chuyên cần</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                ${historyTableRows || '<tr><td colspan="5" style="text-align: center; color: #999;">Chưa có dữ liệu</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Báo cáo học tập - ${student["Họ và tên"]}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              color: #333;
              line-height: 1.5;
              background: #fff;
              font-size: 12px;
            }
            .watermark-container { position: relative; }
            .watermark-logo {
              position: absolute; 
              top: 50%; 
              left: 50%;
              transform: translate(-50%, -50%);
              z-index: 0; 
              pointer-events: none;
            }
            .watermark-logo img {
              width: 600px; height: 600px;
              max-width: 80vw;
              object-fit: contain; opacity: 0.22; filter: grayscale(25%);
            }
            .report-content { position: relative; z-index: 1; }
            .header {
              text-align: center;
              border-bottom: 3px solid #004aad;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            .header h1 {
              color: #004aad;
              font-size: 22px;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .header p { color: #666; margin: 5px 0 0; font-size: 12px; }
            .section { margin-bottom: 18px; }
            .section-title {
              font-weight: bold;
              color: #004aad;
              border-left: 4px solid #004aad;
              padding-left: 10px;
              margin-bottom: 10px;
              font-size: 14px;
              text-transform: uppercase;
            }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; }
            th { background-color: #004aad; color: #fff; text-align: center; font-weight: 600; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            .info-table th { background: #f0f0f0; color: #333; text-align: left; width: 130px; }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 10px;
              margin-top: 10px;
            }
            .stat-card {
              border: 1px solid #ddd;
              border-radius: 6px;
              padding: 10px;
              text-align: center;
              background: #fafafa;
            }
            .stat-value { font-size: 20px; font-weight: bold; color: #004aad; }
            .stat-label { color: #666; font-size: 11px; margin-top: 3px; }
            .subject-section { margin-bottom: 15px; }
            .subject-header {
              background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
              padding: 8px 12px;
              border-left: 4px solid #1890ff;
              border-radius: 4px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 6px;
            }
            .subject-name { font-weight: bold; font-size: 13px; color: #004aad; }
            .subject-avg { font-size: 12px; color: #666; }
            .score-table th { background-color: #f5f5f5; color: #333; font-size: 11px; }
            .score-table td { font-size: 11px; }
            .history-table { margin-top: 10px; }
            .history-table th { background-color: #004aad; color: #fff; font-size: 11px; }
            .history-table td { font-size: 11px; }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #888;
              font-size: 11px;
              border-top: 1px solid #ccc;
              padding-top: 10px;
            }
            .classes-list {
              display: flex;
              flex-wrap: wrap;
              gap: 5px;
              margin-top: 5px;
            }
            .class-tag {
              background: #e6f7ff;
              color: #1890ff;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
            }
            @media print { 
              body { margin: 0; } 
              .no-print { display: none; }
              .watermark-logo {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 0;
                pointer-events: none;
              }
              .watermark-logo img {
                width: 650px;
                height: 650px;
                opacity: 0.25;
                filter: grayscale(25%);
              }
            }
          </style>
        </head>
        <body>
          <div class="watermark-container">
            <div class="watermark-logo">
              <img src="/img/logo.png" alt="Background Logo" />
            </div>
            <div class="report-content">
              <div class="header">
                <h1>BÁO CÁO CHI TIẾT THEO BUỔI HỌC</h1>
                <p>Ngày xuất: ${dayjs().format("DD/MM/YYYY HH:mm")}</p>
              </div>

              <div class="section">
                <div class="section-title">Thông tin học sinh</div>
                <table class="info-table">
                  <tr><th>Họ và tên</th><td><strong>${student["Họ và tên"]}</strong></td></tr>
                  <tr><th>Mã học sinh</th><td>${student["Mã học sinh"] || "-"}</td></tr>
                  <tr><th>Ngày sinh</th><td>${student["Ngày sinh"] ? dayjs(student["Ngày sinh"]).format("DD/MM/YYYY") : "-"}</td></tr>
                  <tr>
                    <th>Các lớp đang học</th>
                    <td>
                      <div class="classes-list">
                        ${uniqueClasses.map((name: string) => `<span class="class-tag">${name}</span>`).join("")}
                      </div>
                    </td>
                  </tr>
                  <tr><th>Số điện thoại</th><td>${student["Số điện thoại"] || "-"}</td></tr>
                  <tr><th>Email</th><td>${student["Email"] || "-"}</td></tr>
                </table>
              </div>

              <div class="section">
                <div class="section-title">Thống kê tổng quan</div>
                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-value">${stats.totalSessions}</div>
                    <div class="stat-label">Tổng số buổi</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-value" style="color: #52c41a;">${stats.presentSessions}</div>
                    <div class="stat-label">Số buổi có mặt</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-value" style="color: #ff4d4f;">${stats.absentSessions}</div>
                    <div class="stat-label">Số buổi vắng</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-value" style="color: #1890ff;">${attendanceRate}%</div>
                    <div class="stat-label">Tỷ lệ tham gia</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-value" style="color: #722ed1;">${averageScore}</div>
                    <div class="stat-label">Điểm trung bình</div>
                  </div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Chi tiết theo môn học</div>
                ${subjectContentsHTML || '<p style="color: #999; text-align: center;">Không có dữ liệu</p>'}
              </div>

              <div class="footer">
                <p>Báo cáo được tạo tự động từ hệ thống quản lý học sinh.</p>
                <p style="margin-top: 5px;">Mọi thắc mắc xin liên hệ giáo viên phụ trách.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handleExportScoreTable = () => {
    // Group sessions by subject
    const sessionsBySubject: { [subject: string]: AttendanceSession[] } = {};
    const sessionsToExport = viewMode === "monthly" && selectedMonth
      ? studentSessions.filter((session) => {
          const sessionDate = dayjs(session["Ngày"]);
          return (
            sessionDate.month() === selectedMonth.month() &&
            sessionDate.year() === selectedMonth.year()
          );
        })
      : studentSessions;

    sessionsToExport.forEach((session) => {
      const subject = session["Tên lớp"]?.split(" - ")[0] || "Chưa phân loại";
      if (!sessionsBySubject[subject]) {
        sessionsBySubject[subject] = [];
      }
      sessionsBySubject[subject].push(session);
    });

    // Generate HTML table with styling (Excel can open HTML files)
    let tablesHTML = "";
    Object.entries(sessionsBySubject).forEach(([subject, subjectSessions]) => {
      const sortedSessions = [...subjectSessions].sort(
        (a, b) => new Date(a["Ngày"]).getTime() - new Date(b["Ngày"]).getTime()
      );

      let tableRows = "";
      sortedSessions.forEach((session) => {
        const studentRecord = session["Điểm danh"]?.find(
          (r) => r["Student ID"] === student.id
        );
        
        if (studentRecord) {
          const date = dayjs(session["Ngày"]).format("DD/MM/YYYY");
          const studentName = student["Họ và tên"];
          const attendance = studentRecord["Có mặt"] 
            ? (studentRecord["Đi muộn"] ? "Đi muộn" : "Có mặt")
            : (studentRecord["Vắng có phép"] ? "Vắng có phép" : "Vắng");
          const homeworkPercent = studentRecord["% Hoàn thành BTVN"] ?? "";
          const testName = studentRecord["Bài kiểm tra"] || "";
          const score = studentRecord["Điểm kiểm tra"] ?? studentRecord["Điểm"] ?? "";
          const bonusScore = studentRecord["Điểm thưởng"] ?? "";
          const note = studentRecord["Ghi chú"] || "";

          tableRows += `
            <tr>
              <td>${date}</td>
              <td>${studentName}</td>
              <td>${attendance}</td>
              <td>${homeworkPercent}</td>
              <td>${testName}</td>
              <td style="font-weight: bold;">${score}</td>
              <td>${bonusScore}</td>
              <td style="text-align: left;">${note}</td>
            </tr>
          `;
        }
      });

      tablesHTML += `
        <tr>
          <td colspan="8" style="background: #e6f7ff; font-weight: bold; font-size: 14px; padding: 10px; border-left: 4px solid #1890ff;">
            Môn ${subject}
          </td>
        </tr>
        <tr style="background: #f0f0f0; font-weight: bold;">
          <td>Ngày</td>
          <td>Tên HS</td>
          <td>Chuyên cần</td>
          <td>% BTVN</td>
          <td>Tên bài kiểm tra</td>
          <td>Điểm</td>
          <td>Điểm thưởng</td>
          <td>Nhận xét</td>
        </tr>
        ${tableRows}
        <tr><td colspan="8" style="height: 20px;"></td></tr>
      `;
    });

    const htmlContent = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: center;
              font-size: 11px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .header h1 {
              color: #1890ff;
              font-size: 24px;
              margin: 10px 0;
            }
            .info {
              margin-bottom: 20px;
            }
            .info td {
              text-align: left;
              padding: 5px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BẢNG ĐIỂM CHI TIẾT</h1>
            <p><strong>Trung tâm Trí Tuệ 8+</strong></p>
          </div>
          
          <table class="info">
            <tr>
              <td style="width: 150px; font-weight: bold;">Học sinh:</td>
              <td>${student["Họ và tên"]}</td>
              <td style="width: 150px; font-weight: bold;">Mã học sinh:</td>
              <td>${student["Mã học sinh"] || "-"}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Ngày sinh:</td>
              <td>${student["Ngày sinh"] ? dayjs(student["Ngày sinh"]).format("DD/MM/YYYY") : "-"}</td>
              <td style="font-weight: bold;">Số điện thoại:</td>
              <td>${student["Số điện thoại"] || "-"}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Ngày xuất:</td>
              <td colspan="3">${dayjs().format("DD/MM/YYYY HH:mm")}</td>
            </tr>
          </table>
          
          <br/>
          
          <table>
            ${tablesHTML}
          </table>
        </body>
      </html>
    `;

    // Download as .xls file (HTML format that Excel can open)
    const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bang_diem_${student["Họ và tên"]}_${dayjs().format("YYYYMMDD")}.xls`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintScoreTable = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Filter sessions by selected month
    const sessionsToExport = viewMode === "monthly" && selectedMonth
      ? studentSessions.filter((session) => {
          const sessionDate = dayjs(session["Ngày"]);
          return (
            sessionDate.month() === selectedMonth.month() &&
            sessionDate.year() === selectedMonth.year()
          );
        })
      : studentSessions;

    // Group sessions by subject for history
    const sessionsBySubject: { [subject: string]: AttendanceSession[] } = {};
    sessionsToExport.forEach((session) => {
      const subject = session["Tên lớp"]?.split(" - ")[0] || "Chưa phân loại";
      if (!sessionsBySubject[subject]) {
        sessionsBySubject[subject] = [];
      }
      sessionsBySubject[subject].push(session);
    });

    // Get scores from Điểm_tự_nhập for selected month
    const allCustomScores = getAllScoresForStudent(student.id);
    const monthScoresFiltered = viewMode === "monthly" && selectedMonth
      ? allCustomScores.filter((s) => {
          if (!s.date) return false;
          const scoreDate = dayjs(s.date);
          return (
            scoreDate.month() === selectedMonth.month() &&
            scoreDate.year() === selectedMonth.year()
          );
        })
      : allCustomScores;

    // Group scores by className
    const scoresByClass: { [className: string]: typeof monthScoresFiltered } = {};
    monthScoresFiltered.forEach((score) => {
      const className = score.className?.split(" - ")[0] || score.className || "Chưa phân loại";
      if (!scoresByClass[className]) {
        scoresByClass[className] = [];
      }
      scoresByClass[className].push(score);
    });

    // Get all unique subjects
    const allSubjects = new Set([
      ...Object.keys(sessionsBySubject),
      ...Object.keys(scoresByClass),
    ]);

    // Build HTML grouped by subject
    let subjectContentsHTML = "";
    
    Array.from(allSubjects).forEach((subject) => {
      const subjectSessions = sessionsBySubject[subject] || [];
      const subjectScoresFromDB = scoresByClass[subject] || [];
      
      // Calculate subject average
      const subjectAvg = subjectScoresFromDB.length > 0
        ? (subjectScoresFromDB.reduce((sum, s) => sum + s.score, 0) / subjectScoresFromDB.length).toFixed(1)
        : "-";

      // Get comment for this subject
      const subjectComment = getClassComment(subject);

      // Build a map of date -> scores for this subject
      const scoresByDate: { [date: string]: Array<{ testName: string; score: number }> } = {};
      subjectScoresFromDB.forEach((s) => {
        const dateKey = dayjs(s.date).format("DD/MM/YYYY");
        if (!scoresByDate[dateKey]) {
          scoresByDate[dateKey] = [];
        }
        scoresByDate[dateKey].push({ testName: s.testName, score: s.score });
      });

      // Sort sessions by date
      const sortedSessions = [...subjectSessions].sort(
        (a, b) => new Date(a["Ngày"]).getTime() - new Date(b["Ngày"]).getTime()
      );

      // Build score table for this subject
      let scoreTableRows = "";
      Object.entries(scoresByDate)
        .sort((a, b) => {
          const dateA = dayjs(a[0], "DD/MM/YYYY");
          const dateB = dayjs(b[0], "DD/MM/YYYY");
          return dateA.isBefore(dateB) ? -1 : 1;
        })
        .forEach(([date, scores]) => {
          const testNames = scores.map((s) => s.testName).join(", ");
          const scoresStr = scores.map((s) => s.score).join(", ");
          
          scoreTableRows += `
            <tr>
              <td>${date}</td>
              <td style="text-align: left;">${testNames}</td>
              <td><strong>${scoresStr}</strong></td>
            </tr>
          `;
        });

      // Build history table for this subject
      let historyTableRows = "";
      sortedSessions.forEach((session) => {
        const studentRecord = session["Điểm danh"]?.find(
          (r) => r["Student ID"] === student.id
        );
        
        if (studentRecord) {
          const date = dayjs(session["Ngày"]).format("DD/MM/YYYY");
          const attendance = studentRecord["Có mặt"] 
            ? (studentRecord["Đi muộn"] ? "Đi muộn" : "Có mặt")
            : (studentRecord["Vắng có phép"] ? "Vắng có phép" : "Vắng");
          const homeworkPercent = studentRecord["% Hoàn thành BTVN"] ?? "-";
          const bonusScore = studentRecord["Điểm thưởng"] ?? "-";
          const note = studentRecord["Ghi chú"] || "-";

          historyTableRows += `
            <tr>
              <td>${date}</td>
              <td>${attendance}</td>
              <td>${homeworkPercent}</td>
              <td>${bonusScore}</td>
              <td style="text-align: left;">${note}</td>
            </tr>
          `;
        }
      });

      // Build this subject's section
      subjectContentsHTML += `
        <div class="subject-section">
          <div class="subject-header">Môn ${subject} <span style="float: right; font-size: 13px; color: #1890ff;">Điểm TB: ${subjectAvg}</span></div>
          
          <!-- Score Table -->
          <div class="section-title">📊 Bảng điểm</div>
          <table>
            <thead>
              <tr>
                <th style="width: 20%">Ngày</th>
                <th style="width: 50%">Tên bài kiểm tra</th>
                <th style="width: 30%">Điểm</th>
              </tr>
            </thead>
            <tbody>
              ${scoreTableRows || '<tr><td colspan="3">Chưa có điểm</td></tr>'}
            </tbody>
          </table>

          <!-- Comment -->
          ${subjectComment ? `
            <div class="comment-box">
              <div class="comment-title">📝 Nhận xét:</div>
              <div class="comment-content">${subjectComment}</div>
            </div>
          ` : ''}

          <!-- History Table -->
          <div class="section-title">📚 Lịch sử học tập</div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%">Ngày</th>
                <th style="width: 15%">Chuyên cần</th>
                <th style="width: 15%">% BTVN</th>
                <th style="width: 15%">Điểm thưởng</th>
                <th style="width: 40%">Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              ${historyTableRows || '<tr><td colspan="5">Chưa có lịch sử</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Báo cáo học tập - ${student["Họ và tên"]}</title>
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
              text-align: center;
              margin-bottom: 20px;
              color: #666;
            }
            .subject-section {
              page-break-inside: avoid;
              margin-bottom: 30px;
            }
            .subject-header {
              background: #e6f7ff;
              font-weight: bold;
              font-size: 14px;
              text-align: left;
              padding: 10px;
              margin-bottom: 15px;
              border-left: 4px solid #1890ff;
            }
            .section-title {
              font-weight: bold;
              font-size: 13px;
              color: #333;
              margin-top: 15px;
              margin-bottom: 8px;
              padding-left: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: center;
              font-size: 11px;
            }
            th {
              background: #f0f0f0;
              font-weight: bold;
            }
            .comment-box {
              background: rgba(240, 250, 235, 0.4);
              border-left: 4px solid rgba(82, 196, 26, 0.7);
              padding: 12px 15px;
              margin: 15px 0;
              border-radius: 4px;
            }
            .comment-title {
              font-weight: bold;
              font-size: 12px;
              color: #389e0d;
              margin-bottom: 6px;
            }
            .comment-content {
              font-size: 11px;
              line-height: 1.6;
              color: #333;
              white-space: pre-wrap;
            }
            @media print {
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <h1>BÁO CÁO HỌC TẬP CHI TIẾT</h1>
          <h2>Trung tâm Trí Tuệ 8+</h2>
          <div class="info">
            <p><strong>Học sinh:</strong> ${student["Họ và tên"]}</p>
            <p><strong>Kỳ báo cáo:</strong> ${viewMode === "monthly" && selectedMonth ? selectedMonth.format("Tháng MM/YYYY") : "Tất cả"}</p>
            <p>Ngày xuất: ${dayjs().format("DD/MM/YYYY HH:mm")}</p>
          </div>
          
          ${subjectContentsHTML}
          
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

  const handlePrint = () => {
    const printWindow = window.open("", "", "width=1000,height=800");
    if (!printWindow) return;

    // Generate full HTML content based on view mode
    let htmlContent = "";
    
    if (viewMode === "monthly") {
      htmlContent = generateMonthlyPrintContent();
    } else {
      htmlContent = generateSessionPrintContent();
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  return (
    <Modal
      title="Báo cáo học tập"
      open={open}
      onCancel={handleClose}
      width={1000}
      footer={[
        <Button key="close" onClick={handleClose}>
          Đóng
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
        >
          In báo cáo
        </Button>,
      ]}
    >
      <div ref={printRef} style={{ position: "relative", minHeight: 600 }}>
        {/* Watermark Logo */}
        <div
          style={{
            position: "absolute",
            top: 300,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 0,
            pointerEvents: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            src="/img/logo.png"
            alt="Watermark"
            style={{
              width: 450,
              height: 450,
              objectFit: "contain",
              opacity: 0.15,
              filter: "grayscale(20%)",
            }}
          />
        </div>
        
        {/* Report Content */}
        <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div
          className="header"
          style={{
            textAlign: "center",
            marginBottom: 24,
            borderBottom: "2px solid #1890ff",
            paddingBottom: 16,
          }}
        >
          <h1 style={{ color: "#1890ff", margin: 0 }}>BÁO CÁO HỌC TẬP</h1>
          <p style={{ margin: "8px 0 0 0", color: "#666" }}>
            Ngày xuất: {dayjs().format("DD/MM/YYYY HH:mm")}
          </p>
        </div>

        {/* Student Info */}
        <Card
          title="Thông tin học sinh"
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Descriptions column={2} size="small">
            <Descriptions.Item label="Họ và tên">
              <strong>{student["Họ và tên"]}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Mã học sinh">
              {student["Mã học sinh"] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày sinh">
              {student["Ngày sinh"]
                ? dayjs(student["Ngày sinh"]).format("DD/MM/YYYY")
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">
              {student["Số điện thoại"] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Email" span={2}>
              {student["Email"] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Địa chỉ" span={2}>
              {student["Địa chỉ"] || "-"}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* View Mode Selection */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>Chế độ xem:</div>
            <Radio.Group
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="session">
                📋 Báo cáo theo buổi (Chi tiết)
              </Radio.Button>
            </Radio.Group>
            
            {/* Month Picker - always visible for filtering */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <span style={{ fontWeight: 500 }}>Chọn tháng:</span>
              <DatePicker
                picker="month"
                value={selectedMonth}
                onChange={(date) => setSelectedMonth(date)}
                format="MM/YYYY"
                allowClear={false}
                style={{ width: 150 }}
              />
              <Button
                size="small"
                onClick={() => setSelectedMonth(dayjs())}
              >
                Tháng hiện tại
              </Button>
            </div>
          </Space>
        </Card>

        {/* Statistics */}
        <Card
          title={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Thống kê chuyên cần</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: "#666" }}>
                {selectedMonth ? selectedMonth.format("Tháng MM/YYYY") : "Tất cả"}
              </span>
            </div>
          }
          size="small"
          style={{ marginBottom: 16 }}
        >
          {(() => {
            // Filter sessions by selected month for statistics
            const filteredSessions = selectedMonth
              ? studentSessions.filter((session) => {
                  const sessionDate = dayjs(session["Ngày"]);
                  return (
                    sessionDate.month() === selectedMonth.month() &&
                    sessionDate.year() === selectedMonth.year()
                  );
                })
              : studentSessions;

            let presentCount = 0;
            let absentCount = 0;
            filteredSessions.forEach((session) => {
              const record = session["Điểm danh"]?.find(
                (r) => r["Student ID"] === student.id
              );
              if (record) {
                if (record["Có mặt"]) {
                  presentCount++;
                } else {
                  absentCount++;
                }
              }
            });

            // Calculate average score for selected month
            const allScores = getAllScoresForStudent(student.id);
            const monthScores = selectedMonth
              ? allScores.filter((s) => {
                  if (!s.date) return false;
                  const scoreDate = dayjs(s.date);
                  return (
                    scoreDate.month() === selectedMonth.month() &&
                    scoreDate.year() === selectedMonth.year()
                  );
                })
              : allScores;
            const avgScore = monthScores.length > 0
              ? (monthScores.reduce((sum, s) => sum + s.score, 0) / monthScores.length).toFixed(1)
              : "0";
            const attendanceRate = filteredSessions.length > 0
              ? Math.round((presentCount / filteredSessions.length) * 100)
              : 0;

            return (
              <Row gutter={16}>
                <Col span={4}>
                  <Statistic
                    title="Tổng số buổi"
                    value={filteredSessions.length}
                    prefix={<ClockCircleOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Số buổi có mặt"
                    value={presentCount}
                    valueStyle={{ color: "#3f8600" }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Số buổi vắng"
                    value={absentCount}
                    valueStyle={{ color: "#cf1322" }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Tỷ lệ tham gia"
                    value={attendanceRate}
                    suffix="%"
                    valueStyle={{ color: attendanceRate >= 80 ? "#3f8600" : attendanceRate >= 50 ? "#fa8c16" : "#cf1322" }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Điểm trung bình"
                    value={avgScore}
                    suffix="/ 10"
                    valueStyle={{ color: "#36797f" }}
                  />
                </Col>
              </Row>
            );
          })()}
        </Card>

        {/* Score Table by Subject */}
        <Card
          title={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Bảng điểm chi tiết</span>
              <Space>
                <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint()}>
                  In bảng điểm
                </Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleExportScoreTable()}>
                  Xuất Excel
                </Button>
              </Space>
            </div>
          }
          size="small" 
          style={{ marginBottom: 16 }}
        >
          {(() => {
            // Filter sessions by selected month
            const sessionsToShow = selectedMonth
              ? studentSessions.filter((session) => {
                  const sessionDate = dayjs(session["Ngày"]);
                  return (
                    sessionDate.month() === selectedMonth.month() &&
                    sessionDate.year() === selectedMonth.year()
                  );
                })
              : studentSessions;

            // Group sessions by subject for attendance
            const sessionsBySubject: { [subject: string]: AttendanceSession[] } = {};
            sessionsToShow.forEach((session) => {
              const subject = session["Tên lớp"]?.split(" - ")[0] || "Chưa phân loại";
              if (!sessionsBySubject[subject]) {
                sessionsBySubject[subject] = [];
              }
              sessionsBySubject[subject].push(session);
            });

            // Get scores from Điểm_tự_nhập for selected month
            const allCustomScores = getAllScoresForStudent(student.id);
            const monthScoresFiltered = selectedMonth
              ? allCustomScores.filter((s) => {
                  if (!s.date) return false;
                  const scoreDate = dayjs(s.date);
                  return (
                    scoreDate.month() === selectedMonth.month() &&
                    scoreDate.year() === selectedMonth.year()
                  );
                })
              : allCustomScores;

            // Group scores by className
            const scoresByClass: { [className: string]: typeof monthScoresFiltered } = {};
            monthScoresFiltered.forEach((score) => {
              const className = score.className?.split(" - ")[0] || score.className || "Chưa phân loại";
              if (!scoresByClass[className]) {
                scoresByClass[className] = [];
              }
              scoresByClass[className].push(score);
            });

            // Get all unique subjects
            const allSubjects = new Set([
              ...Object.keys(sessionsBySubject),
              ...Object.keys(scoresByClass),
            ]);

            if (allSubjects.size === 0) {
              return <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>Chưa có dữ liệu</div>;
            }

            return (
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {Array.from(allSubjects).map((subject) => {
                  const subjectSessions = sessionsBySubject[subject] || [];
                  const subjectScoresFromDB = scoresByClass[subject] || [];
                  
                  const sortedSessions = [...subjectSessions].sort(
                    (a, b) => new Date(a["Ngày"]).getTime() - new Date(b["Ngày"]).getTime()
                  );
                  
                  // Calculate subject average from Điểm_tự_nhập
                  const subjectAvg = subjectScoresFromDB.length > 0
                    ? (subjectScoresFromDB.reduce((sum, s) => sum + s.score, 0) / subjectScoresFromDB.length).toFixed(1)
                    : "-";
                  
                  // Get comment for this subject
                  const subjectComment = getClassComment(subject);

                  // Build a map of date -> scores for this subject
                  const scoresByDate: { [date: string]: Array<{ testName: string; score: number }> } = {};
                  subjectScoresFromDB.forEach((s) => {
                    const dateKey = dayjs(s.date).format("DD/MM/YYYY");
                    if (!scoresByDate[dateKey]) {
                      scoresByDate[dateKey] = [];
                    }
                    scoresByDate[dateKey].push({ testName: s.testName, score: s.score });
                  });

                  return (
                    <div key={subject} style={{ marginBottom: 24 }}>
                      <h4 style={{ 
                        background: "#e6f7ff", 
                        padding: "8px 12px", 
                        fontWeight: "bold",
                        marginBottom: "8px",
                        borderLeft: "4px solid #1890ff",
                        display: "flex",
                        justifyContent: "space-between"
                      }}>
                        <span>Môn {subject}</span>
                        <span style={{ fontSize: 12, color: "#1890ff" }}>Điểm TB: {subjectAvg}</span>
                      </h4>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ 
                          width: "100%", 
                          borderCollapse: "collapse",
                          fontSize: "12px"
                        }}>
                          <thead>
                            <tr style={{ background: "#f0f0f0" }}>
                              <th style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center" }}>Ngày</th>
                              <th style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center" }}>Tên bài kiểm tra</th>
                              <th style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center" }}>Điểm</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(scoresByDate).length === 0 ? (
                              <tr>
                                <td colSpan={3} style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center", color: "#999" }}>
                                  Chưa có điểm
                                </td>
                              </tr>
                            ) : (
                              Object.entries(scoresByDate)
                                .sort((a, b) => {
                                  const dateA = dayjs(a[0], "DD/MM/YYYY");
                                  const dateB = dayjs(b[0], "DD/MM/YYYY");
                                  return dateA.isBefore(dateB) ? -1 : 1;
                                })
                                .map(([dateFormatted, dateScores]) => (
                                  <tr key={dateFormatted}>
                                    <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center" }}>
                                      {dateFormatted}
                                    </td>
                                    <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "left" }}>
                                      {dateScores.map(s => s.testName).join(", ")}
                                    </td>
                                    <td style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center", fontWeight: "bold" }}>
                                      {dateScores.map(s => s.score).join(", ")}
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      {/* Subject Comment */}
                      {subjectComment && (
                        <div style={{
                          marginTop: 10,
                          padding: "12px 15px",
                          background: "rgba(240, 250, 235, 0.4)",
                          borderLeft: "4px solid rgba(82, 196, 26, 0.7)",
                          borderRadius: 4
                        }}>
                          <div style={{ fontWeight: "bold", fontSize: 13, color: "#389e0d", marginBottom: 6 }}>
                            📝 Nhận xét:
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.6, color: "#333", whiteSpace: "pre-wrap" }}>
                            {subjectComment}
                          </div>
                        </div>
                      )}

                      {/* Subject History - Lịch sử học tập cho môn này */}
                      <div style={{ marginTop: 16 }}>
                        <h5 style={{ 
                          fontSize: 13, 
                          fontWeight: "bold", 
                          color: "#004aad", 
                          marginBottom: 8,
                          paddingLeft: 5
                        }}>
                          📚 Lịch sử học tập
                        </h5>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ 
                            width: "100%", 
                            borderCollapse: "collapse",
                            fontSize: "11px"
                          }}>
                            <thead>
                              <tr style={{ background: "#004aad" }}>
                                <th style={{ border: "1px solid #d9d9d9", padding: "6px", textAlign: "center", color: "#fff" }}>Ngày</th>
                                <th style={{ border: "1px solid #d9d9d9", padding: "6px", textAlign: "center", color: "#fff" }}>Lớp</th>
                                <th style={{ border: "1px solid #d9d9d9", padding: "6px", textAlign: "center", color: "#fff" }}>Giờ học</th>
                                <th style={{ border: "1px solid #d9d9d9", padding: "6px", textAlign: "center", color: "#fff" }}>Trạng thái</th>
                                <th style={{ border: "1px solid #d9d9d9", padding: "6px", textAlign: "center", color: "#fff" }}>Ghi chú</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedSessions.length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ border: "1px solid #d9d9d9", padding: "8px", textAlign: "center", color: "#999" }}>
                                    Chưa có dữ liệu
                                  </td>
                                </tr>
                              ) : (
                                sortedSessions.map((session) => {
                                  const studentRecord = session["Điểm danh"]?.find(
                                    (r) => r["Student ID"] === student.id
                                  );
                                  if (!studentRecord) return null;

                                  const attendance = studentRecord["Có mặt"]
                                    ? studentRecord["Đi muộn"]
                                      ? "Đi muộn"
                                      : "Có mặt"
                                    : studentRecord["Vắng có phép"]
                                    ? "Vắng có phép"
                                    : "Vắng";

                                  const attendanceColor = studentRecord["Có mặt"]
                                    ? studentRecord["Đi muộn"]
                                      ? "#fa8c16"
                                      : "#52c41a"
                                    : studentRecord["Vắng có phép"]
                                    ? "#1890ff"
                                    : "#f5222d";

                                  return (
                                    <tr key={session.id}>
                                      <td style={{ border: "1px solid #d9d9d9", padding: "6px", textAlign: "center" }}>
                                        {dayjs(session["Ngày"]).format("DD/MM/YYYY")}
                                      </td>
                                      <td style={{ border: "1px solid #d9d9d9", padding: "6px", textAlign: "left" }}>
                                        {session["Tên lớp"] || "-"}
                                      </td>
                                      <td style={{ border: "1px solid #d9d9d9", padding: "6px", textAlign: "center" }}>
                                        {session["Giờ bắt đầu"]} - {session["Giờ kết thúc"]}
                                      </td>
                                      <td style={{ border: "1px solid #d9d9d9", padding: "6px", textAlign: "center", color: attendanceColor, fontWeight: 500 }}>
                                        {attendance}
                                      </td>
                                      <td style={{ border: "1px solid #d9d9d9", padding: "6px", textAlign: "left", fontSize: 10 }}>
                                        {studentRecord["Ghi chú"] || "-"}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Card>

        {/* Footer */}
        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 12,
            color: "#999",
          }}
        >
          <Divider />
          <p>Báo cáo này được tạo tự động từ hệ thống quản lý học sinh</p>
          <p>Mọi thắc mắc xin liên hệ với giáo viên hoặc ban quản lý</p>
        </div>
        </div>{/* End Report Content */}
      </div>
    </Modal>
  );
};

export default StudentReport;
