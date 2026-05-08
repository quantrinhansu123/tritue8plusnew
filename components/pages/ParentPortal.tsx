import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
// Firebase imports removed since we migrated to Supabase Helper functions
import {
  supabaseOnValue,
  convertFromSupabaseFormat,
  supabaseGetAll,
  supabaseGetById,
} from "@/utils/supabaseHelpers";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Typography,
  Spin,
  Empty,
  Tabs,
  Timeline,
  Progress,
  List,
  Badge,
  Descriptions,
  Button,
  Space,
  Calendar,
  Modal,
  DatePicker,
  Collapse,
} from "antd";
import type { Dayjs } from "dayjs";
import {
  UserOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  CalendarOutlined,
  FileTextOutlined,
  HomeOutlined,
  EditOutlined,
  DollarOutlined,
  BarChartOutlined,
  DownloadOutlined,
  GiftOutlined,
  StarOutlined,
  PaperClipOutlined,
  FolderOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
// Bug 10: Import subjectMap để dịch tên môn học
import { subjectMap } from "@/utils/selectOptions";

const { Title, Text, Paragraph } = Typography;

const ParentPortal: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, currentUser, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [redeemHistory, setRedeemHistory] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs | null>(dayjs());
  const [currentWeekStart, setCurrentWeekStart] = useState<Dayjs>(
    dayjs().startOf("isoWeek")
  );
  const [selectedScheduleEvent, setSelectedScheduleEvent] = useState<any>(null);
  const [scheduleDetailModalOpen, setScheduleDetailModalOpen] = useState(false);
  const [redeemHistoryModalOpen, setRedeemHistoryModalOpen] = useState(false);
  const [rooms, setRooms] = useState<Map<string, any>>(new Map());
  const [customScoresData, setCustomScoresData] = useState<any>({}); // Điểm tự nhập từ các lớp


  // Hour slots for timeline view (6:00 - 22:00)
  const HOUR_SLOTS = Array.from({ length: 17 }, (_, i) => {
    const hour = i + 6;
    return {
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
      start: `${hour.toString().padStart(2, '0')}:00`,
      end: `${(hour + 1).toString().padStart(2, '0')}:00`,
    };
  });

  // Check authentication
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !userProfile) {
        navigate("/login");
        return;
      }
      
      if (userProfile.role !== "parent") {
        navigate("/workspace");
        return;
      }
    }
  }, [authLoading, currentUser, userProfile, navigate]);

  // Load student data
  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.studentId) {
        console.warn("⚠️ No studentId in userProfile:", userProfile);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log("📥 Fetching data for studentId:", userProfile.studentId);

        // Fetch student info
        const studentData = await supabaseGetById("datasheet/Học_sinh", userProfile.studentId, true);
        console.log("✅ Student data fetched:", studentData);
        
        if (!studentData) {
          console.error("❌ Student data is null or undefined");
          Modal.error({
            title: "Lỗi tải dữ liệu",
            content: "Không tìm thấy thông tin học sinh. Vui lòng liên hệ với trung tâm.",
          });
          setLoading(false);
          return;
        }
        
        // Check if student status is "Hủy" (cancelled)
        if (studentData?.["Trạng thái"] === "Hủy") {
          Modal.error({
            title: "Không thể truy cập",
            content: "Tài khoản học sinh đã bị hủy. Vui lòng liên hệ với trung tâm để biết thêm chi tiết.",
            onOk: async () => {
              await signOut();
              navigate("/login");
            },
          });
          setLoading(false);
          return;
        }
        
        setStudent(studentData);

        // Fetch all classes
        const classesData = await supabaseGetAll("datasheet/Lớp_học");
        if (classesData) {
          const studentClasses = Object.entries(classesData)
            .filter(([id, cls]: [string, any]) =>
              cls["Student IDs"]?.includes(userProfile.studentId)
            )
            .map(([id, cls]: [string, any]) => ({ id, ...cls }));
          console.log("✅ Classes fetched:", studentClasses.length, "classes");
          setClasses(studentClasses);
        } else {
          console.warn("⚠️ No classes data found");
          setClasses([]);
        }

        // Fetch attendance sessions
        const sessionsData = await supabaseGetAll("datasheet/Điểm_danh_sessions");
        if (sessionsData) {
          const studentSessions = Object.entries(sessionsData)
            .filter(([id, session]: [string, any]) =>
              session["Điểm danh"]?.some(
                (r: any) => r["Student ID"] === userProfile.studentId
              )
            )
            .map(([id, session]: [string, any]) => ({ id, ...session }));
          setAttendanceSessions(studentSessions);
        }

        // Fetch redeem history
        const redeemData = await supabaseGetAll("datasheet/Đổi_thưởng");
        if (redeemData) {
          const studentRedeems = Object.entries(redeemData)
            .filter(([id, redeem]: [string, any]) =>
              redeem["Student ID"] === userProfile.studentId
            )
            .map(([id, redeem]: [string, any]) => ({ id, ...redeem }));
          setRedeemHistory(studentRedeems);
        } else {
          setRedeemHistory([]);
        }

        // Fetch invoices
        const invoicesData = await supabaseGetAll("datasheet/Phiếu_thu_học_phí");
        if (invoicesData) {
          const studentInvoices = Object.entries(invoicesData)
            .filter(([id, invoice]: [string, any]) =>
              invoice.student_id === userProfile.studentId || 
              invoice.studentId === userProfile.studentId ||
              id.startsWith(`${userProfile.studentId}-`)
            )
            .map(([id, invoice]: [string, any]) => ({ id, ...invoice }))
            .sort((a, b) => b.year - a.year || b.month - a.month);
          setInvoices(studentInvoices);
        }

        // Fetch schedule events
        const scheduleData = await supabaseGetAll("datasheet/Thời_khoá_biểu");
        if (scheduleData) {
          const studentSchedule = Object.entries(scheduleData)
            .filter(([id, event]: [string, any]) =>
              event["Student IDs"]?.includes(userProfile.studentId)
            )
            .map(([id, event]: [string, any]) => ({ id, ...event }));
          setScheduleEvents(studentSchedule);
        }

        // Fetch custom scores (Điểm tự nhập) for all classes student is in
        const customScoresAllData = await supabaseGetAll("datasheet/Điểm_tự_nhập");
        if (customScoresAllData && classesData) {
          // Get class IDs that student belongs to
          const studentClassIds = Object.entries(classesData || {})
            .filter(([id, cls]: [string, any]) =>
              cls["Student IDs"]?.includes(userProfile.studentId)
            )
            .map(([id]) => id);
          
          // Filter custom scores for student's classes
          const studentCustomScores: any = {};
          studentClassIds.forEach(classId => {
            if (customScoresAllData[classId]) {
              studentCustomScores[classId] = customScoresAllData[classId];
            }
          });
          setCustomScoresData(studentCustomScores);
        }

        setLoading(false);
        console.log("✅ All data loaded successfully from Supabase");
      } catch (error) {
        console.error("❌ Error fetching data:", error);
        Modal.error({
          title: "Lỗi tải dữ liệu",
          content: `Không thể tải thông tin. Vui lòng thử lại sau. Lỗi: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
        setLoading(false);
      }
    };

    if (userProfile) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [userProfile, navigate, signOut]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSessions = attendanceSessions.length;
    let attendedSessions = 0;
    let lateSessions = 0;
    let totalBonusPoints = 0;
    let redeemedBonusPoints = 0;

    // Track attendance from sessions
    attendanceSessions.forEach((session) => {
      const record = session["Điểm danh"]?.find(
        (r: any) => r["Student ID"] === userProfile?.studentId
      );

      if (record) {
        if (record["Có mặt"]) attendedSessions++;
        if (record["Đi muộn"]) lateSessions++;
        // Tính tổng điểm thưởng
        if (record["Điểm thưởng"] !== null && record["Điểm thưởng"] !== undefined) {
          totalBonusPoints += record["Điểm thưởng"];
        }
      }
    });

    // Calculate average score from custom scores (Điểm tự nhập) - SINGLE SOURCE OF TRUTH
    // This is the official grade book
    let totalScore = 0;
    let scoreCount = 0;

    // ONLY get scores from Điểm_tự_nhập - không đọc từ sessions nữa
    Object.entries(customScoresData).forEach(([classId, classScores]: [string, any]) => {
      if (!classScores?.columns || !classScores?.scores) return;
      
      const studentScore = classScores.scores.find(
        (s: any) => s.studentId === userProfile?.studentId
      );
      
      if (studentScore) {
        classScores.columns.forEach((columnName: string) => {
          const scoreValue = studentScore[columnName];
          if (scoreValue !== null && scoreValue !== undefined && scoreValue !== "" && !isNaN(Number(scoreValue))) {
            totalScore += Number(scoreValue);
            scoreCount++;
          }
        });
      }
    });

    // ✅ FIX: Tính tổng điểm đã đổi thưởng từ bảng Đổi_thưởng
    redeemHistory.forEach((redeem) => {
      const points = Number(redeem["Điểm đổi"] || 0);
      redeemedBonusPoints += points;
    });

    const attendanceRate =
      totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 0;
    const averageScore = scoreCount > 0 ? totalScore / scoreCount : 0;

    return {
      totalSessions,
      attendedSessions,
      lateSessions,
      absentSessions: totalSessions - attendedSessions,
      attendanceRate,
      averageScore,
      scoredSessions: scoreCount,
      totalBonusPoints,
      redeemedBonusPoints,
    };
  }, [attendanceSessions, customScoresData, redeemHistory, userProfile]);

  // Recent sessions
  const recentSessions = useMemo(() => {
    return attendanceSessions
      .sort((a, b) => new Date(b["Ngày"]).getTime() - new Date(a["Ngày"]).getTime())
      .slice(0, 10);
  }, [attendanceSessions]);

  // Combine scores from custom scores (Điểm tự nhập) - this is the PRIMARY source
  // Custom scores already includes scores from sessions that were properly synced
  const allScoresData = useMemo(() => {
    const scores: any[] = [];
    const addedScoreKeys = new Set<string>(); // Track unique scores by classId + columnName

    // 1. ONLY read from custom scores (Điểm tự nhập) - SINGLE SOURCE OF TRUTH
    // This is the official grade book that teachers manage
    Object.entries(customScoresData).forEach(([classId, classScores]: [string, any]) => {
      if (!classScores?.columns || !classScores?.scores) return;
      
      const classInfo = classes.find(c => c.id === classId);
      const className = classInfo?.["Tên lớp"] || "-";
      
      // Find this student's scores
      const studentScore = classScores.scores.find(
        (s: any) => s.studentId === userProfile?.studentId
      );
      
      if (studentScore) {
        classScores.columns.forEach((columnName: string) => {
          const scoreValue = studentScore[columnName];
          
          if (scoreValue !== null && scoreValue !== undefined && scoreValue !== "") {
            // Extract date from column name: "Tên bài (DD-MM-YYYY)"
            const dateMatch = columnName.match(/\((\d{2}-\d{2}-\d{4})\)$/);
            let dateStr = "";
            let testName = columnName;
            
            if (dateMatch) {
              const [day, month, year] = dateMatch[1].split("-");
              dateStr = `${year}-${month}-${day}`;
              testName = columnName.replace(/\s*\(\d{2}-\d{2}-\d{4}\)$/, "").trim();
            }
            
            const scoreKey = `${classId}-${columnName}`;
            if (!addedScoreKeys.has(scoreKey)) {
              addedScoreKeys.add(scoreKey);
              scores.push({
                id: `custom-${scoreKey}`,
                date: dateStr || "",
                className,
                classId,
                testName: testName || columnName,
                score: Number(scoreValue),
                note: "-",
                source: "custom",
              });
            }
          }
        });
      }
    });

    // Sort by date descending (empty dates go to the end)
    return scores.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [customScoresData, classes, userProfile?.studentId]);

  // Load rooms
  useEffect(() => {
    const unsubscribe = supabaseOnValue("datasheet/Phòng_học", (data) => {
      if (data) {
        const converted = convertFromSupabaseFormat(data, "phong_hoc");
        const roomsMap = new Map<string, any>();
        Object.entries(converted as Record<string, any>).forEach(([id, value]) => {
          roomsMap.set(id, { id, ...(value as any) });
        });
        setRooms(roomsMap);
      } else {
        setRooms(new Map());
      }
    });
    return () => unsubscribe();
  }, []);

  // Helper to get room name from room ID
  const getRoomName = (roomId: string): string => {
    if (!roomId) return "";
    const room = rooms.get(roomId);
    if (room && room["Tên phòng"]) {
      return room["Tên phòng"];
    }
    // Fallback to ID if room not found or if it's already a readable name
    return roomId;
  };

  // Get week days from currentWeekStart
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) =>
      currentWeekStart.add(i, "day")
    );
  }, [currentWeekStart]);

  // Get schedule events for a specific date
  const getScheduleForDate = (date: Dayjs) => {
    const dateStr = date.format("YYYY-MM-DD");
    const dayOfWeek = date.day() === 0 ? 8 : date.day() + 1;

    const events: any[] = [];

    // Lấy lịch từ class (lịch cố định theo thứ)
    classes.forEach((cls) => {
      const schedules = cls["Lịch học"] || [];
      schedules.forEach((schedule: any) => {
        if (schedule["Thứ"] === dayOfWeek) {
          const roomId = cls["Phòng học"] || "";
          events.push({
            type: "class",
            class: cls,
            schedule: schedule,
            date: dateStr,
            startTime: schedule["Giờ bắt đầu"],
            endTime: schedule["Giờ kết thúc"],
            subject: cls["Môn học"],
            className: cls["Tên lớp"],
            teacher: cls["Giáo viên chủ nhiệm"],
            location: schedule["Địa điểm"],
            room: roomId ? getRoomName(roomId) : "",
          });
        }
      });
    });

    return events.sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // Get all events for current week
  const weekSchedules = useMemo(() => {
    const result: { [key: number]: any[] } = {};
    weekDays.forEach((day, index) => {
      result[index] = getScheduleForDate(day);
    });
    return result;
  }, [weekDays, classes, rooms]);

  // Prepare calendar data
  const calendarData = useMemo(() => {
    const data: Record<string, any[]> = {};

    // Add regular class schedules
    classes.forEach((cls) => {
      cls["Lịch học"]?.forEach((schedule: any) => {
        const dayOfWeek = schedule["Thứ"];
        if (!data[dayOfWeek]) {
          data[dayOfWeek] = [];
        }
        data[dayOfWeek].push({
          type: "class",
          className: cls["Tên lớp"],
          subject: subjectMap[cls["Môn học"]] || cls["Môn học"],
          startTime: schedule["Giờ bắt đầu"],
          endTime: schedule["Giờ kết thúc"],
          location: schedule["Địa điểm"],
          teacher: cls["Giáo viên chủ nhiệm"],
        });
      });
    });

    // Add schedule events
    scheduleEvents.forEach((event) => {
      const date = dayjs(event["Ngày"]).format("YYYY-MM-DD");
      if (!data[date]) {
        data[date] = [];
      }
      data[date].push({
        type: "event",
        title: event["Tên công việc"],
        eventType: event["Loại"],
        startTime: event["Giờ bắt đầu"],
        endTime: event["Giờ kết thúc"],
        location: event["Địa điểm"],
        note: event["Nhận xét"],
      });
    });

    return data;
  }, [classes, scheduleEvents]);

  // Get list data for calendar
  const getListData = (value: Dayjs) => {
    const dateStr = value.format("YYYY-MM-DD");
    const dayOfWeek = value.day() === 0 ? 8 : value.day() + 1; // Convert to Vietnamese format (2-8)

    const events = calendarData[dateStr] || [];
    const regularClasses = calendarData[dayOfWeek] || [];

    return [...events, ...regularClasses];
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Đang tải dữ liệu..." />
      </div>
    );
  }

  if (!currentUser || !userProfile || userProfile.role !== "parent") {
    return null;
  }

  // Show message if no student data after loading
  if (!loading && !student && userProfile?.studentId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card style={{ maxWidth: 500, textAlign: "center" }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <Title level={3}>Không tìm thấy thông tin</Title>
            <Paragraph>
              Không thể tải thông tin học sinh. Vui lòng liên hệ với trung tâm để được hỗ trợ.
            </Paragraph>
            <Button
              type="primary"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
            >
              Đăng xuất
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  // Show message if student is cancelled
  if (student?.["Trạng thái"] === "Hủy") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card style={{ maxWidth: 500, textAlign: "center" }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <Title level={3}>Tài khoản đã bị hủy</Title>
            <Paragraph>
              Tài khoản học sinh của bạn đã bị hủy. Vui lòng liên hệ với trung tâm để biết thêm chi tiết.
            </Paragraph>
            <Button
              type="primary"
              danger
              size="large"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
            >
              Đăng xuất
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <Row align="middle" gutter={16}>
            <Col>
              <div className="w-16 h-16 bg-[#36797f] rounded-full flex items-center justify-center">
                <UserOutlined style={{ fontSize: 32, color: "white" }} />
              </div>
            </Col>
            <Col flex="auto">
              <Title level={3} style={{ margin: 0 }}>
                Xin chào, {userProfile?.studentName || student?.["Họ và tên"] || "Phụ huynh"}
              </Title>
              <Text type="secondary">
                Mã học sinh: {userProfile?.studentCode || student?.["Mã học sinh"] || "-"}
              </Text>
              {student && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Số điện thoại: {student["Số điện thoại"] || "-"} | 
                    Email: {student["Email"] || "-"}
                  </Text>
                </div>
              )}
            </Col>
            <Col>
              <Button
                type="primary"
                danger
                onClick={async () => {
                  await signOut();
                  navigate("/login");
                }}
              >
                Đăng xuất
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Statistics */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Tổng số buổi học"
                value={stats.totalSessions}
                prefix={<BookOutlined />}
                suffix="buổi"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Tỷ lệ tham gia"
                value={stats.attendanceRate}
                precision={1}
                suffix="%"
                valueStyle={{
                  color: stats.attendanceRate >= 80 ? "#3f8600" : "#cf1322",
                }}
                prefix={<CheckCircleOutlined />}
              />
              <Progress
                percent={stats.attendanceRate}
                showInfo={false}
                strokeColor={stats.attendanceRate >= 80 ? "#3f8600" : "#cf1322"}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Điểm trung bình"
                value={stats.averageScore}
                precision={1}
                valueStyle={{
                  color:
                    stats.averageScore >= 8
                      ? "#3f8600"
                      : stats.averageScore >= 6.5
                        ? "#1890ff"
                        : "#cf1322",
                }}
                prefix={<TrophyOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Số lớp đang học"
                value={classes.length}
                prefix={<CalendarOutlined />}
                suffix="lớp"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card 
              hoverable
              onClick={() => setRedeemHistoryModalOpen(true)}
              style={{ cursor: "pointer" }}
            >
              <Statistic
                title="Sao đã đổi thưởng"
                value={stats.redeemedBonusPoints}
                valueStyle={{ color: "#ff4d4f" }}
                prefix={<StarOutlined />}
                suffix="điểm"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Số sao hiện có"
                value={stats.totalBonusPoints - stats.redeemedBonusPoints}
                valueStyle={{ color: "#52c41a" }}
                prefix={<StarOutlined />}
                suffix="điểm"
              />
            </Card>
          </Col>
        </Row>

        {/* Tabs */}
        <Card>
          <Tabs
            items={[
              {
                key: "schedule-timeline",
                label: (
                  <span>
                    <CalendarOutlined /> Lịch học theo tuần
                  </span>
                ),
                children: (
                  <div>
                    {/* Week Navigation */}
                    <Card style={{ marginBottom: 16 }}>
                      <Space>
                        <Button 
                          onClick={() => setCurrentWeekStart(currentWeekStart.subtract(1, "week"))}
                        >
                          Tuần trước
                        </Button>
                        <Text strong>
                          {currentWeekStart.format("DD/MM")} - {currentWeekStart.add(6, "day").format("DD/MM/YYYY")}
                        </Text>
                        <Button 
                          onClick={() => setCurrentWeekStart(currentWeekStart.add(1, "week"))}
                        >
                          Tuần sau
                        </Button>
                        <Button 
                          type="dashed"
                          onClick={() => setCurrentWeekStart(dayjs().startOf("isoWeek"))}
                        >
                          Hôm nay
                        </Button>
                      </Space>
                    </Card>

                    {/* Schedule Timeline Grid */}
                    <div style={{ overflow: "auto", backgroundColor: "white", border: "1px solid #f0f0f0", borderRadius: "8px" }}>
                      <div style={{ display: "flex", minWidth: "fit-content" }}>
                        {/* Time Column */}
                        <div style={{ width: "60px", flexShrink: 0, borderRight: "1px solid #f0f0f0", backgroundColor: "#fafafa" }}>
                          <div style={{ 
                            height: "60px", 
                            borderBottom: "1px solid #f0f0f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            color: "#999"
                          }}>
                            GMT+07
                          </div>
                          {HOUR_SLOTS.map((slot) => (
                            <div
                              key={slot.hour}
                              style={{
                                height: "60px",
                                borderBottom: "1px solid #f0f0f0",
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "flex-end",
                                paddingRight: "8px",
                                paddingTop: "4px",
                                fontSize: "11px",
                                color: "#666",
                              }}
                            >
                              {slot.label}
                            </div>
                          ))}
                        </div>

                        {/* Day Columns */}
                        {weekDays.map((day, dayIndex) => {
                          const dayEvents = weekSchedules[dayIndex] || [];
                          const isToday = day.isSame(dayjs(), "day");

                          return (
                            <div
                              key={dayIndex}
                              style={{
                                flex: 1,
                                minWidth: "140px",
                                borderRight: dayIndex < 6 ? "1px solid #f0f0f0" : "none",
                                position: "relative",
                              }}
                            >
                              {/* Day Header */}
                              <div
                                style={{
                                  height: "60px",
                                  borderBottom: "1px solid #f0f0f0",
                                  backgroundColor: isToday ? "#e6f7ff" : "#fafafa",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  position: "sticky",
                                  top: 0,
                                  zIndex: 10,
                                }}
                              >
                                <div style={{ fontSize: "12px", color: "#666", textTransform: "capitalize" }}>
                                  {day.format("dddd")}
                                </div>
                                <div style={{ 
                                  fontSize: "20px", 
                                  fontWeight: "bold",
                                  color: isToday ? "#1890ff" : "#333",
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "50%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: isToday ? "#1890ff" : "transparent",
                                  ...(isToday && { color: "white" })
                                }}>
                                  {day.format("D")}
                                </div>
                              </div>

                              {/* Hour Grid with Events */}
                              <div
                                style={{
                                  position: "relative",
                                  height: `${HOUR_SLOTS.length * 60}px`,
                                  backgroundColor: isToday ? "#fafffe" : "white",
                                }}
                              >
                                {/* Hour slots background */}
                                {HOUR_SLOTS.map((slot) => (
                                  <div
                                    key={slot.hour}
                                    style={{
                                      height: "60px",
                                      borderBottom: "1px solid #f0f0f0",
                                      position: "relative",
                                    }}
                                  />
                                ))}

                                {/* Events */}
                                {dayEvents.map((event, eventIdx) => {
                                  const [startHour, startMin] = event.startTime.split(":").map(Number);
                                  const [endHour, endMin] = event.endTime.split(":").map(Number);
                                  const startSlotIdx = Math.max(0, startHour - 6);
                                  const topOffset = startSlotIdx * 60 + (startMin / 60) * 60;
                                  const durationHours = (endHour - startHour) + (endMin - startMin) / 60;
                                  const height = Math.max(60, durationHours * 60);

                                  return (
                                    <div
                                      key={eventIdx}
                                      onClick={() => {
                                        setSelectedScheduleEvent({
                                          ...event,
                                          date: day.format("DD/MM/YYYY"),
                                          dayName: day.format("dddd")
                                        });
                                        setScheduleDetailModalOpen(true);
                                      }}
                                      style={{
                                        position: "absolute",
                                        top: `${topOffset}px`,
                                        left: "4px",
                                        right: "4px",
                                        height: `${height}px`,
                                        backgroundColor: "#e6f7ff",
                                        border: "1px solid #1890ff",
                                        borderRadius: "4px",
                                        padding: "4px 8px",
                                        overflow: "hidden",
                                        fontSize: "11px",
                                        cursor: "pointer",
                                        transition: "all 0.3s ease",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "#bae7ff";
                                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(24, 144, 255, 0.3)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "#e6f7ff";
                                        e.currentTarget.style.boxShadow = "none";
                                      }}
                                    >
                                      <div style={{ fontWeight: "bold", color: "#1890ff" }}>
                                        {subjectMap[event.subject] || event.subject}
                                      </div>
                                      <div style={{ fontSize: "10px", color: "#666" }}>
                                        {event.startTime} - {event.endTime}
                                      </div>
                                      <div style={{ fontSize: "10px", color: "#666" }}>
                                        {event.className}
                                      </div>
                                      {event.room && (
                                        <div style={{ fontSize: "10px", color: "#666" }}>
                                          🏫 {event.room}
                                        </div>
                                      )}
                                      {event.location && (
                                        <div style={{ fontSize: "10px", color: "#666" }}>
                                          📍 {event.location}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "classes",
                label: (
                  <span>
                    <BookOutlined /> Lớp học
                  </span>
                ),
                children: (
                  <div>
                    {classes.length === 0 ? (
                      <Empty description="Chưa có lớp học nào" />
                    ) : (
                      <Collapse 
                        accordion 
                        style={{ background: "transparent" }}
                        items={classes.map((cls) => {
                          // Get sessions for this class
                          const classSessions = recentSessions.filter(
                            (s) => s["Class ID"] === cls.id
                          );
                          
                          // Get homework for this class
                          const classHomework = classSessions.filter((s) => s["Bài tập"]);
                          
                          // Get attendance for this class
                          const classAttendance = classSessions.map((session) => {
                            const record = session["Điểm danh"]?.find(
                              (r: any) => r["Student ID"] === userProfile?.studentId
                            );
                            return { session, record };
                          }).filter((item) => item.record);
                          
                          // Get scores for this class from customScoresData
                          const classScores = allScoresData.filter(
                            (s) => s.className === cls["Tên lớp"] || s.classId === cls.id
                          );
                          
                          // Get documents for this class
                          const sessionDocuments = classSessions
                            .filter((s) => s["Bài tập"]?.["Tài liệu đính kèm"])
                            .flatMap((s) => (s["Bài tập"]["Tài liệu đính kèm"] || []).map((doc: any) => ({
                              ...doc,
                              sessionDate: s["Ngày"],
                              source: "homework",
                            })));
                          const allDocuments = [
                            ...(cls["Tài liệu"] || []).map((doc: any) => ({ ...doc, source: "class" })),
                            ...sessionDocuments,
                          ];
                          
                          // Calculate stats
                          const presentCount = classAttendance.filter((a) => a.record?.["Có mặt"]).length;
                          const totalCount = classAttendance.length;
                          const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
                          const avgScore = classScores.length > 0 
                            ? (classScores.reduce((sum, s) => sum + (s.score || 0), 0) / classScores.length).toFixed(1)
                            : "-";
                          
                          return {
                            key: cls.id,
                            label: (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                <Space>
                                  <BookOutlined style={{ color: "#1890ff" }} />
                                  <span style={{ fontWeight: "bold" }}>{cls["Tên lớp"]}</span>
                                  <Tag color="blue">{subjectMap[cls["Môn học"]] || cls["Môn học"]}</Tag>
                                </Space>
                                <Space>
                                  <Tag color={attendanceRate >= 80 ? "green" : "orange"}>
                                    Chuyên cần: {attendanceRate}%
                                  </Tag>
                                  <Tag color="purple">ĐTB: {avgScore}</Tag>
                                  <Tag color={cls["Trạng thái"] === "active" ? "green" : "red"}>
                                    {cls["Trạng thái"] === "active" ? "Đang học" : "Đã kết thúc"}
                                  </Tag>
                                </Space>
                              </div>
                            ),
                            children: (
                              <div>
                                {/* Class Info */}
                                <Card size="small" style={{ marginBottom: 16 }}>
                                  <Row gutter={16}>
                                    <Col span={12}>
                                      <Descriptions column={1} size="small">
                                        <Descriptions.Item label="Giáo viên">
                                          {cls["Giáo viên chủ nhiệm"]}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Khối">{cls["Khối"]}</Descriptions.Item>
                                        <Descriptions.Item label="Mã lớp">{cls["Mã lớp"]}</Descriptions.Item>
                                      </Descriptions>
                                    </Col>
                                    <Col span={12}>
                                      <Text strong>Lịch học:</Text>
                                      {cls["Lịch học"]?.map((schedule: any, idx: number) => (
                                        <div key={idx} style={{ marginLeft: 16, marginTop: 4 }}>
                                          <ClockCircleOutlined /> Thứ {schedule["Thứ"]}:{" "}
                                          {schedule["Giờ bắt đầu"]} - {schedule["Giờ kết thúc"]}
                                        </div>
                                      ))}
                                    </Col>
                                  </Row>
                                </Card>
                                
                                {/* Inner Tabs for class details */}
                                <Tabs
                                  size="small"
                                  items={[
                                    {
                                      key: "homework",
                                      label: <span><EditOutlined /> Bài tập về nhà ({classHomework.length})</span>,
                                      children: (
                                        <div style={{ maxHeight: 400, overflowY: "auto" }}>
                                          {classHomework.length === 0 ? (
                                            <Empty description="Chưa có bài tập" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                          ) : (
                                            <List
                                              size="small"
                                              dataSource={classHomework}
                                              renderItem={(session) => {
                                                const record = session["Điểm danh"]?.find(
                                                  (r: any) => r["Student ID"] === userProfile?.studentId
                                                );
                                                const homework = session["Bài tập"];
                                                const completed = record?.["Bài tập hoàn thành"] || 0;
                                                const total = homework?.["Tổng số bài"] || 0;
                                                const percentage = total > 0 ? (completed / total) * 100 : 0;
                                                
                                                return (
                                                  <List.Item>
                                                    <div style={{ width: "100%" }}>
                                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                                        <Text type="secondary">
                                                          {dayjs(session["Ngày"]).format("DD/MM/YYYY")}
                                                        </Text>
                                                        <Progress 
                                                          percent={percentage} 
                                                          size="small" 
                                                          style={{ width: 100 }}
                                                          status={percentage === 100 ? "success" : "active"}
                                                        />
                                                      </div>
                                                      <Paragraph style={{ margin: 0 }}>
                                                        {homework["Mô tả"]}
                                                      </Paragraph>
                                                      {homework["Tài liệu đính kèm"]?.length > 0 && (
                                                        <div style={{ marginTop: 8 }}>
                                                          {homework["Tài liệu đính kèm"].map((att: any, idx: number) => (
                                                            <a 
                                                              key={idx}
                                                              href={att.url} 
                                                              target="_blank" 
                                                              rel="noopener noreferrer"
                                                              style={{ marginRight: 12 }}
                                                            >
                                                              <PaperClipOutlined /> {att.name}
                                                            </a>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </List.Item>
                                                );
                                              }}
                                            />
                                          )}
                                        </div>
                                      ),
                                    },
                                    {
                                      key: "attendance",
                                      label: <span><CheckCircleOutlined /> Điểm danh ({classAttendance.length})</span>,
                                      children: (
                                        <div style={{ maxHeight: 400, overflowY: "auto" }}>
                                          {classAttendance.length === 0 ? (
                                            <Empty description="Chưa có dữ liệu điểm danh" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                          ) : (
                                            <Timeline
                                              items={classAttendance.map(({ session, record }) => {
                                                let studyDuration = "";
                                                if (record?.["Giờ check-in"] && record?.["Giờ check-out"]) {
                                                  const checkIn = dayjs(`2000-01-01 ${record["Giờ check-in"]}`);
                                                  const checkOut = dayjs(`2000-01-01 ${record["Giờ check-out"]}`);
                                                  const minutes = checkOut.diff(checkIn, "minute");
                                                  const hours = Math.floor(minutes / 60);
                                                  const mins = minutes % 60;
                                                  studyDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                                                }
                                                
                                                return {
                                                  color: record?.["Có mặt"]
                                                    ? "green"
                                                    : record?.["Vắng có phép"]
                                                      ? "orange"
                                                      : "red",
                                                  children: (
                                                    <div>
                                                      <div>
                                                        <strong>{dayjs(session["Ngày"]).format("DD/MM/YYYY")}</strong>
                                                        {" - "}{session["Giờ bắt đầu"]} - {session["Giờ kết thúc"]}
                                                      </div>
                                                      <div>
                                                        {record?.["Có mặt"] ? (
                                                          <Tag color="success">Có mặt</Tag>
                                                        ) : record?.["Vắng có phép"] ? (
                                                          <Tag color="warning">Vắng có phép</Tag>
                                                        ) : (
                                                          <Tag color="error">Vắng</Tag>
                                                        )}
                                                        {record?.["Đi muộn"] && <Tag color="orange">Đi muộn</Tag>}
                                                        {studyDuration && (
                                                          <Tag color="blue">⏱️ {studyDuration}</Tag>
                                                        )}
                                                      </div>
                                                      {record?.["Ghi chú"] && (
                                                        <div style={{ marginTop: 4, color: "#666", fontSize: 12 }}>
                                                          Ghi chú: {record["Ghi chú"]}
                                                        </div>
                                                      )}
                                                    </div>
                                                  ),
                                                };
                                              })}
                                            />
                                          )}
                                        </div>
                                      ),
                                    },
                                    {
                                      key: "scores",
                                      label: <span><TrophyOutlined /> Điểm kiểm tra ({classScores.length})</span>,
                                      children: (
                                        <div style={{ maxHeight: 400, overflowY: "auto" }}>
                                          {classScores.length === 0 ? (
                                            <Empty description="Chưa có điểm kiểm tra" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                          ) : (
                                            <Table
                                              size="small"
                                              dataSource={classScores}
                                              rowKey="id"
                                              pagination={false}
                                              columns={[
                                                {
                                                  title: "Ngày",
                                                  dataIndex: "date",
                                                  render: (date) => date ? dayjs(date).format("DD/MM/YYYY") : "-",
                                                  width: 100,
                                                },
                                                {
                                                  title: "Bài kiểm tra",
                                                  dataIndex: "testName",
                                                },
                                                {
                                                  title: "Điểm",
                                                  dataIndex: "score",
                                                  align: "center",
                                                  width: 80,
                                                  render: (score) => (
                                                    <Tag
                                                      color={
                                                        score >= 8 ? "green" : score >= 6.5 ? "blue" : score >= 5 ? "orange" : "red"
                                                      }
                                                      style={{ fontSize: 14, padding: "2px 8px" }}
                                                    >
                                                      {score}
                                                    </Tag>
                                                  ),
                                                },
                                              ]}
                                            />
                                          )}
                                        </div>
                                      ),
                                    },
                                    {
                                      key: "documents",
                                      label: <span><FileTextOutlined /> Tài liệu ({allDocuments.length})</span>,
                                      children: (
                                        <div style={{ maxHeight: 400, overflowY: "auto" }}>
                                          {allDocuments.length === 0 ? (
                                            <Empty description="Chưa có tài liệu" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                          ) : (
                                            <List
                                              size="small"
                                              dataSource={allDocuments}
                                              renderItem={(doc: any) => (
                                                <List.Item
                                                  actions={[
                                                    <Button
                                                      type="link"
                                                      size="small"
                                                      icon={<DownloadOutlined />}
                                                      href={doc.url}
                                                      target="_blank"
                                                    >
                                                      Tải
                                                    </Button>,
                                                  ]}
                                                >
                                                  <List.Item.Meta
                                                    avatar={
                                                      doc.source === "homework" 
                                                        ? <PaperClipOutlined style={{ fontSize: 20, color: "#fa8c16" }} />
                                                        : <FileTextOutlined style={{ fontSize: 20, color: "#1890ff" }} />
                                                    }
                                                    title={
                                                      <Space>
                                                        {doc.name || doc.title}
                                                        {doc.source === "homework" && (
                                                          <Tag color="orange" style={{ fontSize: 10 }}>BTVN</Tag>
                                                        )}
                                                      </Space>
                                                    }
                                                    description={
                                                      doc.sessionDate 
                                                        ? `Buổi học: ${dayjs(doc.sessionDate).format("DD/MM/YYYY")}`
                                                        : doc.uploadedAt 
                                                          ? `Đăng tải: ${dayjs(doc.uploadedAt).format("DD/MM/YYYY")}`
                                                          : null
                                                    }
                                                  />
                                                </List.Item>
                                              )}
                                            />
                                          )}
                                        </div>
                                      ),
                                    },
                                  ]}
                                />
                              </div>
                            ),
                          };
                        })}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: "report",
                label: (
                  <span>
                    <BarChartOutlined /> Báo cáo & Đánh giá
                  </span>
                ),
                children: (
                  <div>
                    <Row gutter={[16, 16]}>
                      <Col span={24}>
                        <Card title="Tổng quan học tập">
                          <Row gutter={16}>
                            <Col xs={24} md={8}>
                              <Card>
                                <Statistic
                                  title="Tổng số buổi học"
                                  value={stats.totalSessions}
                                  suffix="buổi"
                                />
                              </Card>
                            </Col>
                            <Col xs={24} md={8}>
                              <Card>
                                <Statistic
                                  title="Số buổi có mặt"
                                  value={stats.attendedSessions}
                                  suffix="buổi"
                                  valueStyle={{ color: "#3f8600" }}
                                />
                              </Card>
                            </Col>
                            <Col xs={24} md={8}>
                              <Card>
                                <Statistic
                                  title="Số buổi vắng"
                                  value={stats.absentSessions}
                                  suffix="buổi"
                                  valueStyle={{ color: "#cf1322" }}
                                />
                              </Card>
                            </Col>
                          </Row>
                        </Card>
                      </Col>

                      <Col span={24}>
                        <Card title="Kết quả học tập">
                          <Row gutter={16}>
                            <Col xs={24} md={12}>
                              <div style={{ marginBottom: 16 }}>
                                <Text strong>Tỷ lệ tham gia:</Text>
                                <Progress
                                  percent={stats.attendanceRate}
                                  status={stats.attendanceRate >= 80 ? "success" : "exception"}
                                  format={(percent) => `${percent?.toFixed(1)}%`}
                                />
                              </div>
                            </Col>
                            <Col xs={24} md={12}>
                              <Statistic
                                title="Điểm trung bình"
                                value={stats.averageScore}
                                precision={1}
                                suffix={`/ 10 (${stats.scoredSessions} bài)`}
                                valueStyle={{
                                  color:
                                    stats.averageScore >= 8
                                      ? "#3f8600"
                                      : stats.averageScore >= 6.5
                                        ? "#1890ff"
                                        : "#cf1322",
                                }}
                              />
                            </Col>
                          </Row>
                        </Card>
                      </Col>

                      <Col span={24}>
                        <Card 
                          title="Nhận xét chung"
                          extra={
                            <Space>
                              <DatePicker
                                picker="month"
                                format="MM/YYYY"
                                placeholder="Chọn tháng"
                                value={selectedMonth}
                                onChange={(date) => setSelectedMonth(date)}
                                style={{ width: 120 }}
                              />
                            </Space>
                          }
                        >
                          <Paragraph>
                            {stats.attendanceRate >= 90 && stats.averageScore >= 8 ? (
                              <Text type="success">
                                ✅ Học sinh có thái độ học tập rất tốt, chuyên cần và đạt kết quả
                                cao. Tiếp tục phát huy!
                              </Text>
                            ) : stats.attendanceRate >= 80 && stats.averageScore >= 6.5 ? (
                              <Text style={{ color: "#1890ff" }}>
                                📘 Học sinh có thái độ học tập tốt. Cần cố gắng thêm để đạt kết
                                quả cao hơn.
                              </Text>
                            ) : stats.attendanceRate < 80 ? (
                              <Text type="warning">
                                ⚠️ Tỷ lệ tham gia chưa đạt yêu cầu. Phụ huynh cần quan tâm hơn
                                đến việc đưa con đến lớp đầy đủ.
                              </Text>
                            ) : (
                              <Text type="danger">
                                ❌ Kết quả học tập chưa đạt. Cần trao đổi với giáo viên để tìm
                                phương pháp học tập phù hợp hơn.
                              </Text>
                            )}
                          </Paragraph>
                          <Paragraph>
                            <Text strong>Số buổi đi muộn:</Text> {stats.lateSessions} buổi
                          </Paragraph>
                          {stats.lateSessions > 3 && (
                            <Paragraph>
                              <Text type="warning">
                                Lưu ý: Học sinh đi muộn nhiều lần. Phụ huynh cần chú ý giúp con
                                đến lớp đúng giờ.
                              </Text>
                            </Paragraph>
                          )}
                        </Card>
                      </Col>
                    </Row>
                  </div>
                ),
              },
              {
                key: "invoices",
                label: (
                  <span>
                    <DollarOutlined /> Học phí
                  </span>
                ),
                children: (
                  <div>
                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                      <Col xs={24} md={8}>
                        <Card>
                          <Statistic
                            title="Tổng học phí"
                            value={invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)}
                            suffix="đ"
                            formatter={(value) =>
                              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                          />
                        </Card>
                      </Col>
                      <Col xs={24} md={8}>
                        <Card>
                          <Statistic
                            title="Đã thu"
                            value={invoices
                              .filter((inv) => inv.status === "paid")
                              .reduce((sum, inv) => sum + (inv.finalAmount || 0), 0)}
                            suffix="đ"
                            valueStyle={{ color: "#3f8600" }}
                            formatter={(value) =>
                              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                          />
                        </Card>
                      </Col>
                      <Col xs={24} md={8}>
                        <Card>
                          <Statistic
                            title="Chưa thu"
                            value={invoices
                              .filter((inv) => inv.status === "unpaid")
                              .reduce((sum, inv) => sum + (inv.finalAmount || 0), 0)}
                            suffix="đ"
                            valueStyle={{ color: "#cf1322" }}
                            formatter={(value) =>
                              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                          />
                        </Card>
                      </Col>
                    </Row>

                    <Table
                      dataSource={invoices}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                      columns={[
                        {
                          title: "Tháng",
                          key: "month",
                          render: (_, record) => `Tháng ${record.month + 1}/${record.year}`,
                        },
                        {
                          title: "Số buổi",
                          dataIndex: "totalSessions",
                          align: "center",
                        },
                        {
                          title: "Học phí",
                          dataIndex: "totalAmount",
                          align: "right",
                          render: (val) => `${val?.toLocaleString("vi-VN")} đ`,
                        },
                        {
                          title: "Miễn giảm",
                          dataIndex: "discount",
                          align: "right",
                          render: (val) =>
                            val > 0 ? (
                              <Text type="warning">-{val?.toLocaleString("vi-VN")} đ</Text>
                            ) : (
                              "-"
                            ),
                        },
                        {
                          title: "Phải thu",
                          dataIndex: "finalAmount",
                          align: "right",
                          render: (val) => (
                            <Text strong style={{ fontSize: 16 }}>
                              {val?.toLocaleString("vi-VN")} đ
                            </Text>
                          ),
                        },
                        {
                          title: "Trạng thái",
                          dataIndex: "status",
                          align: "center",
                          render: (status) =>
                            status === "paid" ? (
                              <Tag color="success" icon={<CheckCircleOutlined />}>
                                Đã thu
                              </Tag>
                            ) : (
                              <Tag color="error" icon={<ClockCircleOutlined />}>
                                Chưa thu
                              </Tag>
                            ),
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      {/* Schedule Event Detail Modal */}
      <Modal
        title={
          selectedScheduleEvent ? (
            <div>
              <div style={{ fontSize: "16px", fontWeight: "bold", color: "#1890ff" }}>
                {subjectMap[selectedScheduleEvent.subject] || selectedScheduleEvent.subject}
              </div>
              <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                {selectedScheduleEvent.dayName}, {selectedScheduleEvent.date}
              </div>
            </div>
          ) : null
        }
        open={scheduleDetailModalOpen}
        onCancel={() => setScheduleDetailModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setScheduleDetailModalOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={600}
      >
        {selectedScheduleEvent && (
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            {/* Class Info Card */}
            <Card size="small" style={{ backgroundColor: "#f6f9ff", border: "1px solid #bae7ff" }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div>
                    <Text type="secondary" style={{ fontSize: "12px", textTransform: "uppercase" }}>
                      Lớp học
                    </Text>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#333", marginTop: "4px" }}>
                      {selectedScheduleEvent.className}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <Text type="secondary" style={{ fontSize: "12px", textTransform: "uppercase" }}>
                      Giáo viên
                    </Text>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#333", marginTop: "4px" }}>
                      {selectedScheduleEvent.teacher}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Time & Location Info */}
            <Card size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item 
                  label={<ClockCircleOutlined style={{ marginRight: "8px", color: "#1890ff" }} />}
                >
                  <strong>{selectedScheduleEvent.startTime} - {selectedScheduleEvent.endTime}</strong>
                </Descriptions.Item>
                {selectedScheduleEvent.location && (
                  <Descriptions.Item 
                    label={<span style={{ marginRight: "8px" }}>📍</span>}
                  >
                    {selectedScheduleEvent.location}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Class Details */}
            <Card size="small" title={<span style={{ fontSize: "13px", fontWeight: "600" }}>Thông tin lớp</span>}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Mã lớp">
                  {selectedScheduleEvent.class?.["Mã lớp"] || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Khối">
                  {selectedScheduleEvent.class?.["Khối"] || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <Tag color={selectedScheduleEvent.class?.["Trạng thái"] === "active" ? "green" : "red"}>
                    {selectedScheduleEvent.class?.["Trạng thái"] === "active" ? "Đang học" : "Đã kết thúc"}
                  </Tag>
                </Descriptions.Item>
                {selectedScheduleEvent.class?.["Số lượng học sinh"] && (
                  <Descriptions.Item label="Số lượng học sinh">
                    {selectedScheduleEvent.class["Số lượng học sinh"]} / {selectedScheduleEvent.class["Sức chứa"] || "-"}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Action Buttons */}
            <div style={{ textAlign: "center" }}>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Để đăng ký hoặc cập nhật, vui lòng liên hệ giáo viên hoặc phòng quản lý
              </Text>
            </div>
          </Space>
        )}
      </Modal>

      {/* Redeem History Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StarOutlined style={{ color: "#faad14", fontSize: 20 }} />
            <span>Lịch sử đổi thưởng</span>
          </div>
        }
        open={redeemHistoryModalOpen}
        onCancel={() => setRedeemHistoryModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setRedeemHistoryModalOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Card size="small" style={{ backgroundColor: "#fffbe6", border: "1px solid #ffe58f" }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Tổng số sao đã đổi"
                  value={stats.redeemedBonusPoints}
                  prefix={<StarOutlined style={{ color: "#ff4d4f" }} />}
                  valueStyle={{ color: "#ff4d4f" }}
                  suffix="điểm"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Số lần đổi thưởng"
                  value={redeemHistory.length}
                  prefix={<GiftOutlined style={{ color: "#1890ff" }} />}
                  valueStyle={{ color: "#1890ff" }}
                  suffix="lần"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Số sao còn lại"
                  value={stats.totalBonusPoints - stats.redeemedBonusPoints}
                  prefix={<StarOutlined style={{ color: "#52c41a" }} />}
                  valueStyle={{ color: "#52c41a" }}
                  suffix="điểm"
                />
              </Col>
            </Row>
          </Card>
        </div>

        {redeemHistory.length === 0 ? (
          <Empty
            description="Chưa có lịch sử đổi thưởng"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: "40px 0" }}
          />
        ) : (
          <Timeline
            mode="left"
            items={redeemHistory.map((item: any) => ({
              color: "orange",
              dot: <GiftOutlined style={{ fontSize: 16 }} />,
              children: (
                <Card 
                  size="small" 
                  style={{ marginBottom: 8 }}
                  styles={{ body: { padding: 12 } }}
                >
                  <Row gutter={16} align="middle">
                    <Col flex="auto">
                      <Space direction="vertical" size={4}>
                        <Text strong style={{ fontSize: 14, color: "#1890ff" }}>
                          {item["Tên phần thưởng"]}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(item["Thời gian đổi"]).format("DD/MM/YYYY HH:mm")}
                        </Text>
                        {item["Ghi chú"] && (
                          <Text style={{ fontSize: 12 }}>
                            💬 {item["Ghi chú"]}
                          </Text>
                        )}
                      </Space>
                    </Col>
                    <Col>
                      <Tag 
                        color="red" 
                        style={{ 
                          fontSize: 16, 
                          padding: "4px 12px",
                          fontWeight: "bold" 
                        }}
                      >
                        -{item["Số điểm"]} ⭐
                      </Tag>
                    </Col>
                  </Row>
                </Card>
              ),
            }))}
          />
        )}
      </Modal>
    </div>
  );
};

export default ParentPortal;
