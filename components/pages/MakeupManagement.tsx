import { useState, useEffect, useMemo } from "react";
import {
  Card, Select, Space, Button, Typography, Tag, Checkbox,
  Form, Input, TimePicker, Row, Col, Divider, Modal,
  DatePicker, App, Empty, Badge, Steps
} from "antd";
import {
  ArrowLeftOutlined, ClockCircleOutlined, HistoryOutlined,
  PlusOutlined, DeleteOutlined, SearchOutlined, CheckCircleOutlined,
  UserOutlined, CalendarOutlined, TeamOutlined, BookOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import WrapperContent from "@/components/WrapperContent";
import { useClasses } from "../../hooks/useClasses";
import { supabaseOnValue, convertFromSupabaseFormat, supabaseSet, generateFirebaseId, supabaseUpdate, convertToSupabaseFormat, supabaseGetById } from "@/utils/supabaseHelpers";
import { AttendanceSession, Class } from "../../types";
import dayjs from "dayjs";

const { Text, Title } = Typography;

const translateSubject = (subject: string | null | undefined) => {
  if (!subject) return "Chưa xác định";
  const mapping: Record<string, string> = {
    "Math": "Toán học",
    "Chemistry": "Hóa học",
    "Physics": "Vật lý",
    "Biology": "Sinh học",
    "English": "Tiếng Anh",
    "Literature": "Ngữ văn",
    "History": "Lịch sử",
    "Geography": "Địa lý",
  };
  return mapping[subject] || subject;
};

// Hàm helper để parse dữ liệu điểm danh an toàn
const parseAttendance = (attendance: any): any[] => {
  if (!attendance) return [];
  if (Array.isArray(attendance)) return attendance;
  if (typeof attendance === 'object') {
    // Nếu là object, chuyển sang array (phòng trường hợp dữ liệu từ Firebase cũ hoặc Supabase trả về dạng map)
    return Object.values(attendance);
  }
  if (typeof attendance === 'string') {
    try {
      const parsed = JSON.parse(attendance);
      return Array.isArray(parsed) ? parsed : Object.values(parsed || {});
    } catch (e) {
      console.error("Lỗi parse attendance:", e);
      return [];
    }
  }
  return [];
};

const MakeupManagement = () => {
  const navigate = useNavigate();
  const { message: messageApi, modal } = App.useApp();
  const [form] = Form.useForm();
  const { classes } = useClasses();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showMakeupForm, setShowMakeupForm] = useState(false);

  // 1. Lấy dữ liệu điểm danh và danh sách lớp học
  useEffect(() => {
    console.log("🔄 Bắt đầu tải dữ liệu Sessions và Classes...");
    const unsubSessions = supabaseOnValue("datasheet/Điểm_danh_sessions", (data) => {
      console.log("📥 Nhận dữ liệu Sessions:", data ? Object.keys(data).length : 0);
      if (data) {
        const sessionsList = Object.entries(data).map(([id, value]: [string, any]) => {
          const converted = convertFromSupabaseFormat(value, "Điểm_danh_sessions");
          return { id, ...converted } as AttendanceSession;
        });
        setSessions(sessionsList);
      }
      setLoading(false);
    });

    return () => {
      console.log("🧹 Dọn dẹp kết nối Supabase Sessions");
      unsubSessions();
    };
  }, []);

  // 2. Lọc ra các buổi học có học sinh vắng (chưa được xếp lịch bù)
  const sessionsWithAbsences = useMemo(() => {
    return sessions.filter((session) => {
      const attendance = parseAttendance(session["Điểm danh"]);
      return attendance.some((record: any) =>
        record["Có mặt"] === false &&
        record["Đã xếp lịch bù"] !== true &&
        record["Loại"] !== "Học bù"
      );
    }).sort((a, b) => dayjs(b["Ngày"]).unix() - dayjs(a["Ngày"]).unix());
  }, [sessions]);

  const selectedSession = useMemo(() => {
    return sessionsWithAbsences.find(s => s.id === selectedSessionId);
  }, [selectedSessionId, sessionsWithAbsences]);

  const currentSubject = useMemo(() => {
    if (!selectedSession) return null;
    let subject = selectedSession["Môn học"];
    if (!subject) {
      const foundClass = classes.find(c => c["Tên lớp"] === selectedSession["Tên lớp"]);
      subject = foundClass?.["Môn học"];
    }
    return subject;
  }, [selectedSession, classes]);

  const availableClasses = useMemo(() => {
    const subjectClean = (currentSubject || "").toString().trim().toLowerCase();

    // Lọc các lớp có cùng tên môn học (tương đối)
    const filtered = classes.filter(c => {
      const isNotCurrentClass = c["Tên lớp"] !== selectedSession?.["Tên lớp"];
      const subjClass = (c["Môn học"] || "").toString().trim().toLowerCase();
      const isSameSubject = subjClass && subjectClean && (subjClass.includes(subjectClean) || subjectClean.includes(subjClass));

      return isNotCurrentClass && isSameSubject;
    });

    return filtered;
  }, [classes, currentSubject, selectedSession]);

  // 3. Biến đổi danh sách lớp thành danh sách các BUỔI HỌC CỤ THỂ (để chọn Thứ)
  const availableSessions = useMemo(() => {
    const list: any[] = [];
    availableClasses.forEach(c => {
      const schedules = c["Lịch học"] || [];
      if (schedules.length === 0) {
        // Vẫn cho phép chọn lớp nếu chưa có lịch, nhưng sẽ không có thông tin giờ
        list.push({
          id: c.id,
          key: `${c.id}_none`,
          classId: c.id,
          label: `${c["Tên lớp"]} (Chưa có lịch)`,
          targetClass: c,
          targetSchedule: null
        });
      } else {
        schedules.forEach((sched, idx) => {
          list.push({
            id: c.id,
            key: `${c.id}_${idx}`,
            classId: c.id,
            scheduleIndex: idx,
            label: `${c["Tên lớp"]} - Thứ ${sched["Thứ"] === 8 ? "CN" : sched["Thứ"]} (${sched["Giờ bắt đầu"]} - ${sched["Giờ kết thúc"]})`,
            targetClass: c,
            targetSchedule: sched
          });
        });
      }
    });
    return list;
  }, [availableClasses]);

  const absentStudents = useMemo(() => {
    const attendance = parseAttendance(selectedSession?.["Điểm danh"]);
    return attendance.filter((r: any) =>
      r["Có mặt"] === false &&
      r["Đã xếp lịch bù"] !== true &&
      r["Loại"] !== "Học bù"
    );
  }, [selectedSession]);

  const scheduledMakeupStudents = useMemo(() => {
    const attendance = parseAttendance(selectedSession?.["Điểm danh"]);
    return attendance.filter((r: any) => r["Đã xếp lịch bù"] === true);
  }, [selectedSession]);

  const handleCancelMakeup = async (studentId: string) => {
    if (!selectedSessionId || !selectedSession) return;

    try {
      setSaving(true);
      const attendance = parseAttendance(selectedSession["Điểm danh"]);
      const studentRecord = attendance.find(r => (r["Student ID"] || r["Mã học sinh"]) === studentId);

      // 1. Remove student from target makeup sessions
      const targetSessionIds = studentRecord?.["MakeupTargetSessionIDs"] || [];
      if (targetSessionIds.length > 0) {
        for (const targetId of targetSessionIds) {
          try {
            const targetSessionData = await supabaseGetById("datasheet/Điểm_danh_sessions", targetId);
            if (targetSessionData) {
              const targetAttendance = parseAttendance(targetSessionData["Điểm danh"]);
              const updatedTargetAttendance = targetAttendance.filter(r => (r["Student ID"] || r["Mã học sinh"]) !== studentId);

              await supabaseUpdate("datasheet/Điểm_danh_sessions", targetId, {
                "Điểm danh": updatedTargetAttendance
              });
            }
          } catch (err) {
            console.error(`Error removing student from target session ${targetId}:`, err);
          }
        }
      }

      // 2. Reset status in original session
      const updatedAttendance = attendance.map((record: any) => {
        if ((record["Student ID"] || record["Mã học sinh"]) === studentId) {
          const { "Đã xếp lịch bù": _, "MakeupTargetSessionIDs": __, ...rest } = record;
          return rest;
        }
        return record;
      });

      await supabaseUpdate("datasheet/Điểm_danh_sessions", selectedSessionId, {
        "Điểm danh": updatedAttendance
      });

      messageApi.success("Đã hủy lịch bù và đồng bộ dữ liệu thành công.");
    } catch (error) {
      console.error("Cancel makeup error:", error);
      messageApi.error("Không thể hủy lịch học bù");
    } finally {
      setSaving(false);
    }
  };

  const isAllSelected = absentStudents.length > 0 && selectedStudentIds.length === absentStudents.length;

  const handleSelectAll = (e: any) => {
    if (e.target.checked) {
      setSelectedStudentIds(absentStudents.map((s: any) => s["Student ID"] || s["Mã học sinh"]));
    } else {
      setSelectedStudentIds([]);
    }
  };

  useEffect(() => {
    setSelectedSessionId(null);
    setSelectedStudentIds([]);
  }, []);

  const handleToggleStudent = (studentId: string, checked: boolean) => {
    const nextSelectedIds = checked
      ? [...selectedStudentIds, studentId]
      : selectedStudentIds.filter((id) => id !== studentId);
    setSelectedStudentIds(nextSelectedIds);
  };

  const handleProceedToForm = () => {
    setShowMakeupForm(true);
    form.setFieldsValue({
      makeupSchedules: [{ className: `Học bù: ${selectedSession?.["Tên lớp"]}` }]
    });
  };

  const handleSelectExistingSession = (index: number, sessionKey: string) => {
    const selectedSessionInfo = availableSessions.find(s => s.key === sessionKey);
    if (selectedSessionInfo) {
      const { targetClass, targetSchedule } = selectedSessionInfo;
      const schedules = form.getFieldValue('makeupSchedules');

      let makeupDate = dayjs();
      let startTime = undefined;
      let endTime = undefined;

      if (targetSchedule) {
        const dbDay = targetSchedule["Thứ"];
        // Convert Thứ 2-8 sang DayJS (0=CN, 1=T2, ...)
        const dayjsDay = dbDay === 8 ? 0 : dbDay - 1;

        makeupDate = dayjs().day(dayjsDay);
        // Nếu ngày đó trong tuần này đã qua hoặc là hôm nay, lấy tuần sau
        if (makeupDate.isBefore(dayjs(), 'day')) {
          makeupDate = makeupDate.add(1, 'week');
        }

        startTime = targetSchedule["Giờ bắt đầu"] ? dayjs(targetSchedule["Giờ bắt đầu"], "HH:mm") : undefined;
        endTime = targetSchedule["Giờ kết thúc"] ? dayjs(targetSchedule["Giờ kết thúc"], "HH:mm") : undefined;
      }

      schedules[index] = {
        ...schedules[index],
        classId: targetClass.id,
        maLop: targetClass["Mã lớp"],
        className: targetClass["Tên lớp"],
        teacherName: targetClass["Giáo viên chủ nhiệm"],
        teacherId: targetClass["Teacher ID"],
        day: targetSchedule?.["Thứ"],
        date: makeupDate,
        startTime: startTime,
        endTime: endTime,
        room: targetClass["Phòng học"]
      };

      form.setFieldsValue({ makeupSchedules: schedules });
      messageApi.success(`Đã tự động lấy buổi học gần nhất (${dayjs(makeupDate).format("DD/MM")}) của lớp ${targetClass["Tên lớp"]}`);
    }
  };

  const handleSaveMakeup = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const makeupSchedules = values.makeupSchedules;
      const selectedStudentsData = absentStudents.filter(s => selectedStudentIds.includes(s["Student ID"] || s["Mã học sinh"]));

      // Map to store which target session each student was assigned to
      const studentTargetSessions: Record<string, string[]> = {};

      for (const schedule of makeupSchedules) {
        // Nếu không chọn lớp đích, mặc định dùng thông tin của Lớp chính (Original Class)
        const targetClassId = schedule.classId || selectedSession?.["Class ID"] || "MAKEUP_CLASS";
        const targetMaLop = schedule.maLop || selectedSession?.["Mã lớp"] || "";
        const targetTeacherId = schedule.teacherId || selectedSession?.["Teacher ID"] || "";
        const targetTeacherName = schedule.teacherName || selectedSession?.["Giáo viên"] || "";

        const dateStr = schedule.date.format("YYYY-MM-DD");
        const existingSession = sessions.find(s =>
          (s["Class ID"] === targetClassId || s["Mã lớp"] === targetMaLop) &&
          s["Ngày"] === dateStr
        );

        const makeupAttendanceList = selectedStudentsData.map(s => {
          const studentId = s["Student ID"] || s["Mã học sinh"];
          return {
            "Student ID": studentId,
            "Mã học sinh": studentId,
            "student_id": studentId,
            "ma_hoc_sinh": studentId,
            "Tên học sinh": s["Tên học sinh"] || s["Họ và tên"],
            "Họ và tên": s["Tên học sinh"] || s["Họ và tên"],
            "ten_hoc_sinh": s["Tên học sinh"] || s["Họ và tên"],
            "Có mặt": false,
            "Ghi chú": "",
            "Loại": "Học bù",
            "OriginalSessionID": selectedSessionId,
            "OriginalSessionDate": selectedSession?.["Ngày"],
            "OriginalClassID": selectedSession?.["Class ID"],
            "OriginalClassName": selectedSession?.["Tên lớp"]
          };
        });

        let finalTargetSessionId = "";

        if (existingSession) {
          finalTargetSessionId = existingSession.id;
          const currentAttendance = parseAttendance(existingSession["Điểm danh"]);

          // Lọc bỏ những học sinh trong makeupAttendanceList nếu đã tồn tại trong currentAttendance (tránh bị lặp)
          const newMakeupStudents = makeupAttendanceList.filter(
            newStudent => !currentAttendance.some(existing => (existing["Student ID"] || existing["Mã học sinh"]) === newStudent["Student ID"])
          );

          const updatedAttendance = [...currentAttendance, ...newMakeupStudents];

          await supabaseUpdate("datasheet/Điểm_danh_sessions", existingSession.id, {
            "Điểm danh": updatedAttendance,
            "diem_danh": updatedAttendance,
            "Timestamp": new Date().toISOString()
          });
          console.log(`✅ Updated existing session ${existingSession.id} with ${newMakeupStudents.length} new makeup students.`);
        } else {
          const timetableId = generateFirebaseId();
          const sessionId = generateFirebaseId();
          finalTargetSessionId = sessionId;

          const timetableData = {
            id: timetableId,
            "Class ID": targetClassId,
            "Mã lớp": targetMaLop,
            "Tên lớp": schedule.className,
            "Ngày": dateStr,
            "Thứ": schedule.date ? (schedule.date.day() === 0 ? 8 : schedule.date.day() + 1) : (schedule.day === 0 ? 8 : schedule.day),
            "Giờ bắt đầu": schedule.startTime.format("HH:mm"),
            "Giờ kết thúc": schedule.endTime.format("HH:mm"),
            "Phòng học": schedule.room || "",
            "Giáo viên": targetTeacherName,
            "Teacher ID": targetTeacherId,
            "Ghi chú": `Học bù: ${selectedStudentsData.map(s => s["Tên học sinh"] || s["Họ và tên"]).join(", ")}`
          };
          await supabaseSet("datasheet/Thời_khoá_biểu", timetableData);

          const newSessionData = {
            id: sessionId,
            "Class ID": targetClassId,
            "Mã lớp": targetMaLop,
            "Tên lớp": schedule.className,
            "Ngày": dateStr,
            "Giờ bắt đầu": schedule.startTime.format("HH:mm"),
            "Giờ kết thúc": schedule.endTime.format("HH:mm"),
            "Giáo viên": targetTeacherName,
            "Teacher ID": targetTeacherId,
            "Điểm danh": makeupAttendanceList,
            "Trạng thái": "not_started",
            "Timestamp": new Date().toISOString()
          };
          await supabaseSet("datasheet/Điểm_danh_sessions", newSessionData);
        }

        // Record which session these students were sent to
        selectedStudentIds.forEach(sId => {
          if (!studentTargetSessions[sId]) studentTargetSessions[sId] = [];
          studentTargetSessions[sId].push(finalTargetSessionId);
        });
      }

      if (selectedSessionId && selectedSession) {
        const attendance = parseAttendance(selectedSession["Điểm danh"]);
        const updatedAttendance = attendance.map((record: any) => {
          const sId = record["Student ID"] || record["Mã học sinh"];
          if (selectedStudentIds.includes(sId)) {
            return {
              ...record,
              "Đã xếp lịch bù": true,
              "MakeupTargetSessionIDs": studentTargetSessions[sId] || []
            };
          }
          return record;
        });

        await supabaseUpdate("datasheet/Điểm_danh_sessions", selectedSessionId, {
          "Điểm danh": updatedAttendance,
          "diem_danh": updatedAttendance
        });
      }

      modal.success({
        title: 'Xếp lịch thành công!',
        content: `Đã cập nhật danh sách học bù vào hệ thống điểm danh.`,
        onOk: () => {
          setShowMakeupForm(false);
          setSelectedSessionId(null);
          setSelectedStudentIds([]);
        }
      });

    } catch (error) {
      console.error("Save makeup error:", error);
      messageApi.error("Có lỗi xảy ra khi lưu lịch học bù");
    } finally {
      setSaving(false);
    }
  };

  if (showMakeupForm) {
    return (
      <WrapperContent title="Thiết lập lịch học bù">
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Button icon={<ArrowLeftOutlined />} onClick={() => setShowMakeupForm(false)} disabled={saving}>
            Quay lại chọn học sinh
          </Button>

          <Card title={`Xếp lịch học bù cho ${selectedStudentIds.length} học sinh`}>
            <div style={{ marginBottom: 20 }}>
              <Space split={<Divider type="vertical" />}>
                <Space>
                  <Text strong>Môn học:</Text>
                  <Tag color="cyan">{translateSubject(currentSubject)}</Tag>
                </Space>
                <Space>
                  <Text strong>Học sinh:</Text>
                  {absentStudents.filter(s => selectedStudentIds.includes(s["Student ID"] || s["Mã học sinh"])).map(s => (
                    <Tag key={s["Student ID"] || s["Mã học sinh"]} color="blue">{s["Tên học sinh"] || s["Họ và tên"]}</Tag>
                  ))}
                </Space>
              </Space>
            </div>

            <Form form={form} layout="vertical">
              <Title level={5}>Thông tin lịch học bù</Title>
              <Form.List name="makeupSchedules">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card key={key} size="small" style={{ marginBottom: 16, background: "#fafafa" }} extra={fields.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} disabled={saving} />}>
                        <Row gutter={16} align="bottom">
                          <Col span={24} style={{ marginBottom: 16 }}>
                            <div style={{ background: '#e6f7ff', padding: '12px', borderRadius: '6px', border: '1px solid #91d5ff' }}>
                              <Space>
                                <SearchOutlined style={{ color: '#1890ff' }} />
                                <Text strong>Chọn lớp đích để ghép lịch:</Text>
                                <Select
                                  placeholder="Tìm lớp học và chọn Thứ mong muốn..."
                                  style={{ width: 450 }}
                                  onChange={(val) => handleSelectExistingSession(name, val)}
                                  disabled={saving}
                                  showSearch
                                  optionFilterProp="children"
                                >
                                  {availableSessions.map(s => (
                                    <Select.Option key={s.key} value={s.key}>
                                      {s.label}
                                    </Select.Option>
                                  ))}
                                </Select>
                              </Space>
                            </div>
                          </Col>
                          <Col span={5}><Form.Item {...restField} name={[name, 'date']} label="Ngày học bù" rules={[{ required: true, message: 'Chọn ngày' }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={saving} /></Form.Item></Col>
                          <Col span={6}><Form.Item {...restField} name={[name, 'className']} label="Tên lớp học bù" rules={[{ required: true, message: 'Nhập tên' }]}><Input placeholder="Tên lớp/buổi học bù" disabled={saving} /></Form.Item></Col>
                          <Col span={4}><Form.Item {...restField} name={[name, 'startTime']} label="Giờ bắt đầu" rules={[{ required: true, message: 'Giờ' }]}><TimePicker format="HH:mm" style={{ width: '100%' }} disabled={saving} /></Form.Item></Col>
                          <Col span={4}><Form.Item {...restField} name={[name, 'endTime']} label="Giờ kết thúc" rules={[{ required: true, message: 'Giờ' }]}><TimePicker format="HH:mm" style={{ width: '100%' }} disabled={saving} /></Form.Item></Col>
                          <Col span={5}><Form.Item {...restField} name={[name, 'room']} label="Phòng"><Input placeholder="Phòng học" disabled={saving} /></Form.Item></Col>
                        </Row>
                        {/* Ẩn các field thông tin giáo viên để lưu */}
                        <Form.Item name={[name, 'maLop']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, 'teacherName']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, 'teacherId']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, 'classId']} hidden><Input /></Form.Item>
                      </Card>
                    ))}
                    <Form.Item><Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} disabled={saving}>Thêm buổi học bù khác</Button></Form.Item>
                  </>
                )}
              </Form.List>
              <div style={{ marginTop: 24, textAlign: "right" }}>
                <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={handleSaveMakeup} loading={saving}>Xác nhận xếp lịch & Lưu dữ liệu</Button>
              </div>
            </Form>
          </Card>
        </Space>
      </WrapperContent>
    );
  }

  return (
    <WrapperContent title="Quản lý học bù" isLoading={loading}>
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Quay lại</Button>
          <div style={{ width: '600px' }}>
            <Steps
              size="small"
              current={selectedSessionId ? 1 : 0}
              items={[
                { title: 'Chọn buổi học', icon: <ClockCircleOutlined /> },
                { title: 'Chọn học sinh', icon: <TeamOutlined /> },
                { title: 'Xếp lịch bù', icon: <CalendarOutlined /> },
              ]}
            />
          </div>
        </div>

        {/* BƯỚC 1: CHỌN BUỔI HỌC */}
        <Card
          variant="borderless"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: '12px' }}
          title={<Space><BookOutlined style={{ color: '#1890ff' }} /><span>Bước 1: Chọn buổi học có học sinh vắng</span></Space>}
        >
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Text type="secondary">Hệ thống tự động liệt kê các buổi học có học sinh nghỉ để bạn xếp lịch học bù:</Text>
            <Select
              placeholder={loading ? "Đang tải dữ liệu..." : "Chọn buổi học để xem danh sách vắng..."}
              style={{ width: "100%" }}
              size="large"
              onChange={(value) => setSelectedSessionId(value)}
              showSearch
              optionFilterProp="children"
              disabled={loading}
              value={selectedSessionId}
              className="premium-select"
            >
              {sessionsWithAbsences.map((session) => (
                <Select.Option key={session.id} value={session.id}>
                  <Space>
                    <Badge count={parseAttendance(session["Điểm danh"]).filter((r: any) => !r["Có mặt"] && r["Đã xếp lịch bù"] !== true).length} overflowCount={99} style={{ backgroundColor: '#f5222d' }} />
                    <Text strong>{session["Tên lớp"]}</Text>
                    <Divider type="vertical" />
                    <Text type="secondary">{dayjs(session["Ngày"]).format("DD/MM/YYYY")}</Text>
                  </Space>
                </Select.Option>
              ))}
            </Select>
            {sessionsWithAbsences.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '20px', background: '#f9f9f9', borderRadius: '8px' }}>
                <Empty description="Hiện chưa có buổi học nào ghi nhận học sinh vắng cần xếp lịch bù." />
              </div>
            )}
          </Space>
        </Card>

        {/* BƯỚC 2: CHỌN HỌC SINH */}
        {selectedSessionId ? (
          <Card
            variant="borderless"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: '12px' }}
            title={<Space><TeamOutlined style={{ color: '#52c41a' }} /><span>Bước 2: Chọn học sinh cần học bù (Lớp {selectedSession?.["Tên lớp"]})</span></Space>}
            extra={selectedStudentIds.length > 0 && (
              <Button
                type="primary"
                size="large"
                icon={<HistoryOutlined />}
                style={{ background: "#52c41a", borderColor: "#52c41a", borderRadius: '8px', height: '45px' }}
                onClick={handleProceedToForm}
              >
                Xếp lịch học bù cho {selectedStudentIds.length} bạn
              </Button>
            )}
          >
            <div style={{ padding: "10px 0" }}>
              <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Space direction="vertical" size={0}>
                  <Text strong style={{ fontSize: '16px' }}>Danh sách học sinh vắng mặt:</Text>
                  <Text type="secondary">Nhấp vào thẻ học sinh để chọn</Text>
                </Space>
                {absentStudents.length > 0 && (
                  <Button
                    type={isAllSelected ? "primary" : "default"}
                    onClick={() => handleSelectAll({ target: { checked: !isAllSelected } } as any)}
                    style={{ borderRadius: '6px' }}
                  >
                    {isAllSelected ? "Bỏ chọn tất cả" : `Chọn tất cả (${absentStudents.length})`}
                  </Button>
                )}
              </div>

              <Row gutter={[16, 16]}>
                {absentStudents.map((student: any) => {
                  const sId = student["Student ID"] || student["Mã học sinh"];
                  const sName = student["Tên học sinh"] || student["Họ và tên"];
                  const isSelected = selectedStudentIds.includes(sId);

                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={sId}>
                      <div
                        onClick={() => handleToggleStudent(sId, !isSelected)}
                        style={{
                          padding: "16px",
                          borderRadius: "12px",
                          border: isSelected ? "2px solid #52c41a" : "1px solid #f0f0f0",
                          background: isSelected ? "#f6ffed" : "#fff",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          boxShadow: isSelected ? '0 4px 8px rgba(82, 196, 26, 0.15)' : 'none',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = '#1890ff';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = '#f0f0f0';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: isSelected ? '#52c41a' : '#f5f5f5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isSelected ? '#fff' : '#8c8c8c'
                        }}>
                          <UserOutlined style={{ fontSize: '20px' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <Text strong style={{ display: 'block', color: isSelected ? '#389e0d' : 'inherit' }}>{sName}</Text>
                        </div>
                        {isSelected && (
                          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
                        )}
                      </div>
                    </Col>
                  );
                })}
              </Row>

              {scheduledMakeupStudents.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <Divider orientation="left" style={{ margin: '0 0 20px 0' }}>
                    <Space><HistoryOutlined style={{ color: '#fa8c16' }} /><Text strong>Học sinh ĐÃ được xếp lịch bù</Text></Space>
                  </Divider>
                  <Row gutter={[16, 16]}>
                    {scheduledMakeupStudents.map((student: any) => {
                      const sId = student["Student ID"] || student["Mã học sinh"];
                      const sName = student["Tên học sinh"] || student["Họ và tên"];

                      return (
                        <Col xs={24} sm={12} md={8} lg={6} key={sId}>
                          <div style={{
                            padding: "12px 16px",
                            borderRadius: "12px",
                            border: "1px solid #ffe7ba",
                            background: "#fffbe6",
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                              <Badge status="success" />
                              <div style={{ overflow: 'hidden' }}>
                                <Text strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sName}</Text>
                              </div>
                            </div>
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => handleCancelMakeup(sId)}
                              loading={saving}
                              title="Hủy lịch bù để xếp lại"
                            >
                              Hủy
                            </Button>
                          </div>
                        </Col>
                      );
                    })}
                  </Row>
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" italic style={{ fontSize: '12px' }}>
                      💡 Lưu ý: Khi ấn "Hủy", trạng thái của học sinh sẽ quay lại là "Chưa xếp lịch bù" để bạn có thể chọn lại lớp khác.
                    </Text>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card variant="borderless" style={{ textAlign: "center", padding: "60px", color: "#999", borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical">
                  <Text type="secondary" style={{ fontSize: '16px' }}>Vui lòng chọn một buổi học ở trên để bắt đầu</Text>
                  <Text type="secondary">Dữ liệu vắng mặt sẽ được tự động hiển thị sau khi chọn.</Text>
                </Space>
              }
            />
          </Card>
        )}
      </Space>

      <style>{`
        .premium-select .ant-select-selector {
          border-radius: 10px !important;
          height: 50px !important;
          display: flex !important;
          align-items: center !important;
          border: 1px solid #d9d9d9 !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02) !important;
        }
        .premium-select .ant-select-selection-placeholder {
          line-height: 48px !important;
        }
        .ant-card-title {
          font-weight: 700 !important;
          font-size: 18px !important;
        }
      `}</style>
    </WrapperContent>
  );
};

export default MakeupManagement;
