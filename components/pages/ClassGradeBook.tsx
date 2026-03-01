import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Table,
  Modal,
  Tabs,
  Tag,
  Space,
  Input,
  InputNumber,
  Popconfirm,
  message,
  Card,
  Row,
  Col,
  Popover,
  Descriptions,
  DatePicker,
  Radio,
  Empty,
  Select,
} from "antd";
import type { Dayjs } from "dayjs";
import {
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, get, update, set } from "firebase/database";
import { database } from "../../firebase";
import WrapperContent from "@/components/WrapperContent";
import {
  supabaseOnValue,
  supabaseUpdate,
  supabaseSet,
  convertFromSupabaseFormat,
  supabaseGetAll,
} from "@/utils/supabaseHelpers";
import { subjectMap } from "@/utils/selectOptions";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

interface Student {
  id: string;
  "Họ và tên": string;
  "Mã học sinh": string;
}

const ClassGradeBook = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [classData, setClassData] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [customScores, setCustomScores] = useState<any[]>([]);
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [editingCell, setEditingCell] = useState<{
    studentId: string;
    column: string;
  } | null>(null);
  const [tempValue, setTempValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRangeFilter, setDateRangeFilter] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [monthFilter, setMonthFilter] = useState<Dayjs | null>(null);
  const [filterType, setFilterType] = useState<"all" | "dateRange" | "month">("all");
  const [isStudentDetailModalOpen, setIsStudentDetailModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletedColumns, setDeletedColumns] = useState<string[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [customColumnName, setCustomColumnName] = useState<string>("");
  const [isAttendanceFormOpen, setIsAttendanceFormOpen] = useState(false);
  const [editingScores, setEditingScores] = useState<{ [studentId: string]: number | null }>({});

  const hasInvalidManualChars = (label: string) => /[.#$\[\]]/.test(label);
  const normalizeColumnLabel = (label: string) => (label ? label.replace(/\//g, "-") : label);
  const normalizeScoreKeys = (entry: any) => {
    if (!entry) return entry;
    const normalized: Record<string, any> = { studentId: entry.studentId };
    Object.keys(entry).forEach((key) => {
      if (key === "studentId") return;
      const normalizedKey = normalizeColumnLabel(key);
      normalized[normalizedKey] = entry[key];
    });
    return normalized;
  };

  // Load class data
  useEffect(() => {
    if (!classId) return;
    const classRef = ref(database, `datasheet/Lớp_học/${classId}`);
    const unsubscribe = onValue(classRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setClassData({ id: classId, ...data });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [classId]);

  // Load students
  useEffect(() => {
    const unsubscribe = supabaseOnValue(
      "datasheet/Danh_sách_học_sinh",
      (data) => {
        if (data && typeof data === "object") {
          const studentList = Object.entries(data).map(([id, value]) => {
            const converted = convertFromSupabaseFormat(value, "danh_sach_hoc_sinh");
            return {
              id,
              ...(converted as Omit<Student, "id">),
            };
          });
          setStudents(studentList);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // Load attendance sessions
  useEffect(() => {
    const unsubscribe = supabaseOnValue(
      "datasheet/Điểm_danh_sessions",
      (data) => {
        if (data && typeof data === "object") {
          const sessionsList = Object.entries(data).map(([id, value]) => {
            const converted = convertFromSupabaseFormat(value, "diem_danh_sessions");
            return {
              id,
              ...(converted as any),
            };
          });
          setAttendanceSessions(sessionsList);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // Track which columns are from session history (read-only)
  const [autoColumns, setAutoColumns] = useState<string[]>([]);

  // Load custom scores and auto-populate from session history
  useEffect(() => {
    if (!classId || !classData || attendanceSessions.length === 0) return;

    // Get all test scores from session history for this class
    // Map: columnKey -> studentId -> score
    const testScoresMap = new Map<string, Map<string, number>>();
    const testColumns = new Set<string>();

    attendanceSessions.forEach((session) => {
      // Only process sessions for this class
      if (session["Class ID"] !== classId) return;

      const sessionDate = session["Ngày"];

      session["Điểm danh"]?.forEach((record: any) => {
        const studentId = record["Student ID"];
        if (!studentId || !sessionDate) return;

        // Get score - prioritize "Điểm kiểm tra", then "Điểm", then calculate from "Chi tiết điểm"
        let score: number | null = null;

        if (record["Điểm kiểm tra"] != null && record["Điểm kiểm tra"] !== "") {
          score = Number(record["Điểm kiểm tra"]);
        } else if (record["Điểm"] != null && record["Điểm"] !== "") {
          score = Number(record["Điểm"]);
        } else if (record["Chi tiết điểm"] && Array.isArray(record["Chi tiết điểm"]) && record["Chi tiết điểm"].length > 0) {
          const scores = record["Chi tiết điểm"]
            .map((s: any) => Number(s["Điểm"]))
            .filter((s: number) => !isNaN(s));
          if (scores.length > 0) {
            score = scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
          }
        }

        if (score != null && !isNaN(score)) {
          // Create column key with date and optional test name
          const formattedDate = dayjs(sessionDate).format("DD-MM-YYYY");
          const testName = record["Bài kiểm tra"] || "";
          const columnKey = testName
            ? `${testName} (${formattedDate})`
            : `Điểm (${formattedDate})`;
          const normalizedColumnKey = normalizeColumnLabel(columnKey);

          testColumns.add(normalizedColumnKey);

          if (!testScoresMap.has(normalizedColumnKey)) {
            testScoresMap.set(normalizedColumnKey, new Map());
          }
          testScoresMap.get(normalizedColumnKey)!.set(studentId, score);
        }
      });
    });

    // Build scores array
    const studentIds = classData["Student IDs"] || [];
    const scoresArray = studentIds.map((studentId: string) => {
      const scoreObj: any = { studentId };

      testColumns.forEach((columnKey) => {
        const score = testScoresMap.get(columnKey)?.get(studentId);
        scoreObj[columnKey] = score ?? null;
      });

      return scoreObj;
    });

    const autoColumnsArray = Array.from(testColumns);
    setAutoColumns(autoColumnsArray); // Track auto columns
    const columnsArray = [...autoColumnsArray];

    // Load manual scores from Firebase and merge
    const scoresRef = ref(database, `datasheet/Điểm_tự_nhập/${classId}`);
    const unsubscribe = onValue(scoresRef, (snapshot) => {
      const data = snapshot.val();

      if (data && data.scores && data.columns) {
        // Lấy danh sách cột từ Firebase - đây là nguồn chính xác nhất
        const dbColumns = data.columns.map((col: string) => normalizeColumnLabel(col));
        const manualScores = data.scores.map((score: any) => normalizeScoreKeys(score));

        // Merge scores - ưu tiên dữ liệu từ DB
        const mergedScores = scoresArray.map((autoScore: any) => {
          const manualScore = manualScores.find((s: any) => s.studentId === autoScore.studentId);
          if (manualScore) {
            // Chỉ giữ các cột còn tồn tại trong dbColumns
            const filteredScore: any = { studentId: autoScore.studentId };
            dbColumns.forEach((col: string) => {
              if (manualScore[col] !== undefined) {
                filteredScore[col] = manualScore[col];
              } else if (autoScore[col] !== undefined) {
                filteredScore[col] = autoScore[col];
              }
            });
            return filteredScore;
          }
          return autoScore;
        });

        setCustomScores(mergedScores);
        setCustomColumns(dbColumns);
        setDeletedColumns([]);
        setHasUnsavedChanges(false);
      } else {
        // No manual scores, use auto-populated only
        setCustomScores(scoresArray);
        setCustomColumns(columnsArray);
        setDeletedColumns([]);
        setHasUnsavedChanges(false);
      }
    });

    return () => unsubscribe();
  }, [classId, classData, attendanceSessions]);

  // Save custom scores to Firebase
  const saveCustomScores = async (scores: any[], columns: string[]) => {
    if (!classId) return;
    try {
      const scoresRef = ref(database, `datasheet/Điểm_tự_nhập/${classId}`);
      // Sử dụng set() thay vì update() để ghi đè toàn bộ dữ liệu
      const normalizedScores = scores.map((score) => normalizeScoreKeys(score));
      const normalizedColumns = columns.map((col) => normalizeColumnLabel(col));
      await set(scoresRef, {
        scores: normalizedScores,
        columns: normalizedColumns,
        lastUpdated: new Date().toISOString(),
      });
      setHasUnsavedChanges(false);
      message.success("Đã lưu điểm thành công");
    } catch (error) {
      console.error("Error saving custom scores:", error);
      message.error("Lỗi khi lưu điểm");
    }
  };

  // Open attendance form for selected session
  const handleOpenAttendanceForm = () => {
    if (!selectedSessionId) {
      message.warning("Vui lòng chọn buổi học");
      return;
    }
    if (!customColumnName.trim()) {
      message.warning("Vui lòng nhập tên cột điểm");
      return;
    }

    const session = attendanceSessions.find(s => s.id === selectedSessionId);
    if (!session) {
      message.error("Không tìm thấy buổi học");
      return;
    }

    // Initialize empty scores for all students in this class
    const scoresMap: { [studentId: string]: number | null } = {};
    const studentIds = classData?.["Student IDs"] || [];
    
    studentIds.forEach((studentId: string) => {
      scoresMap[studentId] = null; // Start with empty scores for new column
    });

    setEditingScores(scoresMap);
    // Keep customColumnName as entered by user
    setIsAddColumnModalOpen(false);
    setIsAttendanceFormOpen(true);
  };

  // Handle score change in attendance form
  const handleAttendanceScoreChange = (studentId: string, value: number | null) => {
    setEditingScores(prev => ({
      ...prev,
      [studentId]: value
    }));
  };

  // Save scores from attendance form
  const handleSaveAttendanceScores = async () => {
    if (!selectedSessionId) return;
    if (!customColumnName.trim()) {
      message.warning("Vui lòng nhập tên cột điểm");
      return;
    }

    const session = attendanceSessions.find(s => s.id === selectedSessionId);
    if (!session) return;

    try {
      const updates: { [key: string]: any } = {};

      // Update each student's score in the session
      const records = Array.isArray(session["Điểm danh"])
        ? session["Điểm danh"]
        : Object.values(session["Điểm danh"] || {});

      // Create column name with date
      const sessionDate = session["Ngày"];
      const formattedDate = dayjs(sessionDate).format("DD-MM-YYYY");
      const columnName = normalizeColumnLabel(`${customColumnName.trim()} (${formattedDate})`);

      // Prepare new scores for customScores
      const newScoresMap: { [studentId: string]: number | null } = {};

      records.forEach((record: any, index: number) => {
        const studentId = record["Student ID"];
        if (studentId && editingScores.hasOwnProperty(studentId)) {
          const newScore = editingScores[studentId];
          newScoresMap[studentId] = newScore;

          // Update session scores for sync with student view
          updates[`datasheet/Điểm_danh_sessions/${selectedSessionId}/Điểm danh/${index}/Điểm kiểm tra`] = newScore;
          updates[`datasheet/Điểm_danh_sessions/${selectedSessionId}/Điểm danh/${index}/Điểm`] = newScore;
          updates[`datasheet/Điểm_danh_sessions/${selectedSessionId}/Điểm danh/${index}/Bài kiểm tra`] = customColumnName.trim();
        }
      });

      if (Object.keys(updates).length > 0) {
        // 1. Update session in Firebase (for sync)
        await update(ref(database), updates);

        // 2. Add new column to customColumns and customScores
        const newColumns = [...customColumns];
        if (!newColumns.includes(columnName)) {
          newColumns.push(columnName);
        }

        const newScores = customScores.map((score) => ({
          ...score,
          [columnName]: newScoresMap[score.studentId] ?? score[columnName] ?? null,
        }));

        // Also add scores for students not in customScores yet
        const studentIds = classData?.["Student IDs"] || [];
        studentIds.forEach((studentId: string) => {
          if (!newScores.find(s => s.studentId === studentId)) {
            newScores.push({
              studentId,
              [columnName]: newScoresMap[studentId] ?? null,
            });
          }
        });

        // 3. Save to Firebase Điểm_tự_nhập
        await saveCustomScores(newScores, newColumns);

        message.success("Đã lưu điểm thành công!");
        setIsAttendanceFormOpen(false);
        setSelectedSessionId(null);
        setCustomColumnName("");
        setEditingScores({});
      } else {
        message.warning("Không có thay đổi nào để lưu");
      }
    } catch (error) {
      console.error("Error saving scores:", error);
      message.error("Có lỗi khi lưu điểm");
    }
  };

  // Delete column - xóa thực sự trong DB
  const handleDeleteColumn = async (columnName: string) => {
    try {
      const newColumns = customColumns.filter((c) => c !== columnName);
      const newScores = customScores.map((score) => {
        const { [columnName]: _, ...rest } = score;
        return rest;
      });
      
      // Lưu ngay vào DB để xóa hẳn
      if (classId) {
        const scoresRef = ref(database, `datasheet/Điểm_tự_nhập/${classId}`);
        const normalizedScores = newScores.map((score) => normalizeScoreKeys(score));
        const normalizedColumns = newColumns.map((col) => normalizeColumnLabel(col));
        await set(scoresRef, {
          scores: normalizedScores,
          columns: normalizedColumns,
          lastUpdated: new Date().toISOString(),
        });
        message.success(`Đã xóa cột "${columnName}"`);
      }
      
      setCustomColumns(newColumns);
      setCustomScores(newScores);
    } catch (error) {
      console.error("Error deleting column:", error);
      message.error("Lỗi khi xóa cột");
    }
  };

  // Update score
  const handleUpdateScore = (
    studentId: string,
    column: string,
    value: number | null
  ) => {
    const newScores = [...customScores];
    const existingIndex = newScores.findIndex((s) => s.studentId === studentId);

    if (existingIndex >= 0) {
      newScores[existingIndex] = {
        ...newScores[existingIndex],
        [column]: value,
      };
    } else {
      newScores.push({
        studentId,
        [column]: value,
      });
    }

    setCustomScores(newScores);
    setHasUnsavedChanges(true);
    setEditingCell(null);
    setTempValue(null);
  };

  // Get custom score
  const getCustomScore = (studentId: string, column: string) => {
    const score = customScores.find((s) => s.studentId === studentId);
    return score?.[column] ?? null;
  };

  // Handle save all scores
  const handleSaveAllScores = async () => {
    await saveCustomScores(customScores, customColumns);
    setIsEditMode(false);
  };

  // Get grade data
  const gradeData = useMemo(() => {
    if (!classData) return [];

    const studentIds = classData["Student IDs"] || [];

    const result = studentIds
      .map((studentId: string) => {
        const student = students.find((s) => String(s.id) === String(studentId));
        if (!student) {
          console.warn(`Student not found for ID: ${studentId}`);
          return null;
        }

        const studentName = student["Họ và tên"] || student["Tên học sinh"] || student["Tên"] || "-";
        const studentCode = student["Mã học sinh"] || student["Mã HS"] || "-";

        return {
          studentId,
          studentName,
          studentCode,
        };
      })
      .filter(Boolean);

    console.log("📊 Grade Data:", result);
    console.log("📊 Students list:", students.length);
    console.log("📊 Class Student IDs:", studentIds);
    return result;
  }, [classData, students]);

  // Get all sessions for this class (allow multiple columns per session)
  const availableSessions = useMemo(() => {
    if (!classData || attendanceSessions.length === 0) return [];

    return attendanceSessions
      .filter((session) => {
        // Only sessions for this class
        return session["Class ID"] === classData.id;
      })
      .sort((a, b) => {
        const dateA = dayjs(a["Ngày"]);
        const dateB = dayjs(b["Ngày"]);
        return dateB.isBefore(dateA) ? -1 : dateB.isAfter(dateA) ? 1 : 0;
      });
  }, [classData, attendanceSessions]);

  // Get filtered columns based on date/month filter
  const filteredColumns = useMemo(() => {
    if (filterType === "all") {
      return customColumns;
    }

    return customColumns.filter((column) => {
      // Extract date from column name: "Tên bài (DD-MM-YYYY)" or "Điểm (DD/MM/YYYY)"
      const match = column.match(/\((\d{2}[\/-]\d{2}[\/-]\d{4})\)$/);
      if (!match) return true; // Keep columns without date format

      const normalizedDate = match[1].replace(/\//g, "-");
      const [day, month, year] = normalizedDate.split('-');
      const columnDate = dayjs(`${year}-${month}-${day}`);

      if (filterType === "dateRange" && dateRangeFilter[0] && dateRangeFilter[1]) {
        const startDate = dateRangeFilter[0].startOf("day");
        const endDate = dateRangeFilter[1].endOf("day");
        return (columnDate.isAfter(startDate) || columnDate.isSame(startDate, "day")) &&
          (columnDate.isBefore(endDate) || columnDate.isSame(endDate, "day"));
      }

      if (filterType === "month" && monthFilter) {
        return columnDate.year() === monthFilter.year() && columnDate.month() === monthFilter.month();
      }

      return true;
    });
  }, [customColumns, filterType, dateRangeFilter, monthFilter]);

  // Get score by date
  const getScoreByDate = (studentId: string, sessionId: string) => {
    const session = attendanceSessions.find((s) => s.id === sessionId);
    if (!session) return null;

    // FIX: Chuyển đổi an toàn sang mảng và so sánh ID dạng chuỗi
    const attendanceRecords = Array.isArray(session["Điểm danh"])
      ? session["Điểm danh"]
      : Object.values(session["Điểm danh"] || {});

    const record = attendanceRecords.find(
      (r: any) => String(r["Student ID"]) === String(studentId)
    );

    if (!record) return null;

    // Ưu tiên lấy "Điểm kiểm tra" (từ điểm danh)
    if (record["Điểm kiểm tra"] !== null && record["Điểm kiểm tra"] !== undefined && record["Điểm kiểm tra"] !== "") {
      return Number(record["Điểm kiểm tra"]);
    }

    // Nếu không có, lấy trường "Điểm" trực tiếp
    if (record["Điểm"] !== null && record["Điểm"] !== undefined && record["Điểm"] !== "") {
      return Number(record["Điểm"]);
    }

    // Nếu không có, kiểm tra "Chi tiết điểm"
    if (record["Chi tiết điểm"] && Array.isArray(record["Chi tiết điểm"]) && record["Chi tiết điểm"].length > 0) {
      const scores = record["Chi tiết điểm"]
        .map((s: any) => Number(s["Điểm"]))
        .filter((s: number) => !isNaN(s));

      if (scores.length === 0) return null;
      return scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
    }

    return null;
  };

  // Get score details (for tooltip/popover)
  const getScoreDetails = (studentId: string, sessionId: string) => {
    const session = attendanceSessions.find((s) => s.id === sessionId);
    if (!session) return null;

    const attendanceRecords = Array.isArray(session["Điểm danh"])
      ? session["Điểm danh"]
      : Object.values(session["Điểm danh"] || {});

    const record = attendanceRecords.find(
      (r: any) => String(r["Student ID"]) === String(studentId)
    );

    if (!record) return null;

    // Return score details
    return {
      "Điểm kiểm tra": record["Điểm kiểm tra"],
      "Điểm": record["Điểm"],
      "Chi tiết điểm": record["Chi tiết điểm"],
      "Bài kiểm tra": record["Bài kiểm tra"],
    };
  };

  // Get score details from column name (for custom scores from session history)
  const getScoreDetailsFromColumn = (studentId: string, columnName: string) => {
    // Column format: "Tên bài kiểm tra (DD-MM-YYYY)"
    // Extract test name and date
    const match = columnName.match(/^(.+?)\s*\((\d{2}[\/-]\d{2}[\/-]\d{4})\)$/);
    if (!match) return null;

    const testName = match[1].trim();
    const normalizedDate = match[2].replace(/\//g, "-");
    // Convert DD-MM-YYYY to YYYY-MM-DD
    const [day, month, year] = normalizedDate.split('-');
    const sessionDate = `${year}-${month}-${day}`;

    // Find session with matching date and test name
    const session = attendanceSessions.find((s) => {
      if (s["Class ID"] !== classData?.id) return false;
      if (s["Ngày"] !== sessionDate) return false;

      // Check if any record has this test name
      const records = Array.isArray(s["Điểm danh"])
        ? s["Điểm danh"]
        : Object.values(s["Điểm danh"] || {});

      return records.some((r: any) =>
        String(r["Student ID"]) === String(studentId) &&
        r["Bài kiểm tra"] === testName
      );
    });

    if (!session) return null;

    const attendanceRecords = Array.isArray(session["Điểm danh"])
      ? session["Điểm danh"]
      : Object.values(session["Điểm danh"] || {});

    const record = attendanceRecords.find(
      (r: any) => String(r["Student ID"]) === String(studentId) && r["Bài kiểm tra"] === testName
    );

    if (!record) return null;

    return {
      "Điểm kiểm tra": record["Điểm kiểm tra"],
      "Điểm": record["Điểm"],
      "Chi tiết điểm": record["Chi tiết điểm"],
      "Bài kiểm tra": record["Bài kiểm tra"],
      "Ngày": session["Ngày"],
    };
  };

  // Calculate regular average
  const getRegularAverage = (studentId: string) => {
    const classSessions = attendanceSessions.filter(
      (session) => session["Class ID"] === classData?.id
    );

    let totalScore = 0;
    let count = 0;

    classSessions.forEach((session) => {
      // FIX: Chuyển đổi an toàn sang mảng và so sánh ID dạng chuỗi
      const attendanceRecords = Array.isArray(session["Điểm danh"])
        ? session["Điểm danh"]
        : Object.values(session["Điểm danh"] || {});

      const studentRecord = attendanceRecords.find(
        (r: any) => String(r["Student ID"]) === String(studentId)
      );

      if (!studentRecord) return;

      // Logic tính điểm: ưu tiên "Điểm kiểm tra", sau đó "Điểm", cuối cùng "Chi tiết điểm"
      if (studentRecord["Điểm kiểm tra"] !== null && studentRecord["Điểm kiểm tra"] !== undefined && studentRecord["Điểm kiểm tra"] !== "") {
        totalScore += Number(studentRecord["Điểm kiểm tra"]);
        count++;
      }
      else if (studentRecord["Điểm"] !== null && studentRecord["Điểm"] !== undefined && studentRecord["Điểm"] !== "") {
        totalScore += Number(studentRecord["Điểm"]);
        count++;
      }
      else if (studentRecord["Chi tiết điểm"] && Array.isArray(studentRecord["Chi tiết điểm"]) && studentRecord["Chi tiết điểm"].length > 0) {
        const scores = studentRecord["Chi tiết điểm"]
          .map((s: any) => Number(s["Điểm"]))
          .filter((s: number) => !isNaN(s));

        if (scores.length > 0) {
          totalScore += scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
          count++;
        }
      }
    });

    return count > 0 ? totalScore / count : null;
  };

  // Calculate custom average
  const getCustomAverage = (studentId: string) => {
    const score = customScores.find((s) => s.studentId === studentId);
    if (!score) return null;

    const values = filteredColumns
      .map((col) => score[col])
      .filter((v) => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!classData) return;

    try {
      const wb = XLSX.utils.book_new();

      // Export custom scores (all scores)
      const titleRow = ["BẢNG THEO DÕI HỌC TẬP"];
      const mainHeader = ["", "", "ĐIỂM"];
      const subHeader = [
        "STT",
        "Mã HS",
        "HỌ VÀ TÊN",
        ...filteredColumns,
        "",
        "",
        "Điểm TB",
        "Ghi chú",
      ];

      const data = gradeData.map((student: any, index: number) => {
        const scores = filteredColumns.map((col) => {
          const score = getCustomScore(student.studentId, col);
          return score !== null ? Number(score) : "x";
        });
        const avg = getCustomAverage(student.studentId);
        return [
          index + 1,
          student.studentCode,
          student.studentName,
          ...scores,
          "",
          "",
          avg !== null ? Number(avg.toFixed(2)) : "",
          "",
        ];
      });

      const sheetData = [titleRow, mainHeader, subHeader, ...data];
      const sheet = XLSX.utils.aoa_to_sheet(sheetData);

      const colWidths = [
        { wch: 5 },
        { wch: 10 },
        { wch: 20 },
        ...filteredColumns.map(() => ({ wch: 10 })),
        { wch: 5 },
        { wch: 5 },
        { wch: 10 },
        { wch: 15 },
      ];
      sheet['!cols'] = colWidths;

      const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: filteredColumns.length + 5 } },
        { s: { r: 1, c: 3 }, e: { r: 1, c: filteredColumns.length + 2 } },
        { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
        { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
        { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
        { s: { r: 1, c: filteredColumns.length + 3 }, e: { r: 2, c: filteredColumns.length + 3 } },
        { s: { r: 1, c: filteredColumns.length + 4 }, e: { r: 2, c: filteredColumns.length + 4 } },
      ];
      sheet['!merges'] = merges;

      XLSX.utils.book_append_sheet(wb, sheet, "Điểm kiểm tra");

      const fileName = `Bang_diem_${classData["Mã lớp"]}_${dayjs().format("YYYYMMDD")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      message.success("Đã xuất file Excel thành công!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      message.error("Lỗi khi xuất file Excel");
    }
  };


  // Custom scores columns
  const customScoresColumns = [
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
      render: (text: string, record: any) => {
        const displayName = text || record.studentName || "-";
        return (
          <strong
            style={{ cursor: "pointer", color: "#1890ff" }}
            onClick={() => {
              setSelectedStudent(record);
              setIsStudentDetailModalOpen(true);
            }}
          >
            {displayName}
          </strong>
        );
      },
    },
    ...filteredColumns.map((column) => {
      const isAutoColumn = autoColumns.includes(column);

      return {
        title: (
          <Space>
            <span>{column}</span>
            {isEditMode && (
              <Popconfirm
                title="Xóa cột điểm"
                description={`Bạn có chắc chắn muốn xóa cột "${column}"?`}
                onConfirm={() => handleDeleteColumn(column)}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  style={{ marginLeft: 4 }}
                />
              </Popconfirm>
            )}
          </Space>
        ),
        key: column,
        width: 100,
        align: "center" as const,
        render: (_: any, record: any) => {
          const score = getCustomScore(record.studentId, column);
          const scoreDetails = isAutoColumn ? getScoreDetailsFromColumn(record.studentId, column) : null;

          // When not in edit mode, just display the score (with popover for auto columns)
          if (!isEditMode) {
            const scoreTag = score !== null ? (
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
                style={{ cursor: scoreDetails?.["Chi tiết điểm"] ? "pointer" : "default" }}
              >
                {score}
              </Tag>
            ) : (
              <span style={{ color: "#ccc" }}>-</span>
            );

            // Show popover with score details if available (for auto columns)
            if (scoreDetails && scoreDetails["Chi tiết điểm"] && Array.isArray(scoreDetails["Chi tiết điểm"]) && scoreDetails["Chi tiết điểm"].length > 0) {
              return (
                <Popover
                  title="Điểm thành phần"
                  content={
                    <div>
                      <Descriptions size="small" column={1}>
                        {scoreDetails["Chi tiết điểm"].map((detail: any, idx: number) => (
                          <Descriptions.Item key={idx} label={detail["Tên điểm"] || `Điểm ${idx + 1}`}>
                            {detail["Điểm"]} {detail["Ghi chú"] ? `(${detail["Ghi chú"]})` : ""}
                          </Descriptions.Item>
                        ))}
                      </Descriptions>
                      {scoreDetails["Bài kiểm tra"] && (
                        <div style={{ marginTop: 8, fontSize: "12px", color: "#666" }}>
                          <strong>Bài kiểm tra:</strong> {scoreDetails["Bài kiểm tra"]}
                        </div>
                      )}
                      {scoreDetails["Ngày"] && (
                        <div style={{ marginTop: 4, fontSize: "12px", color: "#666" }}>
                          <strong>Ngày:</strong> {dayjs(scoreDetails["Ngày"]).format("DD/MM/YYYY")}
                        </div>
                      )}
                    </div>
                  }
                >
                  {scoreTag}
                </Popover>
              );
            }

            return scoreTag;
          }

          // In edit mode, all columns are editable
          const isEditing =
            editingCell?.studentId === record.studentId &&
            editingCell?.column === column;

          if (isEditing) {
            return (
              <InputNumber
                min={0}
                max={10}
                step={0.5}
                value={tempValue}
                onChange={(value) => setTempValue(value as number | null)}
                onPressEnter={() =>
                  handleUpdateScore(record.studentId, column, tempValue)
                }
                onBlur={() =>
                  handleUpdateScore(record.studentId, column, tempValue)
                }
                autoFocus
                style={{ width: 80 }}
              />
            );
          }

          return (
            <div
              onClick={() => {
                setEditingCell({ studentId: record.studentId, column });
                setTempValue(score);
              }}
              style={{ cursor: "pointer", minHeight: 22 }}
            >
              {score !== null ? (
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
                  {score}
                </Tag>
              ) : (
                <span style={{ color: "#ccc" }}>Nhấn để nhập</span>
              )}
            </div>
          );
        },
      };
    }),
    {
      title: "Điểm TB",
      key: "average",
      width: 120,
      align: "center" as const,
      render: (_: any, record: any) => {
        const avg = getCustomAverage(record.studentId);
        if (avg === null) return <span style={{ color: "#ccc" }}>-</span>;
        return (
          <Tag
            color={
              avg >= 8 ? "green" : avg >= 6.5 ? "blue" : avg >= 5 ? "orange" : "red"
            }
          >
            <strong>{avg.toFixed(1)}</strong>
          </Tag>
        );
      },
    },
    {
      title: "Ghi chú",
      key: "note",
      width: 200,
    },
  ];

  if (!classData) {
    return <WrapperContent title="Bảng điểm" isLoading={loading}><div /></WrapperContent>;
  }

  return (
    <WrapperContent
      title={`Bảng điểm - ${classData["Tên lớp"]}`}
      toolbar={
        <Space>
          <Button icon={<DownloadOutlined />} onClick={exportToExcel}>
            Xuất Excel
          </Button>
          <Button onClick={() => navigate(-1)}>Quay lại</Button>
        </Space>
      }
    >
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <strong>Mã lớp:</strong> {classData["Mã lớp"]}
          </Col>
          <Col span={6}>
            <strong>Môn học:</strong>{" "}
            {subjectMap[classData["Môn học"]] || classData["Môn học"]}
          </Col>
          <Col span={6}>
            <strong>Khối:</strong> {classData["Khối"]}
          </Col>
          <Col span={6}>
            <strong>Số học sinh:</strong> {gradeData.length}
          </Col>
        </Row>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <strong>Bộ lọc:</strong>
          </div>
          <Radio.Group
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              if (e.target.value === "all") {
                setDateRangeFilter([null, null]);
                setMonthFilter(null);
              }
            }}
          >
            <Radio value="all">Tất cả</Radio>
            <Radio value="dateRange">Theo khoảng ngày</Radio>
            <Radio value="month">Theo tháng</Radio>
          </Radio.Group>
          {filterType === "dateRange" && (
            <DatePicker.RangePicker
              value={dateRangeFilter}
              onChange={(dates) => setDateRangeFilter(dates as [Dayjs | null, Dayjs | null])}
              format="DD/MM/YYYY"
            />
          )}
          {filterType === "month" && (
            <DatePicker
              picker="month"
              value={monthFilter}
              onChange={(date) => setMonthFilter(date)}
              format="MM/YYYY"
            />
          )}
        </Space>
      </Card>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: "#666", marginBottom: 4 }}>
                Bảng điểm tự động lấy từ lịch sử lớp học (cột từ lịch sử) và điểm tự nhập.
              </div>
              <div style={{ color: "#999", fontSize: 12 }}>
                💡 Cột từ lịch sử: chỉ xem | Cột thủ công: bấm "Chỉnh sửa điểm" để thêm/sửa/xóa. Kéo ngang bảng để xem thêm cột.
              </div>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsAddColumnModalOpen(true)}
            >
              Thêm cột điểm
            </Button>
          </div>
        </div>
        <Table
          columns={customScoresColumns}
          dataSource={gradeData}
          rowKey="studentId"
          pagination={false}
          scroll={{ x: "max-content", y: 500 }}
          size="small"
          bordered
          locale={{
            emptyText: <Empty description="Không có dữ liệu" />,
          }}
        />
        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          {isEditMode ? (
            <>
              <Button
                icon={<PlusOutlined />}
                onClick={() => setIsAddColumnModalOpen(true)}
              >
                Thêm cột điểm
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveAllScores}
                disabled={!hasUnsavedChanges}
              >
                Lưu điểm
              </Button>
            </>
          ) : (
            <Button
              type="primary"
              onClick={() => setIsEditMode(true)}
            >
              Chỉnh sửa điểm
            </Button>
          )}
        </div>
      </Card>

      {/* Select Session Modal */}
      <Modal
        title="Thêm cột điểm mới"
        open={isAddColumnModalOpen}
        onCancel={() => {
          setIsAddColumnModalOpen(false);
          setSelectedSessionId(null);
          setCustomColumnName("");
        }}
        onOk={handleOpenAttendanceForm}
        okText="Tiếp tục"
        cancelText="Hủy"
        okButtonProps={{ disabled: !selectedSessionId || !customColumnName.trim() }}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, color: '#666', fontWeight: 500 }}>
            1. Chọn buổi học đã dạy:
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder="Chọn buổi học"
            value={selectedSessionId}
            onChange={(value) => setSelectedSessionId(value)}
            showSearch
            optionFilterProp="children"
          >
            {availableSessions.map((session) => {
              const sessionDate = session["Ngày"];
              const formattedDate = dayjs(sessionDate).format("DD/MM/YYYY");
              const timeStart = session["Giờ bắt đầu"] || "";
              const timeEnd = session["Giờ kết thúc"] || "";
              const timeRange = timeStart && timeEnd ? ` (${timeStart} - ${timeEnd})` : "";

              return (
                <Select.Option key={session.id} value={session.id}>
                  {formattedDate}{timeRange}
                </Select.Option>
              );
            })}
          </Select>

          {availableSessions.length === 0 && (
            <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>
              Chưa có buổi học nào. Vui lòng điểm danh trước khi thêm điểm.
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, color: '#666', fontWeight: 500 }}>
            2. Đặt tên cột điểm <span style={{ color: '#ff4d4f' }}>*</span>:
          </div>
          <Input
            value={customColumnName}
            onChange={(e) => setCustomColumnName(e.target.value)}
            placeholder="Ví dụ: Kiểm tra 15 phút, Bài tập về nhà, Giữa kỳ..."
          />
          <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            💡 Một buổi học có thể có nhiều cột điểm (VD: Điểm bài cũ, Điểm kiểm tra, Điểm bài tập)
          </div>
        </div>
      </Modal>

      {/* Attendance Form Modal - Simple */}
      <Modal
        title={(() => {
          const session = attendanceSessions.find(s => s.id === selectedSessionId);
          const formattedDate = session ? dayjs(session["Ngày"]).format("DD/MM/YYYY") : "";
          return `Nhập điểm: ${customColumnName} (${formattedDate})`;
        })()}
        open={isAttendanceFormOpen}
        onCancel={() => {
          setIsAttendanceFormOpen(false);
          setSelectedSessionId(null);
          setCustomColumnName("");
          setEditingScores({});
        }}
        onOk={handleSaveAttendanceScores}
        okText="Lưu điểm"
        cancelText="Hủy"
        width={800}
      >
        {selectedSessionId && (() => {
          const session = attendanceSessions.find(s => s.id === selectedSessionId);
          if (!session) return null;

          const records = Array.isArray(session["Điểm danh"])
            ? session["Điểm danh"]
            : Object.values(session["Điểm danh"] || {});

          const studentIds = classData?.["Student IDs"] || [];
          const studentData = studentIds.map((studentId: string) => {
            const student = students.find(s => s.id === studentId);
            const record = records.find((r: any) => r["Student ID"] === studentId);

            return {
              studentId,
              studentName: student?.["Họ và tên"] || "Không tên",
              studentCode: student?.["Mã học sinh"] || "-",
              currentScore: editingScores[studentId] ?? null,
              attendance: record?.["Có mặt"] ? "Có mặt" : "Vắng",
            };
          });

          return (
            <div>
              <div style={{ marginBottom: 16, padding: '8px 12px', backgroundColor: '#f6f8fa', borderRadius: 6 }}>
                <span style={{ color: '#666' }}>Cột điểm: </span>
                <strong style={{ color: '#1890ff' }}>{customColumnName}</strong>
              </div>

              <Table
                dataSource={studentData}
                rowKey="studentId"
                pagination={false}
                scroll={{ y: 400 }}
                size="small"
                bordered
                columns={[
                  {
                    title: "STT",
                    key: "index",
                    width: 60,
                    render: (_, __, index) => index + 1,
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
                    width: 200,
                  },
                  {
                    title: "Chuyên cần",
                    dataIndex: "attendance",
                    key: "attendance",
                    width: 100,
                    render: (attendance) => (
                      <Tag color={attendance === "Có mặt" ? "green" : "red"}>
                        {attendance}
                      </Tag>
                    ),
                  },
                  {
                    title: "Điểm",
                    dataIndex: "currentScore",
                    key: "currentScore",
                    width: 150,
                    render: (_, record: any) => (
                      <InputNumber
                        min={0}
                        max={10}
                        step={0.5}
                        value={editingScores[record.studentId]}
                        onChange={(value) => handleAttendanceScoreChange(record.studentId, value)}
                        placeholder="Nhập điểm"
                        style={{ width: "100%" }}
                      />
                    ),
                  },
                ]}
              />
            </div>
          );
        })()}
      </Modal>

      {/* Student Detail Modal */}
      <Modal
        title={`Chi tiết điểm - ${selectedStudent?.studentName || ""}`}
        open={isStudentDetailModalOpen}
        onCancel={() => {
          setIsStudentDetailModalOpen(false);
          setSelectedStudent(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setIsStudentDetailModalOpen(false);
            setSelectedStudent(null);
          }}>
            Đóng
          </Button>,
        ]}
        width={1000}
      >
        {selectedStudent && (() => {
          // Get all sessions for this student - hiển thị sessions từ ngày đăng ký trở đi (bao gồm ngày đăng ký)
          const studentSessions = attendanceSessions
            .filter((session) => {
              if (session["Class ID"] !== classData?.id) return false;

              const records = Array.isArray(session["Điểm danh"])
                ? session["Điểm danh"]
                : Object.values(session["Điểm danh"] || {});

              const hasRecord = records.some((r: any) => String(r["Student ID"]) === String(selectedStudent.studentId));
              if (!hasRecord) return false;

              // Check enrollment date - hiển thị nếu học sinh đã đăng ký trước hoặc trong ngày session
              if (classData) {
                const enrollments = classData["Student Enrollments"] || {};
                if (enrollments[selectedStudent.studentId]) {
                  const enrollmentDate = enrollments[selectedStudent.studentId].enrollmentDate;
                  const sessionDate = session["Ngày"];
                  // Hiển thị nếu học sinh đã đăng ký trước hoặc trong ngày session
                  if (enrollmentDate > sessionDate) return false;
                }
              }

              return true;
            })
            .sort((a, b) => {
              const dateA = dayjs(a["Ngày"]);
              const dateB = dayjs(b["Ngày"]);
              return dateB.isBefore(dateA) ? -1 : dateB.isAfter(dateA) ? 1 : 0;
            });

          // Get student records from sessions
          const studentRecords = studentSessions.map((session) => {
            const records = Array.isArray(session["Điểm danh"])
              ? session["Điểm danh"]
              : Object.values(session["Điểm danh"] || {});

            const record = records.find((r: any) => String(r["Student ID"]) === String(selectedStudent.studentId));

            if (!record) return null;

            // Get score
            let score: number | null = null;
            if (record["Điểm kiểm tra"] != null && record["Điểm kiểm tra"] !== "") {
              score = Number(record["Điểm kiểm tra"]);
            } else if (record["Điểm"] != null && record["Điểm"] !== "") {
              score = Number(record["Điểm"]);
            } else if (record["Chi tiết điểm"] && Array.isArray(record["Chi tiết điểm"]) && record["Chi tiết điểm"].length > 0) {
              const scores = record["Chi tiết điểm"]
                .map((s: any) => Number(s["Điểm"]))
                .filter((s: number) => !isNaN(s));
              if (scores.length > 0) {
                score = scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
              }
            }

            return {
              sessionId: session.id,
              date: session["Ngày"],
              testName: record["Bài kiểm tra"] || "",
              score,
              scoreDetails: record["Chi tiết điểm"],
              homework: record["% Hoàn thành BTVN"],
              bonus: record["Điểm thưởng"],
              attendance: record["Có mặt"] ? (record["Đi muộn"] ? "Đi muộn" : "Có mặt") : (record["Vắng có phép"] ? "Vắng có phép" : "Vắng"),
              note: record["Ghi chú"],
            };
          }).filter(Boolean);

          return (
            <Table
              columns={[
                {
                  title: "Ngày",
                  dataIndex: "date",
                  key: "date",
                  width: 120,
                  render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
                },
                {
                  title: "Bài kiểm tra",
                  dataIndex: "testName",
                  key: "testName",
                  width: 200,
                  render: (name: string) => name || "-",
                },
                {
                  title: "Điểm",
                  dataIndex: "score",
                  key: "score",
                  width: 100,
                  align: "center" as const,
                  render: (score: number | null, record: any) => {
                    if (score === null) return <span style={{ color: "#ccc" }}>-</span>;
                    return (
                      <Popover
                        title="Điểm thành phần"
                        content={
                          record.scoreDetails && Array.isArray(record.scoreDetails) && record.scoreDetails.length > 0 ? (
                            <div>
                              <Descriptions size="small" column={1}>
                                {record.scoreDetails.map((detail: any, idx: number) => (
                                  <Descriptions.Item key={idx} label={detail["Tên điểm"] || `Điểm ${idx + 1}`}>
                                    {detail["Điểm"]} {detail["Ghi chú"] ? `(${detail["Ghi chú"]})` : ""}
                                  </Descriptions.Item>
                                ))}
                              </Descriptions>
                            </div>
                          ) : (
                            <div>Không có điểm thành phần</div>
                          )
                        }
                      >
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
                          style={{ cursor: record.scoreDetails ? "pointer" : "default" }}
                        >
                          {score.toFixed(1)}
                        </Tag>
                      </Popover>
                    );
                  },
                },
                {
                  title: "% BTVN",
                  dataIndex: "homework",
                  key: "homework",
                  width: 100,
                  align: "center" as const,
                  render: (val: number) => val != null ? `${val}%` : "-",
                },
                {
                  title: "Điểm thưởng",
                  dataIndex: "bonus",
                  key: "bonus",
                  width: 100,
                  align: "center" as const,
                  render: (val: number) => val != null ? val : "-",
                },
                {
                  title: "Điểm danh",
                  dataIndex: "attendance",
                  key: "attendance",
                  width: 120,
                  align: "center" as const,
                  render: (attendance: string) => {
                    const color = attendance === "Có mặt" ? "green" : attendance === "Đi muộn" ? "orange" : "red";
                    return <Tag color={color}>{attendance}</Tag>;
                  },
                },
                {
                  title: "Ghi chú",
                  dataIndex: "note",
                  key: "note",
                  render: (note: string) => note || "-",
                },
              ]}
              dataSource={studentRecords}
              rowKey="sessionId"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `Tổng ${total} buổi học`,
              }}
              locale={{
                emptyText: <Empty description="Chưa có điểm" />,
              }}
            />
          );
        })()}
      </Modal>
    </WrapperContent>
  );
};

export default ClassGradeBook;
