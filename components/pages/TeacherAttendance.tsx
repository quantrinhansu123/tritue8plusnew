import { useState, useEffect, useMemo } from "react";
import { Card, List, Tag, Button, Empty, Badge, Table, Select, DatePicker, Space, Popconfirm, message, Tabs } from "antd";
import { ClockCircleOutlined, CheckCircleOutlined, HistoryOutlined, DeleteOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { useClasses } from "../../hooks/useClasses";
import { useAuth } from "../../contexts/AuthContext";
import { Class, AttendanceSession } from "../../types";
import { useNavigate } from "react-router-dom";
import { ref, remove, get, update } from "firebase/database";
import { database } from "../../firebase";
import dayjs, { Dayjs } from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import WrapperContent from "@/components/WrapperContent";
import { subjectMap } from "@/utils/selectOptions";
import { supabaseGetAll, supabaseOnValue, supabaseRemove, convertFromSupabaseFormat } from "@/utils/supabaseHelpers";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

interface TimetableEntry {
  id: string;
  "Class ID": string;
  "Mã lớp": string;
  "Tên lớp": string;
  "Ngày": string;
  "Thứ": number;
  "Giờ bắt đầu": string;
  "Giờ kết thúc": string;
  "Phòng học"?: string;
  "Ghi chú"?: string;
  "Thay thế ngày"?: string; // Ngày gốc bị thay thế (dùng khi di chuyển lịch)
  "Thay thế thứ"?: number; // Thứ gốc bị thay thế
}

const TeacherAttendance = () => {
  const { userProfile } = useAuth();
  const { classes, loading } = useClasses();
  const navigate = useNavigate();
  const [teacherData, setTeacherData] = useState<any>(null);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  // Bug 5: Thêm state cho ngày điểm danh (cho phép điểm danh bù hôm trước)
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<Dayjs>(dayjs());
  
  // State cho tab "Điểm danh chi tiết"
  const [activeTab, setActiveTab] = useState<string>("main");
  const [allAttendanceSessions, setAllAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [detailFilterMonth, setDetailFilterMonth] = useState<number>(dayjs().month() + 1); // 1-12
  const [detailFilterYear, setDetailFilterYear] = useState<number>(dayjs().year());
  const [loadingDetailSessions, setLoadingDetailSessions] = useState(true);

  const isAdmin = userProfile?.isAdmin === true || userProfile?.role === "admin";
  const teacherId =
    teacherData?.id || userProfile?.teacherId || userProfile?.uid || "";

  // Load teacher data
  useEffect(() => {
    if (!userProfile?.email) return;

    const unsubscribe = supabaseOnValue("datasheet/Giáo_viên", (data) => {
      if (data) {
        const teacherEntry = Object.entries(data).find(
          ([_, teacher]: [string, any]) =>
            teacher.Email === userProfile.email ||
            teacher["Email công ty"] === userProfile.email
        );
        if (teacherEntry) {
          const [id, teacher] = teacherEntry;
          setTeacherData({ id, ...(teacher as any) });
        }
      }
    });
    return () => unsubscribe();
  }, [userProfile?.email]);

  // Load attendance sessions
  useEffect(() => {
    const unsubscribe = supabaseOnValue("datasheet/Điểm_danh_sessions", (data) => {
      if (data) {
        const sessionsList = Object.entries(data).map(([id, value]: [string, any]) => {
          const converted = convertFromSupabaseFormat(value, "diem_danh_sessions");
          return {
          id,
          ...converted,
        } as AttendanceSession;
        });
        setAttendanceSessions(sessionsList);
      } else {
        setAttendanceSessions([]);
      }
      setLoadingSessions(false);
    });

    return () => unsubscribe();
  }, []);

  // Load timetable entries from Thời_khoá_biểu (custom schedules)
  useEffect(() => {
    const unsubscribe = supabaseOnValue("datasheet/Thời_khoá_biểu", (data) => {
      if (data) {
        const entries = Object.entries(data).map(([id, value]: [string, any]) => {
          const converted = convertFromSupabaseFormat(value, "thoi_khoa_bieu");
          return {
          id,
          ...converted,
        } as TimetableEntry;
        });
        setTimetableEntries(entries);
      } else {
        setTimetableEntries([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load all attendance sessions from Supabase for "Điểm danh chi tiết" tab
  useEffect(() => {
    const loadDetailSessions = async () => {
      try {
        setLoadingDetailSessions(true);
        const data = await supabaseGetAll("datasheet/Điểm_danh_sessions");
        if (data) {
          const sessionsList = Object.entries(data).map(([id, value]: [string, any]) => {
            const converted = convertFromSupabaseFormat(value, "diem_danh_sessions");
            return {
              id,
              ...converted,
            } as AttendanceSession;
          });
          setAllAttendanceSessions(sessionsList);
        } else {
          setAllAttendanceSessions([]);
        }
      } catch (error) {
        console.error("Error loading detail sessions:", error);
        setAllAttendanceSessions([]);
      } finally {
        setLoadingDetailSessions(false);
      }
    };

    loadDetailSessions();

    // Subscribe to real-time updates
    const unsubscribe = supabaseOnValue("datasheet/Điểm_danh_sessions", (data) => {
      if (data) {
        const sessionsList = Object.entries(data).map(([id, value]: [string, any]) => {
          const converted = convertFromSupabaseFormat(value, "diem_danh_sessions");
          return {
            id,
            ...converted,
          } as AttendanceSession;
        });
        setAllAttendanceSessions(sessionsList);
      } else {
        setAllAttendanceSessions([]);
      }
      setLoadingDetailSessions(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Bug 5: Sử dụng ngày được chọn thay vì ngày hôm nay (cho phép điểm danh bù)
  const today = selectedAttendanceDate;
  const todayDayOfWeek = today.day() === 0 ? 8 : today.day() + 1; // Convert 0-6 to 2-8
  const todayDate = today.format("YYYY-MM-DD");
  const isToday = selectedAttendanceDate.format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD");

  // Helper: Check if a class has custom schedule for today (from Thời_khoá_biểu)
  const hasCustomScheduleToday = (classId: string): boolean => {
    return timetableEntries.some(
      (entry) => entry["Class ID"] === classId && entry["Ngày"] === todayDate
    );
  };

  // Helper: Check if default schedule has been replaced/moved to another day
  const isDefaultScheduleReplaced = (classId: string): boolean => {
    return timetableEntries.some(
      (entry) => 
        entry["Class ID"] === classId && 
        entry["Thay thế ngày"] === todayDate &&
        entry["Thay thế thứ"] === todayDayOfWeek
    );
  };

  // Helper: Get custom schedule for a class today
  const getCustomScheduleToday = (classId: string): TimetableEntry | undefined => {
    return timetableEntries.find(
      (entry) => entry["Class ID"] === classId && entry["Ngày"] === todayDate
    );
  };

  // Helper: Check if class has schedule for today (both default and custom)
  const hasScheduleToday = (classData: Class): boolean => {
    // Check custom schedule first
    if (hasCustomScheduleToday(classData.id)) {
      return true;
    }
    
    // Check default schedule (but only if not replaced/moved)
    if (isDefaultScheduleReplaced(classData.id)) {
      return false; // Default schedule was moved to another day
    }
    
    return classData["Lịch học"]?.some(
      (schedule) => schedule["Thứ"] === todayDayOfWeek
    ) || false;
  };

  // Helper: Get schedule time for a class today
  const getScheduleTimeToday = (classData: Class): string => {
    const customSchedule = getCustomScheduleToday(classData.id);
    if (customSchedule) {
      return customSchedule["Giờ bắt đầu"] || "";
    }
    const defaultSchedule = classData["Lịch học"]?.find((s) => s["Thứ"] === todayDayOfWeek);
    return defaultSchedule?.["Giờ bắt đầu"] || "";
  };

  // Filter classes - Admin sees all classes, teachers see only their classes
  const myClasses = classes.filter((c) => {
    // Admin can see all active classes
    if (isAdmin) {
      const startDate = c["Ngày bắt đầu"] ? dayjs(c["Ngày bắt đầu"]) : null;
      const endDate = c["Ngày kết thúc"] ? dayjs(c["Ngày kết thúc"]) : null;

      const isWithinDateRange =
        (!startDate || today.isSameOrAfter(startDate, "day")) &&
        (!endDate || today.isSameOrBefore(endDate, "day"));

      return isWithinDateRange && c["Trạng thái"] === "active";
    }
    
    // Teachers see only their classes
    const match = c["Teacher ID"] === teacherId;
    const startDate = c["Ngày bắt đầu"] ? dayjs(c["Ngày bắt đầu"]) : null;
    const endDate = c["Ngày kết thúc"] ? dayjs(c["Ngày kết thúc"]) : null;

    const isWithinDateRange =
      (!startDate || today.isSameOrAfter(startDate, "day")) &&
      (!endDate || today.isSameOrBefore(endDate, "day"));

    return match && isWithinDateRange && c["Trạng thái"] === "active";
  });

  // Get today's classes (classes that have schedule for today - including custom schedules)
  const todayClasses = myClasses
    .filter((c) => hasScheduleToday(c))
    .sort((a, b) => {
      // Sort by start time (use helper to get correct time from custom or default schedule)
      const aTime = getScheduleTimeToday(a);
      const bTime = getScheduleTimeToday(b);
      if (!aTime || !bTime) return 0;
      return aTime.localeCompare(bTime);
    });

  // Bug 6: Sửa logic otherClasses - Giáo viên xem lớp CỦA MÌNH không có lịch ngày được chọn (để điểm danh bù)
  const otherClasses = useMemo(() => {
    if (isAdmin) {
      // Admin: hiển thị tất cả lớp chưa có lịch hôm nay (có thể điểm danh bù cho bất kỳ lớp nào)
      return classes
        .filter((c) => {
          const isActive = c["Trạng thái"] === "active";
          const startDate = c["Ngày bắt đầu"] ? dayjs(c["Ngày bắt đầu"]) : null;
          const endDate = c["Ngày kết thúc"] ? dayjs(c["Ngày kết thúc"]) : null;
          const isWithinDateRange =
            (!startDate || today.isSameOrAfter(startDate, "day")) &&
            (!endDate || today.isSameOrBefore(endDate, "day"));
          
          // Lớp không có lịch ngày được chọn
          return !hasScheduleToday(c) && isActive && isWithinDateRange;
        })
        .filter((c) => !todayClasses.some((tc) => tc.id === c.id))
        .sort((a, b) => a["Tên lớp"].localeCompare(b["Tên lớp"]));
    } else {
      // Bug 6 FIX: Giáo viên xem lớp CỦA MÌNH (isMyClass) không có lịch ngày được chọn (để điểm danh bù)
      return classes
        .filter((c) => {
          const isMyClass = c["Teacher ID"] === teacherId; // Lớp CỦA giáo viên
          const isActive = c["Trạng thái"] === "active";
          const startDate = c["Ngày bắt đầu"] ? dayjs(c["Ngày bắt đầu"]) : null;
          const endDate = c["Ngày kết thúc"] ? dayjs(c["Ngày kết thúc"]) : null;
          const isWithinDateRange =
            (!startDate || today.isSameOrAfter(startDate, "day")) &&
            (!endDate || today.isSameOrBefore(endDate, "day"));
          
          // Lớp của tôi KHÔNG có lịch ngày được chọn (để điểm danh bù)
          return isMyClass && !hasScheduleToday(c) && isActive && isWithinDateRange;
        })
        .sort((a, b) => a["Tên lớp"].localeCompare(b["Tên lớp"]));
    }
  }, [classes, todayClasses, todayDayOfWeek, isAdmin, teacherId, today, timetableEntries]);

  const handleStartAttendance = (classData: Class) => {
    navigate(`/workspace/attendance/session/${classData.id}`, {
      state: { classData, date: todayDate },
    });
  };

  // Find existing session for a class today
  const findTodaySession = (classData: Class): AttendanceSession | null => {
    return attendanceSessions.find((session) => {
      const sessionDate = dayjs(session["Ngày"]);
      const sessionClassId = session["Class ID"] || session["Mã lớp"];
      return (
        sessionDate.format("YYYY-MM-DD") === todayDate &&
        (sessionClassId === classData.id || session["Mã lớp"] === classData["Mã lớp"])
      );
    }) || null;
  };

  // Delete attendance session and sync invoice
  const handleDeleteSession = async (classData: Class) => {
    const existingSession = findTodaySession(classData);
    if (!existingSession) {
      message.warning("Không tìm thấy buổi điểm danh để xóa");
      return;
    }

    try {
      // Xóa session
      await supabaseRemove("datasheet/Điểm_danh_sessions", existingSession.id);

      // Đồng bộ xóa invoice: giảm số buổi hoặc xóa invoice nếu không còn buổi nào
      const sessionDate = existingSession["Ngày"];
      const classId = existingSession["Class ID"] || classData.id;
      const attendanceRecords = existingSession["Điểm danh"] || [];
      const sessionDateObj = new Date(sessionDate);
      const targetMonth = sessionDateObj.getMonth();
      const targetYear = sessionDateObj.getFullYear();

      // Cập nhật invoice cho từng học sinh
      const invoiceUpdates: Promise<void>[] = [];
      for (const record of attendanceRecords) {
        const studentId = record["Student ID"];
        if (!studentId) continue;

        // Key format mới: studentId-classId-month-year
        const invoiceKey = `${studentId}-${classId}-${targetMonth}-${targetYear}`;
        const invoiceRef = ref(database, `datasheet/Phiếu_thu_học_phí/${invoiceKey}`);
        
        // Lấy invoice hiện tại
        const invoiceSnapshot = await get(invoiceRef);
        if (invoiceSnapshot.exists()) {
          const invoiceData = invoiceSnapshot.val();
          
          // Không sửa invoice đã thanh toán
          if (invoiceData.status === "paid") continue;

          const sessions = Array.isArray(invoiceData.sessions) ? invoiceData.sessions : [];
          const filteredSessions = sessions.filter((s: any) => s["Ngày"] !== sessionDate);
          
          if (filteredSessions.length === 0) {
            // Xóa invoice nếu không còn buổi nào
            invoiceUpdates.push(remove(invoiceRef));
          } else {
            // Cập nhật invoice với số buổi mới
            const pricePerSession = (invoiceData.totalAmount || 0) / (sessions.length || 1);
            const newTotalAmount = pricePerSession * filteredSessions.length;
            const newFinalAmount = Math.max(0, newTotalAmount - (invoiceData.discount || 0));
            invoiceUpdates.push(update(invoiceRef, {
              sessions: filteredSessions,
              totalSessions: filteredSessions.length,
              totalAmount: newTotalAmount,
              finalAmount: newFinalAmount,
            }));
          }
        }

        // Cũng kiểm tra key format cũ: studentId-month-year
        const oldInvoiceKey = `${studentId}-${targetMonth}-${targetYear}`;
        const oldInvoiceRef = ref(database, `datasheet/Phiếu_thu_học_phí/${oldInvoiceKey}`);
        const oldInvoiceSnapshot = await get(oldInvoiceRef);
        if (oldInvoiceSnapshot.exists()) {
          const invoiceData = oldInvoiceSnapshot.val();
          if (invoiceData.status === "paid") continue;

          const sessions = Array.isArray(invoiceData.sessions) ? invoiceData.sessions : [];
          const filteredSessions = sessions.filter((s: any) => !(s["Ngày"] === sessionDate && s["Class ID"] === classId));
          
          if (filteredSessions.length === 0) {
            invoiceUpdates.push(remove(oldInvoiceRef));
          } else {
            const pricePerSession = (invoiceData.totalAmount || 0) / (sessions.length || 1);
            const newTotalAmount = pricePerSession * filteredSessions.length;
            const newFinalAmount = Math.max(0, newTotalAmount - (invoiceData.discount || 0));
            invoiceUpdates.push(update(oldInvoiceRef, {
              sessions: filteredSessions,
              totalSessions: filteredSessions.length,
              totalAmount: newTotalAmount,
              finalAmount: newFinalAmount,
            }));
          }
        }
      }

      await Promise.all(invoiceUpdates);
      
      // Sync monthly reports - update stats for affected students
      const affectedStudentIds = attendanceRecords.map((r: any) => r["Student ID"]).filter(Boolean) as string[];
      if (affectedStudentIds.length > 0) {
        await syncMonthlyReportsAfterDelete(
          targetMonth,
          targetYear,
          classId,
          classData["Tên lớp"],
          affectedStudentIds
        );
      }
      
      message.success("Đã xóa buổi điểm danh và cập nhật hóa đơn");
    } catch (error) {
      console.error("Error deleting session:", error);
      message.error("Có lỗi xảy ra khi xóa buổi điểm danh");
    }
  };

  // Sync monthly reports when attendance is deleted
  const syncMonthlyReportsAfterDelete = async (
    targetMonth: number,
    targetYear: number,
    classId: string,
    className: string,
    affectedStudentIds: string[]
  ) => {
    if (affectedStudentIds.length === 0) return;

    try {
      const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;

      // Get all monthly reports
      const reportsData = await supabaseGetAll("datasheet/Nhận_xét_tháng");

      // Get all attendance sessions for recalculation
      const sessionsData = await supabaseGetAll("datasheet/Điểm_danh_sessions");
      
      const allSessions = sessionsData
        ? Object.entries(sessionsData).map(([id, value]: [string, any]) => {
            const converted = convertFromSupabaseFormat(value, "diem_danh_sessions");
            return {
              id,
              ...converted,
            };
          })
        : [];

      // Filter sessions for this month and class
      const monthSessions = allSessions.filter((s: any) => {
        const sessionDate = dayjs(s["Ngày"]);
        return sessionDate.month() === targetMonth &&
               sessionDate.year() === targetYear &&
               s["Class ID"] === classId;
      });

      const updatePromises: Promise<void>[] = [];

      // Find and update reports for affected students
      Object.entries(reportsData).forEach(([reportId, report]: [string, any]) => {
        if (report.month !== monthStr) return;
        if (!affectedStudentIds.includes(report.studentId)) return;
        if (report.status === "approved") return;
        if (!report.classIds?.includes(classId)) return;

        // Recalculate stats for this student in this class
        let totalSessions = 0;
        let presentSessions = 0;
        let absentSessions = 0;

        monthSessions.forEach((session: any) => {
          const record = session["Điểm danh"]?.find((r: any) => r["Student ID"] === report.studentId);
          if (record) {
            totalSessions++;
            if (record["Có mặt"] === true) {
              presentSessions++;
            } else {
              absentSessions++;
            }
          }
        });

        // Update classStats
        const updatedClassStats = (report.stats?.classStats || []).map((cs: any) => {
          if (cs.classId === classId) {
            return {
              ...cs,
              totalSessions,
              presentSessions,
              absentSessions,
              attendanceRate: totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0,
            };
          }
          return cs;
        });

        // Recalculate totals
        const newTotalSessions = updatedClassStats.reduce((sum: number, cs: any) => sum + (cs.totalSessions || 0), 0);
        const newPresentSessions = updatedClassStats.reduce((sum: number, cs: any) => sum + (cs.presentSessions || 0), 0);
        const newAbsentSessions = updatedClassStats.reduce((sum: number, cs: any) => sum + (cs.absentSessions || 0), 0);

        const updatedStats = {
          ...report.stats,
          totalSessions: newTotalSessions,
          presentSessions: newPresentSessions,
          absentSessions: newAbsentSessions,
          attendanceRate: newTotalSessions > 0 ? Math.round((newPresentSessions / newTotalSessions) * 100) : 0,
          classStats: updatedClassStats,
        };

        const reportRef = ref(database, `datasheet/Nhận_xét_tháng/${reportId}`);
        updatePromises.push(update(reportRef, {
          stats: updatedStats,
          updatedAt: new Date().toISOString(),
        }));
      });

      await Promise.all(updatePromises);
      console.log("[ReportSync] Synced monthly reports after delete", {
        classId,
        month: monthStr,
        affectedStudents: affectedStudentIds.length,
        reportsUpdated: updatePromises.length,
      });
    } catch (error) {
      console.error("[ReportSync] Failed to sync monthly reports", error);
    }
  };

  // Filter completed sessions by month and teacher
  const completedSessions = useMemo(() => {
    const monthStart = selectedMonth.startOf("month");
    const monthEnd = selectedMonth.endOf("month");

    return attendanceSessions
      .filter((session) => {
        // Only completed sessions
        if (session["Trạng thái"] !== "completed") return false;

        // Filter by date range
        const sessionDate = dayjs(session["Ngày"]);
        if (!sessionDate.isValid()) return false;
        if (!sessionDate.isSameOrAfter(monthStart, "day")) return false;
        if (!sessionDate.isSameOrBefore(monthEnd, "day")) return false;

        // Filter by teacher
        if (isAdmin) {
          // Admin sees all sessions
          return true;
        } else {
          // Teachers see only their sessions
          const sessionTeacherId = String(session["Teacher ID"] || "").trim();
          const normalizedTeacherId = String(teacherId || "").trim();
          const sessionTeacherName = String(session["Giáo viên"] || "").trim();
          const teacherName = teacherData ? (teacherData["Họ và tên"] || teacherData["Tên giáo viên"] || "") : "";
          const normalizedTeacherName = String(teacherName || "").trim();

          return (
            sessionTeacherId === normalizedTeacherId ||
            (normalizedTeacherName && sessionTeacherName === normalizedTeacherName)
          );
        }
      })
      .sort((a, b) => {
        const dateA = dayjs(a["Ngày"]);
        const dateB = dayjs(b["Ngày"]);
        if (dateA.isBefore(dateB)) return 1;
        if (dateA.isAfter(dateB)) return -1;
        return (a["Giờ bắt đầu"] || "").localeCompare(b["Giờ bắt đầu"] || "");
      });
  }, [attendanceSessions, selectedMonth, isAdmin, teacherId, teacherData]);

  // Get attendance count for a session
  const getAttendanceCount = (session: AttendanceSession) => {
    if (!session["Điểm danh"]) return { present: 0, total: 0 };
    
    const records = Array.isArray(session["Điểm danh"])
      ? session["Điểm danh"]
      : Object.values(session["Điểm danh"] || {});
    
    const present = records.filter((r: any) => r["Có mặt"] === true).length;
    return { present, total: records.length };
  };

  // Table columns for session history
  const sessionColumns = [
    {
      title: "Ngày",
      dataIndex: "Ngày",
      key: "date",
      width: 120,
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
      sorter: (a: AttendanceSession, b: AttendanceSession) => {
        const dateA = dayjs(a["Ngày"]);
        const dateB = dayjs(b["Ngày"]);
        return dateA.isBefore(dateB) ? -1 : dateA.isAfter(dateB) ? 1 : 0;
      },
    },
    {
      title: "Giờ học",
      key: "time",
      width: 120,
      render: (_: any, record: AttendanceSession) =>
        `${record["Giờ bắt đầu"] || "-"} - ${record["Giờ kết thúc"] || "-"}`,
    },
    {
      title: "Lớp học",
      dataIndex: "Tên lớp",
      key: "class",
      width: 200,
      render: (className: string, record: AttendanceSession) => (
        <Space direction="vertical" size={0}>
          <strong>{className}</strong>
          <Tag color="blue" style={{ fontSize: "11px" }}>
            {record["Mã lớp"] || "-"}
          </Tag>
        </Space>
      ),
    },
    {
      title: "Giáo viên",
      dataIndex: "Giáo viên",
      key: "teacher",
      width: 150,
    },
    {
      title: "Có mặt",
      key: "attendance",
      width: 100,
      align: "center" as const,
      render: (_: any, record: AttendanceSession) => {
        const { present, total } = getAttendanceCount(record);
        return (
          <Tag color={present === total ? "green" : present > 0 ? "orange" : "red"}>
            {present}/{total}
          </Tag>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "Trạng thái",
      key: "status",
      width: 120,
      render: (status: string) => (
        <Tag color={status === "completed" ? "green" : "default"}>
          {status === "completed" ? "Hoàn thành" : status}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 180,
      render: (_: any, record: AttendanceSession) => (
        <Space size="small">
          <Button
            size="small"
            onClick={() => {
              navigate(`/workspace/classes/${record["Class ID"]}/history`);
            }}
          >
            Xem chi tiết
          </Button>
          <Popconfirm
            title="Xóa buổi điểm danh"
            description="Bạn có chắc chắn muốn xóa buổi điểm danh này? (Lớp nghỉ)"
            onConfirm={async () => {
              try {
                await supabaseRemove("datasheet/Điểm_danh_sessions", record.id);
                message.success("Đã xóa buổi điểm danh");
              } catch (error) {
                console.error("Error deleting session:", error);
                message.error("Có lỗi xảy ra khi xóa buổi điểm danh");
              }
            }}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Filter sessions for detail tab by month/year
  const filteredDetailSessions = useMemo(() => {
    return allAttendanceSessions.filter((session) => {
      if (!session["Ngày"]) return false;
      
      try {
        // Parse date from DD/MM/YYYY or ISO format
        let sessionDate: Date;
        const dateStr = session["Ngày"];
        
        // Try DD/MM/YYYY format first
        const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyyMatch) {
          const day = parseInt(ddmmyyyyMatch[1], 10);
          const month = parseInt(ddmmyyyyMatch[2], 10);
          const year = parseInt(ddmmyyyyMatch[3], 10);
          sessionDate = new Date(year, month - 1, day);
        } else {
          sessionDate = new Date(dateStr);
        }
        
        if (isNaN(sessionDate.getTime())) return false;
        
        const sessionMonth = sessionDate.getMonth() + 1; // 1-12
        const sessionYear = sessionDate.getFullYear();
        
        return sessionMonth === detailFilterMonth && sessionYear === detailFilterYear;
      } catch (error) {
        return false;
      }
    });
  }, [allAttendanceSessions, detailFilterMonth, detailFilterYear]);

  // Columns for detail table
  const detailColumns = [
    {
      title: "Ngày",
      dataIndex: "Ngày",
      key: "Ngày",
      width: 120,
      render: (text: string) => {
        try {
          const dateStr = text;
          const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (ddmmyyyyMatch) {
            return text;
          }
          return dayjs(text).format("DD/MM/YYYY");
        } catch {
          return text;
        }
      },
    },
    {
      title: "Tên lớp",
      dataIndex: "Tên lớp",
      key: "Tên lớp",
      width: 150,
    },
    {
      title: "Mã lớp",
      dataIndex: "Mã lớp",
      key: "Mã lớp",
      width: 100,
    },
    {
      title: "Môn học",
      dataIndex: "Môn học",
      key: "Môn học",
      width: 120,
      render: (text: string) => subjectMap[text] || text,
    },
    {
      title: "Giờ bắt đầu",
      dataIndex: "Giờ bắt đầu",
      key: "Giờ bắt đầu",
      width: 100,
    },
    {
      title: "Giờ kết thúc",
      dataIndex: "Giờ kết thúc",
      key: "Giờ kết thúc",
      width: 100,
    },
    {
      title: "Giáo viên",
      dataIndex: "Giáo viên",
      key: "Giáo viên",
      width: 150,
    },
    {
      title: "Số học sinh",
      key: "soHocSinh",
      width: 100,
      render: (_: any, record: AttendanceSession) => {
        const attendance = record["Điểm danh"];
        if (Array.isArray(attendance)) {
          return attendance.length;
        } else if (attendance && typeof attendance === "object") {
          return Object.keys(attendance).length;
        }
        return 0;
      },
    },
    {
      title: "Thao tác",
      key: "action",
      width: 150,
      render: (_: any, record: AttendanceSession) => (
        <Space size="small">
          <Button
            size="small"
            onClick={() => {
              const classId = record["Class ID"];
              if (classId) {
                navigate(`/workspace/classes/${classId}/history`);
              }
            }}
          >
            Xem chi tiết
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <WrapperContent title="Điểm danh" isLoading={loading}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "main",
            label: "Điểm danh",
            children: (
              <>
      {/* Bug 5: Thêm DatePicker cho phép chọn ngày điểm danh bù */}
      <Card size="small" style={{ marginBottom: 16, background: isToday ? "#f6ffed" : "#fffbe6" }}>
        <Space wrap>
          <span style={{ fontWeight: 600 }}>
            {isToday ? "📅 Hôm nay:" : "📅 Ngày điểm danh:"}
          </span>
          <DatePicker
            value={selectedAttendanceDate}
            onChange={(date) => date && setSelectedAttendanceDate(date)}
            format="DD/MM/YYYY (dddd)"
            allowClear={false}
            disabledDate={(current) => current && current > dayjs().endOf('day')}
            style={{ minWidth: 200 }}
          />
          {!isToday && (
            <>
              <Tag color="orange">Điểm danh bù</Tag>
              <Button 
                type="link" 
                size="small"
                onClick={() => setSelectedAttendanceDate(dayjs())}
              >
                Về hôm nay
              </Button>
            </>
          )}
        </Space>
      </Card>

      <p style={{ color: "#666", marginBottom: 24 }}>
        {isToday ? `Hôm nay: ${today.format("dddd, DD/MM/YYYY")}` : `Ngày đã chọn: ${today.format("dddd, DD/MM/YYYY")}`}
      </p>

      {todayClasses.length > 0 && (
        <Card
          title={
            <span>
              <Badge status="processing" />
              Lớp học hôm nay ({todayClasses.length})
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          <List
            dataSource={todayClasses}
            renderItem={(classData) => {
              const todaySchedule = classData["Lịch học"]?.find(
                (s) => s["Thứ"] === todayDayOfWeek
              );
              const existingSession = findTodaySession(classData);
              return (
                <List.Item
                  actions={[
                    <Space key="actions">
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleStartAttendance(classData)}
                      >
                        Điểm danh
                      </Button>
                      {existingSession && (
                        <Popconfirm
                          title="Xóa buổi điểm danh"
                          description="Bạn có chắc chắn muốn xóa buổi điểm danh này? (Lớp nghỉ)"
                          onConfirm={() => handleDeleteSession(classData)}
                          okText="Xóa"
                          cancelText="Hủy"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                          >
                            Xóa điểm danh
                          </Button>
                        </Popconfirm>
                      )}
                    </Space>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span>
                        {classData["Tên lớp"]}
                        <Tag color="blue" style={{ marginLeft: 8 }}>
                          {subjectMap[classData["Môn học"]] ||
                            classData["Môn học"]}
                        </Tag>
                        {existingSession && (
                          <Tag color="orange" style={{ marginLeft: 8 }}>
                            Đã điểm danh
                          </Tag>
                        )}
                      </span>
                    }
                    description={
                      <div>
                        <div>
                          <ClockCircleOutlined />{" "}
                          {todaySchedule?.["Giờ bắt đầu"]} -{" "}
                          {todaySchedule?.["Giờ kết thúc"]}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          {isAdmin && (
                            <div style={{ marginBottom: 4 }}>
                              Giáo viên: {classData["Giáo viên chủ nhiệm"]}
                            </div>
                          )}
                          Số học sinh: {classData["Student IDs"]?.length || 0}
                        </div>
                        {existingSession && (
                          <div style={{ marginTop: 4, fontSize: "12px", color: "#999" }}>
                            Đã điểm danh lúc: {dayjs(existingSession["Thời gian điểm danh"] || existingSession["Timestamp"]).format("HH:mm DD/MM/YYYY")}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Card>
      )}

      {otherClasses.length > 0 && (
        <Card title={
          isAdmin 
            ? `Lớp khác không có lịch (${otherClasses.length})`
            : `Lớp của tôi - Điểm danh bù (${otherClasses.length})`
        }>
          <List
            dataSource={otherClasses}
            renderItem={(classData) => {
              const todaySchedule = classData["Lịch học"]?.find(
                (s) => s["Thứ"] === todayDayOfWeek
              );
              const existingSession = findTodaySession(classData);
              return (
                <List.Item
                  actions={[
                    <Space key="actions">
                      <Button onClick={() => handleStartAttendance(classData)}>
                        Điểm danh
                      </Button>
                      {existingSession && (
                        <Popconfirm
                          title="Xóa buổi điểm danh"
                          description="Bạn có chắc chắn muốn xóa buổi điểm danh này? (Lớp nghỉ)"
                          onConfirm={() => handleDeleteSession(classData)}
                          okText="Xóa"
                          cancelText="Hủy"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                          >
                            Xóa điểm danh
                          </Button>
                        </Popconfirm>
                      )}
                    </Space>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span>
                        {classData["Tên lớp"]}
                        <Tag color="default" style={{ marginLeft: 8 }}>
                          {subjectMap[classData["Môn học"]] ||
                            classData["Môn học"]}
                        </Tag>
                        {existingSession && (
                          <Tag color="orange" style={{ marginLeft: 8 }}>
                            Đã điểm danh
                          </Tag>
                        )}
                      </span>
                    }
                    description={
                      <div>
                        {todaySchedule && (
                          <div style={{ marginBottom: 4 }}>
                            <ClockCircleOutlined />{" "}
                            {todaySchedule["Giờ bắt đầu"]} -{" "}
                            {todaySchedule["Giờ kết thúc"]}
                          </div>
                        )}
                        {isAdmin && (
                          <div style={{ marginBottom: 4 }}>
                            Giáo viên: {classData["Giáo viên chủ nhiệm"]}
                          </div>
                        )}
                        <div>Số học sinh: {classData["Student IDs"]?.length || 0}</div>
                        {existingSession && (
                          <div style={{ marginTop: 4, fontSize: "12px", color: "#999" }}>
                            Đã điểm danh lúc: {dayjs(existingSession["Thời gian điểm danh"] || existingSession["Timestamp"]).format("HH:mm DD/MM/YYYY")}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Card>
      )}

      {myClasses.length === 0 && !loading && (
        <Empty 
          description={
            isAdmin 
              ? "Chưa có lớp học nào đang hoạt động" 
              : "Bạn chưa được phân công lớp học nào"
          } 
        />
      )}

      {/* Session History Section - Always visible */}
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>Lịch sử các buổi học chính thức</span>
          </Space>
        }
        style={{ marginTop: 24 }}
        extra={
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={(date) => setSelectedMonth(date || dayjs())}
            format="MM/YYYY"
            allowClear={false}
            style={{ width: 150 }}
          />
        }
      >
        {loadingSessions ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Empty description="Đang tải dữ liệu..." />
          </div>
        ) : (
          <Table
            columns={sessionColumns}
            dataSource={completedSessions}
            rowKey="id"
            loading={false}
            pagination={{
              pageSize: 10,
              showTotal: (total) => `Tổng ${total} buổi học`,
            }}
            locale={{
              emptyText: (
                <Empty
                  description={`Không có buổi học nào trong tháng ${selectedMonth.format("MM/YYYY")}`}
                />
              ),
            }}
          />
        )}
      </Card>
              </>
            ),
          },
          {
            key: "detail",
            label: (
              <span>
                <UnorderedListOutlined />
                Điểm danh chi tiết
              </span>
            ),
            children: (
              <Card>
                <Space direction="vertical" style={{ width: "100%" }} size="large">
                  <Space>
                    <span>Tháng:</span>
                    <Select
                      value={detailFilterMonth}
                      onChange={setDetailFilterMonth}
                      style={{ width: 120 }}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <Select.Option key={i + 1} value={i + 1}>
                          Tháng {i + 1}
                        </Select.Option>
                      ))}
                    </Select>
                    <span>Năm:</span>
                    <Select
                      value={detailFilterYear}
                      onChange={setDetailFilterYear}
                      style={{ width: 120 }}
                    >
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = dayjs().year() - 2 + i;
                        return (
                          <Select.Option key={year} value={year}>
                            {year}
                          </Select.Option>
                        );
                      })}
                    </Select>
                  </Space>
                  <Table
                    columns={detailColumns}
                    dataSource={filteredDetailSessions}
                    rowKey="id"
                    loading={loadingDetailSessions}
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showTotal: (total) => `Tổng ${total} buổi điểm danh`,
                    }}
                    locale={{
                      emptyText: (
                        <Empty
                          description={`Không có buổi điểm danh nào trong tháng ${detailFilterMonth}/${detailFilterYear}`}
                        />
                      ),
                    }}
                  />
                </Space>
              </Card>
            ),
          },
        ]}
      />
    </WrapperContent>
  );
};

export default TeacherAttendance;
