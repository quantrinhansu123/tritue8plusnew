import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Space,
  Popconfirm,
  Descriptions,
  message,
  Statistic,
  Row,
  Col,
  Card,
  DatePicker,
  Tabs,
  Empty,
  App,
} from "antd";
import { HistoryOutlined } from "@ant-design/icons";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
  EyeOutlined,
  FileTextOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useClasses } from "../../hooks/useClasses";
import { Class, AttendanceSession } from "../../types";
import ClassFormModal from "../../components/ClassFormModal";
import AddStudentModal from "../../components/AddStudentModal";
import WrapperContent from "@/components/WrapperContent";
import { subjectMap } from "@/utils/selectOptions";
import { supabaseGetAll, supabaseSet, supabaseUpdate, supabaseRemove, supabaseOnValue, convertFromSupabaseFormat } from "@/utils/supabaseHelpers";
import { supabaseAdmin } from "@/supabase";
import * as XLSX from "xlsx";
import dayjs, { Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";

const ClassManagementContent = () => {
  const { message } = App.useApp();
  const { classes, loading, deleteClass, removeStudentFromClass } = useClasses();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [viewingClass, setViewingClass] = useState<Class | null>(null);
  const [gradeClass, setGradeClass] = useState<Class | null>(null);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterTeacher, setFilterTeacher] = useState<string>("all");
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [classSessionHistory, setClassSessionHistory] = useState<AttendanceSession[]>([]);
  const [roomsMap, setRoomsMap] = useState<Record<string, any>>({});
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Inline editing state for tuition fee in student list
  const [editingTuitionStudentId, setEditingTuitionStudentId] = useState<string | null>(null);
  const [editingTuitionValue, setEditingTuitionValue] = useState<number | null>(null);
  const [tuitionFees, setTuitionFees] = useState<Record<string, number | null>>({}); // Key: "Mã học sinh-Mã lớp"
  const [classStudentsMap, setClassStudentsMap] = useState<Record<string, string[]>>({}); // Map classId -> studentIds from lop_hoc_hoc_sinh
  const [enrollmentDataMap, setEnrollmentDataMap] = useState<Record<string, any>>({}); // Map enrollmentId -> enrollment data

  const handleEdit = (record: Class) => {
    setEditingClass(record);
    setIsModalOpen(true);
  };

  const handleDelete = async (classId: string) => {
    await deleteClass(classId);
  };

  const handleDeleteMultiple = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất một lớp để xóa");
      return;
    }

    Modal.confirm({
      title: "Xóa nhiều lớp học",
      content: `Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} lớp học đã chọn?`,
      okText: "Xóa",
      cancelText: "Hủy",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          for (const classId of selectedRowKeys) {
            await deleteClass(classId as string);
          }
          setSelectedRowKeys([]);
          message.success(`Đã xóa ${selectedRowKeys.length} lớp học`);
        } catch (error) {
          message.error("Có lỗi xảy ra khi xóa lớp học");
        }
      },
    });
  };

  const handleAddStudent = (record: Class) => {
    setSelectedClass(record);
    setIsStudentModalOpen(true);
  };

  // Load session history for a specific class
  useEffect(() => {
    if (!viewingClass?.id) {
      setClassSessionHistory([]);
      return;
    }

    setLoadingSessions(true);
    const loadSessions = async () => {
      try {
        const data = await supabaseGetAll<AttendanceSession>("datasheet/Điểm_danh_sessions");
        if (data) {
          const sessionsList = Object.entries(data)
            .map(([id, value]) => ({
              id,
              ...value,
            }))
            .filter((session) => {
              // Filter by class ID or class code
              const sessionClassId = session["Class ID"];
              const sessionClassCode = session["Mã lớp"];
              return (
                sessionClassId === viewingClass.id ||
                sessionClassCode === viewingClass["Mã lớp"]
              );
            });
          setClassSessionHistory(sessionsList);
        } else {
          setClassSessionHistory([]);
        }
      } catch (error) {
        console.error("Error loading sessions:", error);
        setClassSessionHistory([]);
      } finally {
        setLoadingSessions(false);
      }
    };

    loadSessions();

    // Subscribe to real-time updates
    const unsubscribe = supabaseOnValue("datasheet/Điểm_danh_sessions", (data) => {
      if (data && viewingClass?.id) {
        const sessionsList = Object.entries(data)
          .map(([id, value]) => ({
            id,
            ...(typeof value === "object" && value !== null ? value : {}),
          }))
          .filter((session) => {
            const sessionClassId = session["Class ID"];
            const sessionClassCode = session["Mã lớp"];
            return (
              sessionClassId === viewingClass.id ||
              sessionClassCode === viewingClass["Mã lớp"]
            );
          }) as AttendanceSession[];
        setClassSessionHistory(sessionsList);
      } else {
        setClassSessionHistory([]);
      }
      setLoadingSessions(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [viewingClass?.id, viewingClass?.["Mã lớp"]]);

  // Load rooms map to display room names instead of raw IDs
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const data = await supabaseGetAll("datasheet/Phòng_học");
        if (data && typeof data === 'object') {
          // Convert from Supabase format to Firebase format
          const convertedRoomsMap: Record<string, any> = {};
          Object.entries(data).forEach(([id, roomData]: [string, any]) => {
            const converted = convertFromSupabaseFormat(roomData, "phong_hoc");
            convertedRoomsMap[id] = converted;
          });
          console.log("🏢 Rooms loaded from Supabase:", Object.keys(convertedRoomsMap).length);
          setRoomsMap(convertedRoomsMap);
        } else {
          // Table might not exist yet, use empty map
          console.warn("⚠️ No rooms data from Supabase");
          setRoomsMap({});
        }
      } catch (error) {
        console.error("Error loading rooms:", error);
        setRoomsMap({});
      }
    };

    loadRooms();

    // Subscribe to real-time updates (only if table exists)
    const unsubscribe = supabaseOnValue("datasheet/Phòng_học", (data) => {
      if (data && typeof data === 'object') {
        // Convert from Supabase format to Firebase format
        const convertedRoomsMap: Record<string, any> = {};
        Object.entries(data).forEach(([id, roomData]: [string, any]) => {
          const converted = convertFromSupabaseFormat(roomData, "phong_hoc");
          convertedRoomsMap[id] = converted;
        });
        setRoomsMap(convertedRoomsMap);
      } else {
        setRoomsMap({});
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleViewDetail = async (record: Class) => {
    setViewingClass(record);
    setIsDetailModalOpen(true);

    // Load students for this class from lop_hoc_hoc_sinh if needed
    if (record.id) {
      try {
        const enrollmentData = await supabaseGetAll("datasheet/Lớp_học/Học_sinh");
        if (enrollmentData) {
          const studentsByClass: Record<string, string[]> = {};

          Object.values(enrollmentData).forEach((item: any) => {
            const classId = item.classId || item.class_id;
            const studentId = item.studentId || item.student_id;
            const status = item.status || "active";

            if (classId && status === "active" && studentId) {
              if (!studentsByClass[classId]) {
                studentsByClass[classId] = [];
              }
              if (!studentsByClass[classId].includes(studentId)) {
                studentsByClass[classId].push(studentId);
              }
            }
          });

          // Update the map for this specific class
          setClassStudentsMap(prev => ({
            ...prev,
            ...studentsByClass
          }));

          console.log(`📋 Loaded students for class ${record.id}:`, studentsByClass[record.id]?.length || 0);
        }
      } catch (error) {
        console.error("Error loading class students:", error);
      }
    }
  };

  const handleSaveTuitionFee = async (studentId: string, tuitionFee: number | null) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) {
        message.error("Không tìm thấy học sinh");
        setEditingTuitionStudentId(null);
        setEditingTuitionValue(null);
        return;
      }

      if (!viewingClass) {
        message.error("Không tìm thấy thông tin lớp học");
        setEditingTuitionStudentId(null);
        setEditingTuitionValue(null);
        return;
      }

      // Create enrollment ID: classId-studentId
      const enrollmentId = `${viewingClass.id}-${studentId}`;
      const studentCode = student["Mã học sinh"] || "";
      const classCode = viewingClass["Mã lớp"] || "";

      // Update in lop_hoc_hoc_sinh table
      const success = await supabaseUpdate("datasheet/Lớp_học/Học_sinh", enrollmentId, {
        hoc_phi_rieng: tuitionFee,
        student_code: studentCode,
        student_name: student["Họ và tên"] || "",
      });

      if (success) {
        setEditingTuitionStudentId(null);
        setEditingTuitionValue(null);
        message.success("Đã cập nhật học phí riêng thành công!");

        // Reload tuition fees
        const enrollmentData = await supabaseGetAll("datasheet/Lớp_học/Học_sinh");
        if (enrollmentData) {
          const tuitionMap: Record<string, number | null> = {};
          Object.values(enrollmentData).forEach((item: any) => {
            if (item && item.studentCode && item.classId) {
              const classData = classes.find(c => c.id === item.classId);
              if (classData && classData["Mã lớp"]) {
                const key = `${item.studentCode}-${classData["Mã lớp"]}`;
                tuitionMap[key] = item.hocPhiRieng || item.hoc_phi_rieng || null;
              }
            }
          });
          setTuitionFees(tuitionMap);
        }
      } else {
        message.error("Không cập nhật được học phí");
        setEditingTuitionStudentId(null);
        setEditingTuitionValue(null);
      }
    } catch (error) {
      console.error("Error updating tuition fee:", error);
      message.error("Có lỗi xảy ra khi cập nhật học phí");
      setEditingTuitionStudentId(null);
      setEditingTuitionValue(null);
    }
  };

  const handleSyncStudents = async () => {
    if (!viewingClass) {
      message.error("Không tìm thấy thông tin lớp học");
      return;
    }

    const studentIds = viewingClass["Student IDs"] || [];
    if (studentIds.length === 0) {
      message.warning("Lớp học chưa có học sinh nào");
      return;
    }

    try {
      message.loading({ content: "Đang đồng bộ dữ liệu học sinh từ Supabase...", key: "sync" });

      // Fetch fresh student data from Supabase
      const studentsData = await supabaseGetAll("datasheet/Học_sinh");

      if (studentsData && typeof studentsData === 'object') {
        // Convert from Supabase format to Firebase format for display
        const studentsArray = Object.entries(studentsData).map(
          ([id, data]: [string, any]) => {
            const converted = convertFromSupabaseFormat(data, "hoc_sinh");
            return {
              id,
              ...converted,
            };
          }
        );
        setStudents(studentsArray);
        console.log("✅ Đã đồng bộ học sinh từ Supabase:", studentsArray.length);
      } else {
        message.error({ content: "Không thể lấy dữ liệu học sinh từ Supabase", key: "sync" });
        return;
      }

      // Also refresh enrollment data from Supabase
      const enrollmentData = await supabaseGetAll("datasheet/Lớp_học/Học_sinh");
      if (enrollmentData && typeof enrollmentData === 'object') {
        const tuitionMap: Record<string, number | null> = {};
        const studentsByClass: Record<string, string[]> = {};
        const enrollmentMap: Record<string, any> = {};

        Object.entries(enrollmentData).forEach(([enrollmentId, item]: [string, any]) => {
          // Convert from Supabase format
          const converted = convertFromSupabaseFormat(item, "lop_hoc_hoc_sinh");
          const classId = converted.classId || item.class_id;
          const studentId = converted.studentId || item.student_id;
          const studentCode = converted.studentCode || item.student_code;
          const studentName = converted.studentName || item.student_name || "";
          const status = converted.status || item.status || "active";
          const hocPhiRieng = converted.hocPhiRieng || item.hoc_phi_rieng;

          if (item && classId) {
            // Store enrollment data by studentId for quick lookup
            if (studentId) {
              enrollmentMap[studentId] = {
                studentId,
                studentCode,
                studentName,
                classId,
                hocPhiRieng,
                status,
              };
            }

            // Only include active students
            if (status === "active" && studentId) {
              if (!studentsByClass[classId]) {
                studentsByClass[classId] = [];
              }
              if (!studentsByClass[classId].includes(studentId)) {
                studentsByClass[classId].push(studentId);
              }
            }

            // Build tuition map
            if (studentCode && classId) {
              // Get class code from classId
              const classData = classes.find(c => c.id === classId);
              if (classData && classData["Mã lớp"]) {
                const key = `${studentCode}-${classData["Mã lớp"]}`;
                tuitionMap[key] = hocPhiRieng || null;
              }
            }
          }
        });

        setTuitionFees(tuitionMap);
        setClassStudentsMap(studentsByClass);
        setEnrollmentDataMap(enrollmentMap);
        console.log("✅ Đã đồng bộ enrollment data từ Supabase");
      }

      message.success({
        content: `Đã đồng bộ dữ liệu cho ${studentIds.length} học sinh từ Supabase`,
        key: "sync",
        duration: 3
      });
    } catch (error) {
      console.error("Error syncing students:", error);
      message.error({
        content: `Có lỗi xảy ra khi đồng bộ dữ liệu: ${error instanceof Error ? error.message : "Unknown error"}`,
        key: "sync",
        duration: 5
      });
    }
  };

  const handleFillAllTuitionFees = async () => {
    if (!viewingClass) {
      message.error("Không tìm thấy thông tin lớp học");
      return;
    }

    const classTuitionFee = viewingClass["Học phí mỗi buổi"];
    if (!classTuitionFee || classTuitionFee === 0) {
      message.warning("Lớp học chưa có học phí mỗi buổi. Vui lòng cập nhật học phí lớp học trước.");
      return;
    }

    // Get student IDs from class or from lop_hoc_hoc_sinh
    let studentIds = viewingClass["Student IDs"] || viewingClass["student_ids"] || [];
    if ((!studentIds || studentIds.length === 0) && viewingClass?.id) {
      studentIds = classStudentsMap[viewingClass.id] || [];
    }

    if (studentIds.length === 0) {
      message.warning("Lớp học chưa có học sinh nào");
      return;
    }

    Modal.confirm({
      title: "Điền học phí riêng",
      content: `Bạn có chắc chắn muốn điền học phí chung (${classTuitionFee.toLocaleString('vi-VN')} đ) vào tất cả ${studentIds.length} học sinh trong lớp này không?`,
      okText: "Điền",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const updatedTuitionKeys: string[] = [];
          const classCode = viewingClass["Mã lớp"] || "";

          if (!classCode) {
            message.error("Lớp học chưa có mã lớp");
            return;
          }

          console.log(`📋 Starting to fill tuition fees for ${studentIds.length} students`);
          console.log(`📋 Class ID: ${viewingClass.id}, Class Code: ${classCode}`);
          console.log(`📋 Tuition Fee: ${classTuitionFee}`);

          // Update all students in parallel - save to lop_hoc_hoc_sinh table
          const updatePromises = studentIds.map(async (studentId) => {
            // Get student data from hoc_sinh table (primary source)
            const student = students.find((s) => s.id === studentId);

            // Get existing enrollment data if available (optional)
            const enrollment = enrollmentDataMap[studentId];

            // Get student code - prioritize from hoc_sinh table, then enrollment, then fallback to studentId
            const studentCode = student?.["Mã học sinh"] || student?.ma_hoc_sinh || enrollment?.studentCode || enrollment?.student_code || studentId;

            // Get student name - prioritize from hoc_sinh table, then enrollment
            const studentName = student?.["Họ và tên"] || student?.ho_va_ten || enrollment?.studentName || enrollment?.student_name || "";

            // Create enrollment ID: classId-studentId
            const enrollmentId = `${viewingClass.id}-${studentId}`;

            try {
              console.log(`📋 Updating enrollment ${enrollmentId} with:`, {
                class_id: viewingClass.id,
                student_id: studentId,
                student_code: studentCode,
                student_name: studentName,
                hoc_phi_rieng: classTuitionFee,
              });

              // Use upsert to create if not exists, update if exists
              const success = await supabaseSet("datasheet/Lớp_học/Học_sinh", {
                id: enrollmentId,
                class_id: viewingClass.id,
                student_id: studentId,
                student_code: studentCode,
                student_name: studentName,
                hoc_phi_rieng: classTuitionFee,
                status: "active",
              }, { upsert: true });

              console.log(`📋 Update result for ${enrollmentId}:`, success);

              if (success) {
                successCount++;
                return enrollmentId;
              } else {
                console.error(`❌ Failed to update ${enrollmentId}`);
                failCount++;
                return null;
              }
            } catch (error) {
              console.error(`❌ Error updating tuition fee for ${enrollmentId}:`, error);
              failCount++;
              return null;
            }
          });

          await Promise.all(updatePromises);

          // Reload tuition fees and enrollment data to update local state
          const enrollmentData = await supabaseGetAll("datasheet/Lớp_học/Học_sinh");
          if (enrollmentData) {
            const tuitionMap: Record<string, number | null> = {};
            const studentsByClass: Record<string, string[]> = {};
            const enrollmentMap: Record<string, any> = {};

            Object.entries(enrollmentData).forEach(([enrollmentId, item]: [string, any]) => {
              const classId = item.classId || item.class_id;
              const studentId = item.studentId || item.student_id;
              const studentCode = item.studentCode || item.student_code;
              const studentName = item.studentName || item.student_name;
              const status = item.status || "active";
              const hocPhiRieng = item.hocPhiRieng || item.hoc_phi_rieng;

              if (item && classId) {
                // Store enrollment data by studentId
                if (studentId) {
                  enrollmentMap[studentId] = {
                    studentId,
                    studentCode,
                    studentName,
                    classId,
                    hocPhiRieng,
                    status,
                  };
                }

                // Build students by class map
                if (status === "active" && studentId) {
                  if (!studentsByClass[classId]) {
                    studentsByClass[classId] = [];
                  }
                  if (!studentsByClass[classId].includes(studentId)) {
                    studentsByClass[classId].push(studentId);
                  }
                }

                // Build tuition map
                if (studentCode && classId) {
                  const classData = classes.find(c => c.id === classId);
                  if (classData && classData["Mã lớp"]) {
                    const key = `${studentCode}-${classData["Mã lớp"]}`;
                    tuitionMap[key] = hocPhiRieng || null;
                  }
                }
              }
            });

            setTuitionFees(tuitionMap);
            setClassStudentsMap(prev => ({ ...prev, ...studentsByClass }));
            setEnrollmentDataMap(prev => ({ ...prev, ...enrollmentMap }));
          }

          if (successCount > 0) {
            message.success(`Đã điền học phí cho ${successCount} học sinh thành công!${failCount > 0 ? ` (${failCount} học sinh thất bại)` : ''}`);
          } else {
            message.error("Không thể điền học phí cho học sinh nào");
          }
        } catch (error) {
          console.error("Error filling tuition fees:", error);
          message.error("Có lỗi xảy ra khi điền học phí");
        }
      },
    });
  };

  const handleViewGrades = (record: Class) => {
    setGradeClass(record);
    setIsGradeModalOpen(true);
  };

  // Filter sessions by month
  const filteredSessions = useMemo(() => {
    const monthStart = selectedMonth.startOf("month");
    const monthEnd = selectedMonth.endOf("month");

    return classSessionHistory
      .filter((session) => {
        if (session["Trạng thái"] !== "completed") return false;
        const sessionDate = dayjs(session["Ngày"]);
        if (!sessionDate.isValid()) return false;
        return (
          sessionDate.isSameOrAfter(monthStart, "day") &&
          sessionDate.isSameOrBefore(monthEnd, "day")
        );
      })
      .sort((a, b) => {
        const dateA = dayjs(a["Ngày"]);
        const dateB = dayjs(b["Ngày"]);
        if (dateA.isBefore(dateB)) return 1;
        if (dateA.isAfter(dateB)) return -1;
        return (a["Giờ bắt đầu"] || "").localeCompare(b["Giờ bắt đầu"] || "");
      });
  }, [classSessionHistory, selectedMonth]);

  // Get attendance count for a session
  const getAttendanceCount = (session: AttendanceSession) => {
    if (!session["Điểm danh"]) return { present: 0, total: 0 };
    const records = Array.isArray(session["Điểm danh"])
      ? session["Điểm danh"]
      : Object.values(session["Điểm danh"] || {});
    const present = records.filter((r: any) => r["Có mặt"] === true).length;
    return { present, total: records.length };
  };

  // Session history table columns
  const sessionHistoryColumns = [
    {
      title: "Ngày",
      dataIndex: "Ngày",
      key: "date",
      width: 120,
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Giờ học",
      key: "time",
      width: 150,
      render: (_: any, record: AttendanceSession) =>
        `${record["Giờ bắt đầu"] || "-"} - ${record["Giờ kết thúc"] || "-"}`,
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
      width: 200,
      render: (_: any, record: AttendanceSession) => (
        <Space size="small">
          <Button
            size="small"
            onClick={() => {
              navigate(`/workspace/classes/${record["Class ID"]}/history`);
              setIsDetailModalOpen(false);
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

  // Load students, attendance sessions, and tuition fees from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch students from Supabase
        const studentsData = await supabaseGetAll("datasheet/Học_sinh");
        if (studentsData && typeof studentsData === 'object') {
          // Convert from Supabase format to Firebase format for display
          const studentsArray = Object.entries(studentsData).map(
            ([id, data]: [string, any]) => {
              const converted = convertFromSupabaseFormat(data, "hoc_sinh");
              return {
                id,
                ...converted,
              };
            }
          );
          console.log("📚 Students loaded from Supabase:", studentsArray.length);
          setStudents(studentsArray);
        } else {
          console.warn("⚠️ No students data from Supabase");
          setStudents([]);
        }

        // Fetch attendance sessions from Supabase
        const sessionsData = await supabaseGetAll("datasheet/Điểm_danh_sessions");
        if (sessionsData) {
          const sessionsArray = Object.entries(sessionsData).map(
            ([id, data]: [string, any]) => ({
              id,
              ...data,
            })
          );
          setAttendanceSessions(sessionsArray);
        }

        // Fetch tuition fees and student list from lop_hoc_hoc_sinh table
        const enrollmentData = await supabaseGetAll("datasheet/Lớp_học/Học_sinh");
        if (enrollmentData) {
          const tuitionMap: Record<string, number | null> = {};
          const studentsByClass: Record<string, string[]> = {};
          const enrollmentMap: Record<string, any> = {};

          Object.entries(enrollmentData).forEach(([enrollmentId, item]: [string, any]) => {
            // Handle both camelCase (after conversion) and snake_case (raw from Supabase)
            const classId = item.classId || item.class_id;
            const studentId = item.studentId || item.student_id;
            const studentCode = item.studentCode || item.student_code;
            // Get student_name - check both converted and raw format
            const studentName = item.studentName || item.student_name || "";
            const status = item.status || "active";
            const hocPhiRieng = item.hocPhiRieng || item.hoc_phi_rieng;

            console.log(`📋 Enrollment ${enrollmentId}:`, {
              studentId,
              studentName,
              studentCode,
              classId,
              rawItem: item
            });

            if (item && classId) {
              // Store enrollment data by studentId for quick lookup
              if (studentId) {
                enrollmentMap[studentId] = {
                  studentId,
                  studentCode,
                  studentName,
                  classId,
                  hocPhiRieng,
                  status,
                };
              }

              // Only include active students
              if (status === "active" && studentId) {
                if (!studentsByClass[classId]) {
                  studentsByClass[classId] = [];
                }
                if (!studentsByClass[classId].includes(studentId)) {
                  studentsByClass[classId].push(studentId);
                }
              }

              // Build tuition map
              if (studentCode && classId) {
                // Get class code from classId
                const classData = classes.find(c => c.id === classId);
                if (classData && classData["Mã lớp"]) {
                  const key = `${studentCode}-${classData["Mã lớp"]}`;
                  tuitionMap[key] = hocPhiRieng || null;
                }
              }
            }
          });

          console.log("📊 Loaded class students map:", studentsByClass);
          console.log("📊 Loaded tuition fees map:", tuitionMap);
          console.log("📊 Loaded enrollment data map:", enrollmentMap);

          setTuitionFees(tuitionMap);
          setClassStudentsMap(studentsByClass);
          setEnrollmentDataMap(enrollmentMap);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();

    // Subscribe to students changes
    const unsubStudents = supabaseOnValue("datasheet/Học_sinh", (data) => {
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        const studentsArray = Object.entries(data).map(([id, val]: [string, any]) => {
          const converted = convertFromSupabaseFormat(val, "hoc_sinh");
          return { id, ...converted };
        });
        setStudents(studentsArray);
      }
    });

    // Subscribe to enrollment changes
    const unsubEnrollments = supabaseOnValue("datasheet/Lớp_học/Học_sinh", (data) => {
      if (data) {
        const tuitionMap: Record<string, number | null> = {};
        const studentsByClass: Record<string, string[]> = {};
        const enrollmentMap: Record<string, any> = {};

        Object.entries(data).forEach(([enrollmentId, item]: [string, any]) => {
          const classId = item.classId || item.class_id;
          const studentId = item.studentId || item.student_id;
          const studentCode = item.studentCode || item.student_code;
          const status = item.status || "active";
          const hocPhiRieng = item.hocPhiRieng || item.hoc_phi_rieng;

          if (item && classId) {
            if (studentId) {
              enrollmentMap[studentId] = { studentId, studentCode, classId, hocPhiRieng, status };
            }
            if (status === "active" && studentId) {
              if (!studentsByClass[classId]) studentsByClass[classId] = [];
              if (!studentsByClass[classId].includes(studentId)) studentsByClass[classId].push(studentId);
            }
          }
        });

        setTuitionFees(tuitionMap);
        setClassStudentsMap(studentsByClass);
        setEnrollmentDataMap(enrollmentMap);
      }
    });

    return () => {
      if (unsubStudents) unsubStudents();
      if (unsubEnrollments) unsubEnrollments();
    };
  }, []);

  // Get unique values for filters
  const uniqueSubjects = useMemo(() => {
    const subjects = new Set(
      classes
        .map((c) => c["Môn học"])
        .filter((subject): subject is string => !!subject)
    );
    return Array.from(subjects).sort();
  }, [classes]);

  const uniqueGrades = useMemo(() => {
    const grades = new Set(
      classes
        .map((c) => c["Khối"])
        .filter((grade) => grade != null)
        .map((grade) => String(grade))
    );
    return Array.from(grades).sort((a, b) => Number(a) - Number(b));
  }, [classes]);

  const uniqueTeachers = useMemo(() => {
    const teachers = new Set(
      classes
        .map((c) => c["Giáo viên chủ nhiệm"])
        .filter((teacher): teacher is string => !!teacher)
    );
    return Array.from(teachers).sort();
  }, [classes]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set(
      classes
        .map((c: any) => c["Địa điểm"] || c["Phòng học"] || "")
        .filter((r: string) => !!r)
    );
    return Array.from(rooms).sort();
  }, [classes]);

  // Apply all filters
  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      // Status filter
      if (filterStatus !== "all" && c["Trạng thái"] !== filterStatus) {
        return false;
      }

      // Subject filter
      if (filterSubject !== "all" && c["Môn học"] !== filterSubject) {
        return false;
      }

      // Grade filter
      if (filterGrade !== "all" && c["Khối"]?.toString() !== filterGrade) {
        return false;
      }

      // Teacher filter
      if (
        filterTeacher !== "all" &&
        c["Giáo viên chủ nhiệm"] !== filterTeacher
      ) {
        return false;
      }

      // Room filter
      if (filterRoom !== "all") {
        const room = c["Phòng học"] || c["Địa điểm"] || "";
        if (room !== filterRoom) return false;
      }

      // Search filter (search in class name, code, teacher)
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchName = c["Tên lớp"]?.toLowerCase().includes(search) || false;
        const matchCode = c["Mã lớp"]?.toLowerCase().includes(search) || false;
        const matchTeacher = c["Giáo viên chủ nhiệm"]
          ?.toLowerCase()
          .includes(search) || false;

        if (!matchName && !matchCode && !matchTeacher) {
          return false;
        }
      }

      return true;
    });
  }, [
    classes,
    filterStatus,
    filterSubject,
    filterGrade,
    filterTeacher,
    filterRoom,
    searchTerm,
  ]);

  // Reset all filters
  const handleResetFilters = () => {
    setFilterStatus("all");
    setFilterSubject("all");
    setFilterGrade("all");
    setFilterTeacher("all");
    setSearchTerm("");
    setFilterRoom("all");
  };

  const columns = [
    {
      title: "Mã lớp",
      dataIndex: "Mã lớp",
      key: "code",
      width: 120,
    },
    {
      title: "Tên lớp",
      dataIndex: "Tên lớp",
      key: "name",
      width: 200,
    },
    {
      title: "Môn học",
      dataIndex: "Môn học",
      key: "subject",
      width: 150,
      render: (subject: string) => subjectMap[subject] || subject,
    },
    {
      title: "Khối",
      dataIndex: "Khối",
      key: "grade",
      width: 100,
    },
    {
      title: "Giáo viên",
      dataIndex: "Giáo viên chủ nhiệm",
      key: "teacher",
      width: 180,
    },
    {
      title: "Số học sinh",
      key: "studentCount",
      width: 120,
      render: (_: any, record: Class) => (
        <span>{Array.isArray(record["Student IDs"]) ? record["Student IDs"].length : 0}</span>
      ),
    },
    {
      title: "Học phí/buổi",
      dataIndex: "Học phí mỗi buổi",
      key: "tuition",
      width: 130,
      render: (fee: number) =>
        fee ? `${fee.toLocaleString('vi-VN')} đ` : "-",
    },
    {
      title: "Lương GV",
      dataIndex: "Lương GV",
      key: "salary",
      width: 140,
      render: (val: number) => (val ? `${val.toLocaleString('vi-VN')} đ` : "-"),
    },
    {
      title: "Lịch học",
      key: "schedule",
      width: 200,
      render: (_: any, record: Class) => (
        <div>
          {record["Lịch học"] && Array.isArray(record["Lịch học"]) && record["Lịch học"].length > 0 ? (
            record["Lịch học"].map((schedule, index) => (
              <div key={index} style={{ fontSize: "12px" }}>
                Thứ {schedule["Thứ"]}: {schedule["Giờ bắt đầu"]} -{" "}
                {schedule["Giờ kết thúc"]}
              </div>
            ))
          ) : (
            <span style={{ color: "#999" }}>Chưa có lịch</span>
          )}
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "Trạng thái",
      key: "status",
      width: 120,
      render: (status: string) => (
        <Tag color={status === "active" ? "green" : "red"}>
          {status === "active" ? "Hoạt động" : "Ngừng"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 220,
      fixed: "right" as const,
      render: (_: any, record: Class) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            size="small"
          >
            Xem
          </Button>
          <Button
            type="link"
            icon={<FileTextOutlined />}
            onClick={() => navigate(`/workspace/classes/${record.id}/grades`)}
            size="small"
          >
            Điểm
          </Button>
          <Button
            type="link"
            icon={<UserAddOutlined />}
            onClick={() => handleAddStudent(record)}
            size="small"
          >
            HS
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          <Popconfirm
            title="Xóa lớp học"
            description="Bạn có chắc chắn muốn xóa lớp học này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              Xóa lớp
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <WrapperContent
      title="Quản lý lớp học"
      toolbar={
        <Space>
          {selectedRowKeys.length > 0 && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteMultiple}
            >
              Xóa {selectedRowKeys.length} lớp đã chọn
            </Button>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingClass(null);
              setIsModalOpen(true);
            }}
          >
            Thêm lớp học
          </Button>
        </Space>
      }
    >
      {/* Filter Section */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <div>
              <label
                style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
              >
                Tìm kiếm:
              </label>
              <Input
                placeholder="Tên lớp, mã lớp, giáo viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                allowClear
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div>
              <label
                style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
              >
                Trạng thái:
              </label>
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                style={{ width: "100%" }}
              >
                <Select.Option value="all">Tất cả</Select.Option>
                <Select.Option value="active">Hoạt động</Select.Option>
                <Select.Option value="inactive">Ngừng</Select.Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div>
              <label
                style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
              >
                Môn học:
              </label>
              <Select
                value={filterSubject}
                onChange={setFilterSubject}
                style={{ width: "100%" }}
                showSearch
                optionFilterProp="children"
              >
                <Select.Option value="all">Tất cả</Select.Option>
                {uniqueSubjects.map((subject) => (
                  <Select.Option key={subject} value={subject}>
                    {subjectMap[subject] || subject}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div>
              <label
                style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
              >
                Khối:
              </label>
              <Select
                value={filterGrade}
                onChange={setFilterGrade}
                style={{ width: "100%" }}
              >
                <Select.Option value="all">Tất cả</Select.Option>
                {uniqueGrades.map((grade) => (
                  <Select.Option key={grade} value={grade.toString()}>
                    Khối {grade}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div>
              <label
                style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
              >
                Giáo viên:
              </label>
              <Select
                value={filterTeacher}
                onChange={setFilterTeacher}
                style={{ width: "100%" }}
                showSearch
                optionFilterProp="children"
              >
                <Select.Option value="all">Tất cả</Select.Option>
                {uniqueTeachers.map((teacher) => (
                  <Select.Option key={teacher} value={teacher}>
                    {teacher}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div>
              <label
                style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
              >
                Phòng học:
              </label>
              <Select
                value={filterRoom}
                onChange={setFilterRoom}
                style={{ width: "100%" }}
                showSearch
                optionFilterProp="children"
              >
                <Select.Option value="all">Tất cả phòng học</Select.Option>
                {uniqueRooms.map((r) => (
                  <Select.Option key={r} value={r}>
                    {r}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div>
              <label
                style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
              >
                &nbsp;
              </label>
              <Button onClick={handleResetFilters} block>
                Xóa bộ lọc
              </Button>
            </div>
          </Col>
        </Row>
        <Row style={{ marginTop: 16 }}>
          <Col span={24}>
            <Space>
              <Tag color="blue">
                Tìm thấy: {filteredClasses.length} / {classes.length} lớp học
              </Tag>
              {filterStatus !== "all" && (
                <Tag
                  color="green"
                  closable
                  onClose={() => setFilterStatus("all")}
                >
                  Trạng thái:{" "}
                  {filterStatus === "active" ? "Hoạt động" : "Ngừng"}
                </Tag>
              )}
              {filterSubject !== "all" && (
                <Tag
                  color="purple"
                  closable
                  onClose={() => setFilterSubject("all")}
                >
                  Môn: {subjectMap[filterSubject] || filterSubject}
                </Tag>
              )}
              {filterGrade !== "all" && (
                <Tag
                  color="orange"
                  closable
                  onClose={() => setFilterGrade("all")}
                >
                  Khối {filterGrade}
                </Tag>
              )}
              {filterTeacher !== "all" && (
                <Tag
                  color="cyan"
                  closable
                  onClose={() => setFilterTeacher("all")}
                >
                  GV: {filterTeacher}
                </Tag>
              )}
              {filterRoom !== "all" && (
                <Tag
                  color="geekblue"
                  closable
                  onClose={() => setFilterRoom("all")}
                >
                  Phòng học: {filterRoom}
                </Tag>
              )}
              {searchTerm && (
                <Tag color="magenta" closable onClose={() => setSearchTerm("")}>
                  Tìm kiếm: "{searchTerm}"
                </Tag>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredClasses}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1400 }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          getCheckboxProps: (record) => ({
            name: record.id,
          }),
        }}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `Tổng ${total} lớp học`,
        }}
      />

      <ClassFormModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingClass(null);
        }}
        editingClass={editingClass}
      />

      <AddStudentModal
        open={isStudentModalOpen}
        onClose={() => {
          setIsStudentModalOpen(false);
          setSelectedClass(null);
        }}
        classData={selectedClass}
      />

      <Modal
        title={`Chi tiết lớp học - ${viewingClass?.["Tên lớp"] || ""}`}
        open={isDetailModalOpen}
        onCancel={() => {
          setIsDetailModalOpen(false);
          setViewingClass(null);
          setClassSessionHistory([]);
          setEditingTuitionStudentId(null);
          setEditingTuitionValue(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setIsDetailModalOpen(false);
            setViewingClass(null);
            setClassSessionHistory([]);
          }}>
            Đóng
          </Button>,
        ]}
        width={1000}
      >
        {viewingClass && (
          <Tabs
            defaultActiveKey="info"
            items={[
              {
                key: "info",
                label: "Thông tin lớp học",
                children: (
                  <div>
                    <Descriptions column={2} bordered>
                      <Descriptions.Item label="Mã lớp">
                        {viewingClass["Mã lớp"]}
                      </Descriptions.Item>
                      <Descriptions.Item label="Tên lớp">
                        {viewingClass["Tên lớp"]}
                      </Descriptions.Item>
                      <Descriptions.Item label="Môn học">
                        {subjectMap[viewingClass["Môn học"]] || viewingClass["Môn học"]}
                      </Descriptions.Item>
                      <Descriptions.Item label="Khối">
                        {viewingClass["Khối"]}
                      </Descriptions.Item>
                      <Descriptions.Item label="Giáo viên chủ nhiệm">
                        {viewingClass["Giáo viên chủ nhiệm"]}
                      </Descriptions.Item>
                      <Descriptions.Item label="Lương GV">
                        {viewingClass["Lương GV"] ? `${viewingClass["Lương GV"].toLocaleString('vi-VN')} đ` : "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Lịch học trong tuần">
                        {viewingClass["Lịch học"] && viewingClass["Lịch học"].length > 0 ? (
                          <div>
                            {viewingClass["Lịch học"].map((schedule, index) => (
                              <div key={index} style={{ marginBottom: index < viewingClass["Lịch học"].length - 1 ? "8px" : "0" }}>
                                <Tag color="blue">
                                  Thứ {schedule["Thứ"]}: {schedule["Giờ bắt đầu"]} - {schedule["Giờ kết thúc"]}
                                </Tag>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#999" }}>Chưa có lịch học</span>
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="Số học sinh">
                        {viewingClass["Student IDs"]?.length || 0}
                      </Descriptions.Item>
                      <Descriptions.Item label="Trạng thái">
                        <Tag
                          color={
                            viewingClass["Trạng thái"] === "active" ? "green" : "red"
                          }
                        >
                          {viewingClass["Trạng thái"] === "active"
                            ? "Hoạt động"
                            : "Ngừng"}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Ngày tạo" span={2}>
                        {new Date(viewingClass["Ngày tạo"]).toLocaleString("vi-VN")}
                      </Descriptions.Item>
                      <Descriptions.Item label="Người tạo" span={2}>
                        {viewingClass["Người tạo"]}
                      </Descriptions.Item>
                    </Descriptions>

                    {(() => {
                      // Get student IDs from class or from lop_hoc_hoc_sinh table
                      let studentIds = viewingClass["Student IDs"] || viewingClass["student_ids"] || [];

                      // Fallback: Load from lop_hoc_hoc_sinh if not in class data
                      if ((!studentIds || studentIds.length === 0) && viewingClass?.id) {
                        studentIds = classStudentsMap[viewingClass.id] || [];
                        console.log(`📋 Using fallback: Loaded ${studentIds.length} students from lop_hoc_hoc_sinh for class ${viewingClass.id}`);
                      }

                      console.log(`📋 Class ${viewingClass?.id}: Student IDs from class =`, viewingClass["Student IDs"]?.length || 0);
                      console.log(`📋 Class ${viewingClass?.id}: Student IDs from map =`, classStudentsMap[viewingClass?.id || ""]?.length || 0);
                      console.log(`📋 Final studentIds =`, studentIds.length);

                      const hasStudents = Array.isArray(studentIds) && studentIds.length > 0;

                      if (!hasStudents) {
                        console.log(`⚠️ No students found for class ${viewingClass?.id}`);
                        return null;
                      }

                      return (
                        <div style={{ marginTop: 24 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h4 style={{ margin: 0 }}>
                              Danh sách học sinh ({studentIds.length}):
                            </h4>
                            <Space>
                              <Button
                                icon={<ReloadOutlined />}
                                onClick={handleSyncStudents}
                              >
                                Đồng bộ
                              </Button>
                              <Button
                                type="primary"
                                onClick={handleFillAllTuitionFees}
                                disabled={!viewingClass["Học phí mỗi buổi"] || viewingClass["Học phí mỗi buổi"] === 0}
                              >
                                Điền học phí
                              </Button>
                            </Space>
                          </div>
                          <Table
                            dataSource={studentIds
                              .map((studentId) => {
                                const student = students.find((s) => s.id === studentId);
                                const enrollment = enrollmentDataMap[studentId];

                                // Debug: Log if student not found
                                if (!student && !enrollment) {
                                  console.warn(`⚠️ Student ${studentId} not found in students array or enrollment map`);
                                  console.warn(`   Total students loaded: ${students.length}`);
                                  console.warn(`   Total enrollments: ${Object.keys(enrollmentDataMap).length}`);
                                  console.warn(`   Student IDs in students:`, students.map(s => s.id).slice(0, 5));
                                }

                                // Get student info - prioritize student_name from lop_hoc_hoc_sinh
                                let studentName = enrollment?.studentName || enrollment?.student_name || student?.["Họ và tên"] || student?.ho_va_ten || "";
                                let studentCode = enrollment?.studentCode || enrollment?.student_code || student?.["Mã học sinh"] || student?.ma_hoc_sinh || "";
                                let studentPhone = student?.["Số điện thoại"] || student?.so_dien_thoai || "-";
                                let parentPhone = student?.["SĐT phụ huynh"] || student?.sdt_phu_huynh || "-";
                                let studentEmail = student?.["Email"] || student?.email || "-";
                                let studentStatus = student?.["Trạng thái"] || student?.trang_thai || enrollment?.status || "-";

                                // If no name found, show placeholder with warning
                                if (!studentName) {
                                  console.warn(`⚠️ No name found for student ${studentId}. Student exists: ${!!student}, Enrollment exists: ${!!enrollment}`);
                                  studentName = `[Chưa có tên] ${studentId.substring(0, 8)}...`;
                                }

                                // Get tuition fee from new table: "Mã học sinh-Mã lớp"
                                const classCode = viewingClass["Mã lớp"] || "";
                                let tuitionFee = null;

                                if (studentCode && classCode) {
                                  const tuitionKey = `${studentCode}-${classCode}`;
                                  tuitionFee = tuitionFees[tuitionKey] || null;
                                }

                                // Also check enrollment data for hoc_phi_rieng
                                if (tuitionFee === null && enrollment?.hocPhiRieng !== undefined) {
                                  tuitionFee = enrollment.hocPhiRieng;
                                }

                                return {
                                  key: studentId,
                                  id: studentId,
                                  "Mã học sinh": studentCode || studentId.substring(0, 8),
                                  "Họ và tên": studentName,
                                  "Số điện thoại": studentPhone,
                                  "SĐT phụ huynh": parentPhone,
                                  "hoc_phi_rieng": tuitionFee,
                                  "Email": studentEmail,
                                  "Trạng thái": studentStatus,
                                };
                              })
                              .filter((item) => item !== null)}
                            columns={[
                              {
                                title: "STT",
                                key: "index",
                                width: 60,
                                align: "center" as const,
                                render: (_: any, __: any, index: number) => index + 1,
                              },
                              {
                                title: "Mã học sinh",
                                dataIndex: "Mã học sinh",
                                key: "code",
                                width: 120,
                              },
                              {
                                title: "Họ và tên",
                                dataIndex: "Họ và tên",
                                key: "name",
                                width: 200,
                                render: (text: string) => <strong>{text}</strong>,
                              },
                              {
                                title: "Học phí riêng",
                                dataIndex: "hoc_phi_rieng",
                                key: "hoc_phi_rieng",
                                width: 180,
                                render: (fee: number, record: any) => {
                                  const isEditing = editingTuitionStudentId === record.id;
                                  const currentValue = isEditing ? editingTuitionValue : fee;

                                  if (isEditing) {
                                    return (
                                      <InputNumber<number>
                                        value={currentValue || undefined}
                                        onChange={(value) => setEditingTuitionValue(value || null)}
                                        onPressEnter={async () => {
                                          if (editingTuitionStudentId) {
                                            await handleSaveTuitionFee(editingTuitionStudentId, editingTuitionValue);
                                          }
                                        }}
                                        onBlur={async () => {
                                          if (editingTuitionStudentId) {
                                            await handleSaveTuitionFee(editingTuitionStudentId, editingTuitionValue);
                                          }
                                        }}
                                        min={0}
                                        step={10000}
                                        style={{ width: "100%" }}
                                        formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                        parser={(value) => {
                                          const parsed = value!.replace(/\$\s?|(,*)/g, '');
                                          return parsed === '' ? 0 : Number(parsed);
                                        }}
                                        autoFocus
                                      />
                                    );
                                  }

                                  return (
                                    <div
                                      onClick={async () => {
                                        // Save previous editing row if exists
                                        if (editingTuitionStudentId && editingTuitionStudentId !== record.id) {
                                          await handleSaveTuitionFee(editingTuitionStudentId, editingTuitionValue);
                                        }
                                        setEditingTuitionStudentId(record.id);
                                        setEditingTuitionValue(fee || null);
                                      }}
                                      style={{
                                        cursor: "pointer",
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                        minHeight: "32px",
                                        display: "flex",
                                        alignItems: "center",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "#f5f5f5";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "transparent";
                                      }}
                                    >
                                      {fee ? `${fee.toLocaleString('vi-VN')} đ` : "-"}
                                    </div>
                                  );
                                },
                              },
                              {
                                title: "Hành động",
                                key: "action",
                                width: 100,
                                fixed: "right" as const,
                                render: (_: any, record: any) => (
                                  <Popconfirm
                                    title="Xóa học sinh khỏi lớp"
                                    description={`Bạn có chắc chắn muốn xóa "${record["Họ và tên"]}" khỏi lớp này?`}
                                    onConfirm={async () => {
                                      try {
                                        if (!viewingClass?.id) {
                                          message.error("Không tìm thấy thông tin lớp học");
                                          return;
                                        }
                                        await removeStudentFromClass(viewingClass.id, record.id);
                                        message.success(`Đã xóa "${record["Họ và tên"]}" khỏi lớp`);

                                        // Refresh enrollment data
                                        const enrollmentData = await supabaseGetAll("datasheet/Lớp_học/Học_sinh");
                                        if (enrollmentData && typeof enrollmentData === 'object') {
                                          const tuitionMap: Record<string, number | null> = {};
                                          const studentsByClass: Record<string, string[]> = {};
                                          const enrollmentMap: Record<string, any> = {};

                                          Object.entries(enrollmentData).forEach(([enrollmentId, item]: [string, any]) => {
                                            const converted = convertFromSupabaseFormat(item, "lop_hoc_hoc_sinh");
                                            const classId = converted.classId || item.class_id;
                                            const studentId = converted.studentId || item.student_id;
                                            const studentCode = converted.studentCode || item.student_code;
                                            const studentName = converted.studentName || item.student_name || "";
                                            const status = converted.status || item.status || "active";
                                            const hocPhiRieng = converted.hocPhiRieng || item.hoc_phi_rieng;

                                            if (item && classId) {
                                              if (studentId) {
                                                enrollmentMap[studentId] = {
                                                  studentId,
                                                  studentCode,
                                                  studentName,
                                                  classId,
                                                  hocPhiRieng,
                                                  status,
                                                };
                                              }

                                              if (status === "active" && studentId) {
                                                if (!studentsByClass[classId]) {
                                                  studentsByClass[classId] = [];
                                                }
                                                if (!studentsByClass[classId].includes(studentId)) {
                                                  studentsByClass[classId].push(studentId);
                                                }
                                              }

                                              if (studentCode && classId) {
                                                const classData = classes.find(c => c.id === classId);
                                                if (classData && classData["Mã lớp"]) {
                                                  const key = `${studentCode}-${classData["Mã lớp"]}`;
                                                  tuitionMap[key] = hocPhiRieng || null;
                                                }
                                              }
                                            }
                                          });

                                          setTuitionFees(tuitionMap);
                                          setClassStudentsMap(studentsByClass);
                                          setEnrollmentDataMap(enrollmentMap);
                                        }

                                        // Refresh class data
                                        const classData = await supabaseGetAll("datasheet/Lớp_học");
                                        if (classData && typeof classData === 'object' && classData[viewingClass.id]) {
                                          const converted = convertFromSupabaseFormat(classData[viewingClass.id], "lop_hoc");
                                          setViewingClass({ id: viewingClass.id, ...converted } as Class);
                                        }
                                      } catch (error) {
                                        console.error("Error removing student:", error);
                                        message.error("Không thể xóa học sinh khỏi lớp");
                                      }
                                    }}
                                    okText="Xóa"
                                    cancelText="Hủy"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button
                                      type="text"
                                      danger
                                      icon={<DeleteOutlined />}
                                      size="small"
                                    >
                                      Xóa
                                    </Button>
                                  </Popconfirm>
                                ),
                              },
                            ]}
                            pagination={false}
                            size="small"
                            scroll={{ x: 800 }}
                          />
                        </div>
                      );
                    })()}

                    {viewingClass["Ghi chú"] && (
                      <div style={{ marginTop: 24 }}>
                        <h4>Ghi chú:</h4>
                        <p>{viewingClass["Ghi chú"]}</p>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "history",
                label: (
                  <Space>
                    <HistoryOutlined />
                    <span>Lịch sử buổi học</span>
                  </Space>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ margin: 0 }}>Lịch sử các buổi học chính thức</h4>
                      <DatePicker
                        picker="month"
                        value={selectedMonth}
                        onChange={(date) => setSelectedMonth(date || dayjs())}
                        format="MM/YYYY"
                        allowClear={false}
                        style={{ width: 150 }}
                      />
                    </div>
                    <Table
                      columns={sessionHistoryColumns}
                      dataSource={filteredSessions}
                      rowKey="id"
                      loading={loadingSessions}
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
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>

      {/* Grade Report Modal */}
      <GradeReportModal
        open={isGradeModalOpen}
        onClose={() => {
          setIsGradeModalOpen(false);
          setGradeClass(null);
        }}
        classData={gradeClass}
        students={students}
        attendanceSessions={attendanceSessions}
      />
    </WrapperContent>
  );
};

// Grade Report Modal Component
const GradeReportModal: React.FC<{
  open: boolean;
  onClose: () => void;
  classData: Class | null;
  students: any[];
  attendanceSessions: any[];
}> = ({ open, onClose, classData, students, attendanceSessions }) => {
  // Calculate grade data for all students in the class
  const gradeData = useMemo(() => {
    if (!classData) return [];

    const studentIds = classData["Student IDs"] || [];

    return studentIds
      .map((studentId) => {
        const student = students.find((s) => s.id === studentId);
        if (!student) return null;

        // Get all sessions for this class
        const classSessions = attendanceSessions.filter(
          (session) => session["Class ID"] === classData.id
        );

        let totalSessions = 0;
        let attendedSessions = 0;
        let lateSessions = 0;
        let totalScore = 0;
        let scoredSessions = 0;
        let totalHomework = 0;
        let completedHomework = 0;

        classSessions.forEach((session) => {
          const record = session["Điểm danh"]?.find(
            (r: any) => r["Student ID"] === studentId
          );

          if (record) {
            totalSessions++;

            if (record["Có mặt"]) {
              attendedSessions++;
            }

            if (record["Đi muộn"]) {
              lateSessions++;
            }

            // Score
            if (record["Điểm"] !== null && record["Điểm"] !== undefined) {
              totalScore += record["Điểm"];
              scoredSessions++;
            }

            // Homework
            if (session["Bài tập"]) {
              const totalExercises = session["Bài tập"]["Tổng số bài"] || 0;
              const completed = record["Bài tập hoàn thành"] || 0;
              totalHomework += totalExercises;
              completedHomework += completed;
            }
          }
        });

        const attendanceRate =
          totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 0;
        const averageScore =
          scoredSessions > 0 ? totalScore / scoredSessions : 0;
        const homeworkRate =
          totalHomework > 0 ? (completedHomework / totalHomework) * 100 : 0;

        return {
          studentId,
          studentName: student["Họ và tên"],
          studentCode: student["Mã học sinh"] || "-",
          totalSessions,
          attendedSessions,
          lateSessions,
          absentSessions: totalSessions - attendedSessions,
          attendanceRate,
          averageScore,
          scoredSessions,
          totalHomework,
          completedHomework,
          homeworkRate,
        };
      })
      .filter(Boolean);
  }, [classData, students, attendanceSessions]);

  // Calculate class statistics
  const classStats = useMemo(() => {
    if (gradeData.length === 0) return null;

    const avgAttendance =
      gradeData.reduce((sum: number, d: any) => sum + d.attendanceRate, 0) /
      gradeData.length;
    const avgScore =
      gradeData.reduce((sum: number, d: any) => sum + d.averageScore, 0) /
      gradeData.length;
    const avgHomework =
      gradeData.reduce((sum: number, d: any) => sum + d.homeworkRate, 0) /
      gradeData.length;
    const totalSessions = gradeData[0]?.totalSessions || 0;

    return {
      avgAttendance,
      avgScore,
      avgHomework,
      totalSessions,
    };
  }, [gradeData]);

  // Get all unique score names from all students
  const allScoreNames = useMemo(() => {
    if (!classData) return [];

    const scoreNamesSet = new Set<string>();
    const classSessions = attendanceSessions.filter(
      (session) => session["Class ID"] === classData.id
    );

    classSessions.forEach((session) => {
      session["Điểm danh"]?.forEach((record: any) => {
        if (record["Chi tiết điểm"]) {
          record["Chi tiết điểm"].forEach((score: any) => {
            scoreNamesSet.add(score["Tên điểm"]);
          });
        }
      });
    });

    return Array.from(scoreNamesSet).sort();
  }, [attendanceSessions, classData]);

  if (!classData) return null;

  // Export to Excel
  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ["BẢNG ĐIỂM TỔNG HỢP LỚP HỌC"],
        [`Lớp: ${classData["Tên lớp"]} (${classData["Mã lớp"]})`],
        [
          `Môn học: ${subjectMap[classData["Môn học"]] || classData["Môn học"]}`,
        ],
        [`Khối: ${classData["Khối"]}`],
        [`Giáo viên: ${classData["Giáo viên chủ nhiệm"]}`],
        [`Số học sinh: ${gradeData.length}`],
        [`Ngày xuất: ${dayjs().format("DD/MM/YYYY HH:mm")}`],
        [],
        [
          "STT",
          "Mã HS",
          "Họ và tên",
          "Tổng buổi",
          "Có mặt",
          "Vắng",
          "Muộn",
          "Tỷ lệ (%)",
          "Điểm TB",
          "Số bài chấm",
          "BTVN hoàn thành",
          "Tổng BTVN",
          "Tỷ lệ BTVN (%)",
        ],
        ...gradeData.map((data: any, index) => [
          index + 1,
          data.studentCode,
          data.studentName,
          data.totalSessions,
          data.attendedSessions,
          data.absentSessions,
          data.lateSessions,
          data.attendanceRate.toFixed(1),
          data.averageScore.toFixed(1),
          data.scoredSessions,
          data.completedHomework,
          data.totalHomework,
          data.homeworkRate.toFixed(1),
        ]),
        [],
        ["Thống kê chung:"],
        [
          "Tổng số buổi học:",
          gradeData.length > 0 ? gradeData[0].totalSessions : 0,
        ],
        [
          "Tỷ lệ tham gia trung bình:",
          `${(gradeData.reduce((sum: number, d: any) => sum + d.attendanceRate, 0) / gradeData.length || 0).toFixed(1)}%`,
        ],
        [
          "Điểm trung bình lớp:",
          (
            gradeData.reduce((sum: number, d: any) => sum + d.averageScore, 0) /
            gradeData.length || 0
          ).toFixed(1),
        ],
        [
          "Tỷ lệ hoàn thành BTVN:",
          `${(gradeData.reduce((sum: number, d: any) => sum + d.homeworkRate, 0) / gradeData.length || 0).toFixed(1)}%`,
        ],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

      // Set column widths
      summarySheet["!cols"] = [
        { wch: 5 }, // STT
        { wch: 12 }, // Mã HS
        { wch: 25 }, // Họ và tên
        { wch: 10 }, // Tổng buổi
        { wch: 10 }, // Có mặt
        { wch: 8 }, // Vắng
        { wch: 8 }, // Muộn
        { wch: 12 }, // Tỷ lệ
        { wch: 10 }, // Điểm TB
        { wch: 12 }, // Số bài chấm
        { wch: 15 }, // BTVN hoàn thành
        { wch: 12 }, // Tổng BTVN
        { wch: 15 }, // Tỷ lệ BTVN
      ];

      XLSX.utils.book_append_sheet(wb, summarySheet, "Bảng điểm tổng hợp");

      // Save file
      const fileName = `Bang_diem_${classData["Mã lớp"]}_${dayjs().format("YYYYMMDD")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      message.success("Đã xuất file Excel thành công!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      message.error("Lỗi khi xuất file Excel");
    }
  };

  // Create dynamic columns for each score name
  const scoreColumns = allScoreNames.map((scoreName) => ({
    title: scoreName,
    key: `score-${scoreName}`,
    width: 100,
    align: "center" as const,
    render: (_: any, record: any) => {
      // Find the most recent score with this name for this student
      const classSessions = attendanceSessions.filter(
        (session) => session["Class ID"] === classData.id
      );

      let latestScore: any = null;
      let latestDate = "";

      classSessions.forEach((session) => {
        const studentRecord = session["Điểm danh"]?.find(
          (r: any) => r["Student ID"] === record.studentId
        );
        if (studentRecord?.["Chi tiết điểm"]) {
          studentRecord["Chi tiết điểm"].forEach((score: any) => {
            if (score["Tên điểm"] === scoreName) {
              if (!latestDate || score["Ngày"] > latestDate) {
                latestScore = score;
                latestDate = score["Ngày"];
              }
            }
          });
        }
      });

      if (!latestScore) return <span>-</span>;

      const scoreValue = latestScore["Điểm"];
      return (
        <Tag
          color={
            scoreValue >= 8
              ? "green"
              : scoreValue >= 6.5
                ? "blue"
                : scoreValue >= 5
                  ? "orange"
                  : "red"
          }
        >
          <strong>{scoreValue}</strong>
        </Tag>
      );
    },
  }));

  const columns = [
    {
      title: "STT",
      key: "index",
      width: 60,
      align: "center" as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "Mã HS",
      dataIndex: "studentCode",
      key: "studentCode",
      width: 100,
    },
    {
      title: "Họ và tên",
      dataIndex: "studentName",
      key: "studentName",
      width: 180,
      fixed: "left" as const,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: "Điểm danh",
      children: [
        {
          title: "Tổng",
          dataIndex: "totalSessions",
          key: "totalSessions",
          width: 80,
          align: "center" as const,
        },
        {
          title: "Có mặt",
          dataIndex: "attendedSessions",
          key: "attendedSessions",
          width: 80,
          align: "center" as const,
          render: (val: number) => <Tag color="green">{val}</Tag>,
        },
        {
          title: "Vắng",
          dataIndex: "absentSessions",
          key: "absentSessions",
          width: 80,
          align: "center" as const,
          render: (val: number) =>
            val > 0 ? <Tag color="red">{val}</Tag> : <span>0</span>,
        },
        {
          title: "Muộn",
          dataIndex: "lateSessions",
          key: "lateSessions",
          width: 80,
          align: "center" as const,
          render: (val: number) =>
            val > 0 ? <Tag color="orange">{val}</Tag> : <span>0</span>,
        },
        {
          title: "Tỷ lệ (%)",
          dataIndex: "attendanceRate",
          key: "attendanceRate",
          width: 100,
          align: "center" as const,
          render: (val: number) => (
            <Tag color={val >= 80 ? "green" : val >= 60 ? "orange" : "red"}>
              {val.toFixed(1)}%
            </Tag>
          ),
        },
      ],
    },
    // Dynamic score columns
    ...(scoreColumns.length > 0
      ? [
        {
          title: "Điểm các bài kiểm tra",
          children: scoreColumns,
        },
      ]
      : []),
    {
      title: "Tổng kết",
      children: [
        {
          title: "Điểm TB",
          dataIndex: "averageScore",
          key: "averageScore",
          width: 100,
          align: "center" as const,
          render: (val: number, record: any) => {
            // Calculate average from Chi tiết điểm instead
            const classSessions = attendanceSessions.filter(
              (session) => session["Class ID"] === classData.id
            );
            let totalScore = 0;
            let count = 0;

            classSessions.forEach((session) => {
              const studentRecord = session["Điểm danh"]?.find(
                (r: any) => r["Student ID"] === record.studentId
              );
              if (studentRecord?.["Chi tiết điểm"]) {
                studentRecord["Chi tiết điểm"].forEach((score: any) => {
                  totalScore += score["Điểm"];
                  count++;
                });
              }
            });

            if (count === 0) return <span>-</span>;
            const avg = totalScore / count;
            return (
              <Tag
                color={
                  avg >= 8
                    ? "green"
                    : avg >= 6.5
                      ? "blue"
                      : avg >= 5
                        ? "orange"
                        : "red"
                }
              >
                <strong>{avg.toFixed(1)}</strong>
              </Tag>
            );
          },
        },
        {
          title: "Số bài",
          key: "totalScores",
          width: 80,
          align: "center" as const,
          render: (_: any, record: any) => {
            const classSessions = attendanceSessions.filter(
              (session) => session["Class ID"] === classData.id
            );
            let count = 0;
            classSessions.forEach((session) => {
              const studentRecord = session["Điểm danh"]?.find(
                (r: any) => r["Student ID"] === record.studentId
              );
              if (studentRecord?.["Chi tiết điểm"]) {
                count += studentRecord["Chi tiết điểm"].length;
              }
            });
            return count > 0 ? <Tag color="blue">{count}</Tag> : <span>-</span>;
          },
        },
      ],
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          {`Bảng điểm lớp ${classData["Tên lớp"]} (${classData["Mã lớp"]})`}
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1400}
      footer={[
        <Button
          key="export"
          type="primary"
          icon={<DownloadOutlined />}
          onClick={exportToExcel}
        >
          Xuất Excel
        </Button>,
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
      ]}
    >
      {/* Class Info */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <div>
              <strong>Môn học:</strong>{" "}
              {subjectMap[classData["Môn học"]] || classData["Môn học"]}
            </div>
          </Col>
          <Col span={6}>
            <div>
              <strong>Khối:</strong> {classData["Khối"]}
            </div>
          </Col>
          <Col span={6}>
            <div>
              <strong>Giáo viên:</strong> {classData["Giáo viên chủ nhiệm"]}
            </div>
          </Col>
          <Col span={6}>
            <div>
              <strong>Lương GV:</strong> {classData["Lương GV"] ? `${classData["Lương GV"].toLocaleString('vi-VN')} đ` : "-"}
            </div>
          </Col>
          <Col span={6}>
            <div>
              <strong>Số học sinh:</strong> {gradeData.length}
            </div>
          </Col>
        </Row>
      </Card>

      {/* Statistics */}
      {classStats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tổng số buổi học"
                value={classStats.totalSessions}
                suffix="buổi"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tỷ lệ tham gia TB"
                value={classStats.avgAttendance}
                precision={1}
                suffix="%"
                valueStyle={{
                  color: classStats.avgAttendance >= 80 ? "#3f8600" : "#cf1322",
                }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Điểm TB lớp"
                value={classStats.avgScore}
                precision={1}
                valueStyle={{
                  color:
                    classStats.avgScore >= 8
                      ? "#3f8600"
                      : classStats.avgScore >= 6.5
                        ? "#1890ff"
                        : "#cf1322",
                }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tỷ lệ hoàn thành BTVN"
                value={classStats.avgHomework}
                precision={1}
                suffix="%"
                valueStyle={{
                  color: classStats.avgHomework >= 80 ? "#3f8600" : "#cf1322",
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Grade Table */}
      <Table
        columns={columns}
        dataSource={gradeData}
        rowKey="studentId"
        pagination={false}
        scroll={{ x: 1200, y: 400 }}
        size="small"
        bordered
        expandable={{
          expandedRowRender: (record) => {
            // Get all score details for this student
            const classSessions = attendanceSessions.filter(
              (session) => session["Class ID"] === classData.id
            );

            const allScores: any[] = [];
            classSessions.forEach((session) => {
              const studentRecord = session["Điểm danh"]?.find(
                (r: any) => r["Student ID"] === record.studentId
              );
              if (studentRecord?.["Chi tiết điểm"]) {
                studentRecord["Chi tiết điểm"].forEach((score: any) => {
                  allScores.push({
                    ...score,
                    sessionDate: session["Ngày"],
                    className: session["Tên lớp"],
                  });
                });
              }
            });

            // Sort by date descending
            allScores.sort(
              (a, b) =>
                new Date(b["Ngày"]).getTime() - new Date(a["Ngày"]).getTime()
            );

            if (allScores.length === 0) {
              return (
                <div
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    color: "#999",
                  }}
                >
                  Chưa có điểm chi tiết
                </div>
              );
            }

            const scoreColumns = [
              {
                title: "Ngày",
                dataIndex: "Ngày",
                key: "date",
                width: 120,
                render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
              },
              {
                title: "Tên bài",
                dataIndex: "Tên điểm",
                key: "scoreName",
                width: 250,
              },
              {
                title: "Điểm",
                dataIndex: "Điểm",
                key: "score",
                width: 100,
                align: "center" as const,
                render: (score: number) => (
                  <Tag
                    color={
                      score >= 8
                        ? "green"
                        : score >= 6.5
                          ? "blue"
                          : score >= 5
                            ? "orange"
                            : "red"
                    }
                  >
                    <strong>{score}</strong>
                  </Tag>
                ),
              },
              {
                title: "Ghi chú",
                dataIndex: "Ghi chú",
                key: "note",
              },
            ];

            return (
              <div style={{ margin: "0 48px" }}>
                <Table
                  columns={scoreColumns}
                  dataSource={allScores}
                  rowKey={(record) => `${record["Ngày"]}-${record["Tên điểm"]}`}
                  pagination={false}
                  size="small"
                  bordered
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={2}>
                          <strong>Tổng cộng</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="center">
                          <Tag color="blue">
                            <strong>{allScores.length} điểm</strong>
                          </Tag>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3}>
                          <strong>
                            Điểm TB:{" "}
                            {(
                              allScores.reduce((sum, s) => sum + s["Điểm"], 0) /
                              allScores.length
                            ).toFixed(1)}
                          </strong>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              </div>
            );
          },
          rowExpandable: (record) => {
            // Check if student has any score details
            const classSessions = attendanceSessions.filter(
              (session) => session["Class ID"] === classData.id
            );
            return classSessions.some((session) => {
              const studentRecord = session["Điểm danh"]?.find(
                (r: any) => r["Student ID"] === record.studentId
              );
              return studentRecord?.["Chi tiết điểm"]?.length > 0;
            });
          },
        }}
      />
    </Modal>
  );
};

// Wrap component in App to use App.useApp()
const ClassManagement = () => {
  return (
    <App>
      <ClassManagementContent />
    </App>
  );
};

export default ClassManagement;
