import WrapperContent from "@/components/WrapperContent";

import {
  supabaseGetAll,
  supabaseGetById,
  supabaseSet,
  supabaseUpdate,
  supabaseRemove,
  supabaseOnValue,
  convertFromSupabaseFormat,
  convertToSupabaseFormat,
} from "@/utils/supabaseHelpers";
import { subjectMap, subjectOptions } from "@/utils/selectOptions";
import {
  Tabs,
  Table,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Tag,
  Space,
  Modal,
  Card,
  Typography,
  Row,
  Col,
  message,
  Upload,
  Image,
  Popconfirm,
  Dropdown,
  Menu,
  Empty,
} from "antd";
import type { UploadFile } from "antd";
import {
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  PrinterOutlined,
  FileImageOutlined,
  DeleteOutlined,
  MoreOutlined,
  RollbackOutlined,
} from "@ant-design/icons";
import { EditOutlined } from "@ant-design/icons";
import React, { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import html2canvas from "html2canvas";
import DiscountInput from "../DiscountInput";

const { Title, Text } = Typography;
const { Option } = Select;

interface Student {
  id: string;
  "Họ và tên": string;
  "Mã học sinh"?: string;
  "Số điện thoại"?: string;
  Email?: string;
  [key: string]: any;
}

interface Teacher {
  id: string;
  "Họ và tên": string;
  "Mã giáo viên"?: string;
  "Biên chế"?: string;
  "Số điện thoại"?: string;
  Email?: string;
  "Ngân hàng"?: string;
  STK?: string;
  [key: string]: any;
}

interface AttendanceSession {
  id: string;
  Ngày: string;
  "Giờ bắt đầu": string;
  "Giờ kết thúc": string;
  "Mã lớp": string;
  "Tên lớp": string;
  "Teacher ID": string;
  "Giáo viên": string;
  "Student IDs"?: string[];
  "Điểm danh"?: any[];
  "Phụ cấp di chuyển"?: number;
  [key: string]: any;
}

interface Course {
  id: string;
  Khối: number;
  "Môn học": string;
  Giá: number;
  "Lương GV Part-time": number;
  "Lương GV Full-time": number;
  [key: string]: any;
}

interface StudentInvoice {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  month: number;
  year: number;
  totalSessions: number;
  totalAmount: number;
  discount: number;
  finalAmount: number;
  debt?: number; // Custom debt amount (overrides calculated debt)
  status: "paid" | "unpaid";
  sessions: AttendanceSession[];
  invoiceImage?: string; // Base64 image data
  // Class information
  classId?: string;
  className?: string;
  classCode?: string;
  subject?: string;
  pricePerSession?: number;
}

// Grouped invoice by student (for expandable rows)
interface GroupedStudentInvoice {
  studentId: string;
  studentName: string;
  studentCode: string;
  month: number;
  year: number;
  invoices: StudentInvoice[]; // Multiple invoices if student has multiple classes
  totalSessions: number; // Sum of all classes
  totalAmount: number; // Sum of all classes
  discount: number; // Total discount
  finalAmount: number; // Total final amount
  status: "paid" | "unpaid"; // "paid" only if all invoices are paid
}

interface TeacherSalary {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherCode: string;
  bienChe: string;
  month: number;
  year: number;
  totalSessions: number;
  salaryPerSession: number;
  totalSalary: number;
  totalAllowance: number;
  totalHours: number;
  totalMinutes: number;
  status: "paid" | "unpaid";
  sessions: AttendanceSession[];
  invoiceImage?: string; // Base64 image data
}

const InvoicePage = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tuitionFees, setTuitionFees] = useState<Record<string, number | null>>({}); // Key: "Mã học sinh-Mã lớp"

  // Helper to normalize Vietnamese text for searching (remove accents, lowercase, trim)
  const normalizeText = (value: string) =>
    value
      ? value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
      : "";

  // Student invoice filters
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [studentMonth, setStudentMonth] = useState(dayjs().month());
  const [studentYear, setStudentYear] = useState(dayjs().year());
  const [studentStatusFilter, setStudentStatusFilter] = useState<
    "all" | "paid" | "unpaid"
  >("unpaid");
  const [studentClassFilter, setStudentClassFilter] = useState<string[]>([]); // Nhiều lớp
  const [studentTeacherFilter, setStudentTeacherFilter] = useState<string>("all"); // Lọc theo giáo viên

  // Trigger to force recalculation after discount update
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Row selection state for bulk delete (unpaid tab)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Row selection state for bulk delete (paid tab)
  const [selectedPaidRowKeys, setSelectedPaidRowKeys] = useState<React.Key[]>([]);

  // State for QR preference in invoice modal
  const [includeQRInInvoice, setIncludeQRInInvoice] = useState(true);

  // Track active tab to auto-apply status filters
  const [activeTab, setActiveTab] = useState<string>("students");

  // State for QR preference per invoice (for table)
  const [invoiceQRPreferences, setInvoiceQRPreferences] = useState<Record<string, boolean>>({});

  // Edit invoice modal state (restore edit functionality)
  const [editingInvoice, setEditingInvoice] = useState<StudentInvoice | null>(
    null
  );
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editDebt, setEditDebt] = useState<number>(0);
  const [editInvoiceModalOpen, setEditInvoiceModalOpen] =
    useState<boolean>(false);
  // State to track individual session prices when editing
  const [editSessionPrices, setEditSessionPrices] = useState<{ [sessionId: string]: number }>({});
  // State to track edited session counts per subject
  const [editSessionCounts, setEditSessionCounts] = useState<{ [subject: string]: number }>({});

  // Edit teacher salary modal state
  const [editingTeacherSalary, setEditingTeacherSalary] = useState<TeacherSalary | null>(null);
  const [editTeacherSessionSalaries, setEditTeacherSessionSalaries] = useState<{ [sessionId: string]: number }>({});
  const [editTeacherModalOpen, setEditTeacherModalOpen] = useState<boolean>(false);

  // Modal to show detailed accumulated debt when clicking "Tổng nợ lũy kế"
  const [debtDetailModal, setDebtDetailModal] = useState<{
    visible: boolean;
    studentId?: string;
    studentName?: string;
    month?: number;
    year?: number;
    items: { month: number; year: number; amount: number }[];
    total: number;
  }>({
    visible: false,
    items: [],
    total: 0,
  });

  // Helpers to handle keys that are invalid in Firebase paths (like containing '/')
  const sanitizeKey = (key: string) => key.replace(/[.#$\/[\]]/g, "_");

  const sanitizeObjectKeys = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(sanitizeObjectKeys);
    if (obj !== null && typeof obj === "object") {
      return Object.entries(obj).reduce((acc: any, [k, v]) => {
        acc[sanitizeKey(k)] = sanitizeObjectKeys(v);
        return acc;
      }, {});
    }
    return obj;
  };

  const getSafeField = (obj: any, field: string) => {
    if (!obj) return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, field)) return obj[field];
    const sk = sanitizeKey(field);
    if (Object.prototype.hasOwnProperty.call(obj, sk)) return obj[sk];
    return undefined;
  };

  // Teacher salary filters
  const [teacherSearchTerm, setTeacherSearchTerm] = useState("");
  const [teacherMonth, setTeacherMonth] = useState(dayjs().month());
  const [teacherYear, setTeacherYear] = useState(dayjs().year());
  const [teacherBienCheFilter, setTeacherBienCheFilter] =
    useState<string>("all");
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<
    "all" | "paid" | "unpaid"
  >("all");

  // Invoice status storage in Firebase
  const [studentInvoiceStatus, setStudentInvoiceStatus] = useState<
    Record<
      string,
      | {
        status: "paid" | "unpaid";
        discount?: number;
        debt?: number; // Custom debt amount
        // Full invoice data for paid records
        studentId?: string;
        studentName?: string;
        studentCode?: string;
        month?: number;
        year?: number;
        totalSessions?: number;
        totalAmount?: number;
        finalAmount?: number;
        paidAt?: string;
        sessions?: any[];
        invoiceImage?: string;
        sessionPrices?: { [sessionId: string]: number }; // Custom prices per session
      }
      | "paid"
      | "unpaid"
    >
  >({});
  const [teacherSalaryStatus, setTeacherSalaryStatus] = useState<
    Record<
      string,
      | "paid"
      | "unpaid"
      | {
        status: "paid" | "unpaid";
        // Full salary data for paid records
        teacherId?: string;
        teacherName?: string;
        teacherCode?: string;
        bienChe?: string;
        month?: number;
        year?: number;
        totalSessions?: number;
        salaryPerSession?: number;
        totalHours?: number;
        totalMinutes?: number;
        totalSalary?: number;
        totalAllowance?: number;
        sessionSalaries?: { [sessionId: string]: number }; // Custom salaries per session
        paidAt?: string;
        bankInfo?: {
          bank: string | null;
          accountNo: string | null;
          accountName: string | null;
        };
        invoiceImage?: string;
        sessions?: any[];
      }
    >
  >({});

  // Load payment status from Firebase
  useEffect(() => {
    // Load from Supabase phieu_thu_hoc_phi_chi_tiet
    // Load teacher salaries from Supabase

        const unsubscribeStudents = supabaseOnValue("datasheet/Phiáº¿u_thu_há»c_phÃ­_chi_tiáº¿t", (data) => {
      if (data) {
        // Group invoices by studentId-month-year
        const groupedInvoices: Record<string, any> = {};
        Object.entries(data).forEach(([id, invoiceDetail]: [string, any]) => {
          const studentId = invoiceDetail.studentId || invoiceDetail.student_id || "";
          const month = invoiceDetail.month !== undefined ? invoiceDetail.month : 0;
          const year = invoiceDetail.year !== undefined ? invoiceDetail.year : 0;
          const groupKey = `${studentId}-${month}-${year}`;
          
          if (!groupedInvoices[groupKey]) {
            groupedInvoices[groupKey] = {
              id: groupKey,
              studentId,
              studentName: invoiceDetail.studentName || invoiceDetail.student_name || "",
              studentCode: invoiceDetail.studentCode || invoiceDetail.student_code || "",
              month,
              year,
              subjects: [],
              totalSessions: 0,
              totalAmount: 0,
              discount: 0,
              finalAmount: 0,
              status: "unpaid",
            };
          }
          
          const existing = groupedInvoices[groupKey];
          existing.subjects.push({
            subject: invoiceDetail.subject || "",
            classId: invoiceDetail.classId || invoiceDetail.class_id || "",
            className: invoiceDetail.className || invoiceDetail.class_name || "",
            classCode: invoiceDetail.classCode || invoiceDetail.class_code || "",
            pricePerSession: invoiceDetail.pricePerSession || invoiceDetail.price_per_session || 0,
            totalSessions: invoiceDetail.totalSessions || invoiceDetail.total_sessions || 0,
            totalAmount: invoiceDetail.totalAmount || invoiceDetail.total_amount || 0,
            discount: invoiceDetail.discount || 0,
            finalAmount: invoiceDetail.finalAmount || invoiceDetail.final_amount || 0,
            status: invoiceDetail.status || "unpaid",
          });
          
          existing.totalSessions += invoiceDetail.totalSessions || invoiceDetail.total_sessions || 0;
          existing.totalAmount += invoiceDetail.totalAmount || invoiceDetail.total_amount || 0;
          existing.discount += invoiceDetail.discount || 0;
          existing.finalAmount += invoiceDetail.finalAmount || invoiceDetail.final_amount || 0;
          
          if (invoiceDetail.status === "paid") {
            existing.status = "paid";
          }
        });
        
        setStudentInvoiceStatus(groupedInvoices);
      }
    });

        const unsubscribeTeachers = supabaseOnValue("datasheet/Phiếu_lương_giáo_viên", (data) => {
      if (data) {
        setTeacherSalaryStatus(data);
      }
    });

    return () => {
      unsubscribeStudents();
      unsubscribeTeachers();
    };
  }, []);

  // Load QR preferences from localStorage on mount
  useEffect(() => {
    const savedPreferences: Record<string, boolean> = {};
    // Load all saved QR preferences from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("qr-pref-")) {
        const invoiceId = key.replace("qr-pref-", "");
        const value = localStorage.getItem(key);
        if (value !== null) {
          savedPreferences[invoiceId] = value === "true";
        }
      }
    }
    if (Object.keys(savedPreferences).length > 0) {
      setInvoiceQRPreferences(savedPreferences);
    }
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch students from Supabase
        const studentsData = await supabaseGetAll("datasheet/Học_sinh");
        if (studentsData && typeof studentsData === 'object') {
          const studentsArray = Object.entries(studentsData).map(([key, value]: [string, any]) => {
            const converted = convertFromSupabaseFormat(value, "hoc_sinh");
            return {
              id: key,
              ...converted,
            };
          });
          setStudents(studentsArray);
        }

        // Fetch teachers from Supabase
        const teachersData = await supabaseGetAll("datasheet/Giáo_viên");
        if (teachersData && typeof teachersData === 'object') {
          const teachersArray = Object.entries(teachersData).map(([key, value]: [string, any]) => {
            const converted = convertFromSupabaseFormat(value, "giao_vien");
            return {
              id: key,
              ...converted,
            };
          });
          setTeachers(teachersArray);
        }

        // Fetch attendance sessions from Supabase
        const sessionsData = await supabaseGetAll("datasheet/Điểm_danh_sessions");
        if (sessionsData && typeof sessionsData === 'object') {
          const sessionsArray = Object.entries(sessionsData).map(([key, value]: [string, any]) => {
            const converted = convertFromSupabaseFormat(value, "diem_danh_sessions");
            return {
              id: key,
              ...converted,
            };
          });
          setSessions(sessionsArray);
        }

        // Fetch courses from Supabase
        const coursesData = await supabaseGetAll("datasheet/Khóa_học");
        if (coursesData && typeof coursesData === 'object') {
          const coursesArray = Object.entries(coursesData).map(([key, value]: [string, any]) => ({
            id: key,
            ...value,
          }));
          setCourses(coursesArray);
        }

        // Fetch classes from Supabase
        const classesData = await supabaseGetAll("datasheet/Lớp_học");
        if (classesData && typeof classesData === 'object') {
          const classesArray = Object.entries(classesData).map(([key, value]: [string, any]) => {
            const converted = convertFromSupabaseFormat(value, "lop_hoc");
            return {
              id: key,
              ...converted,
            };
          });
          setClasses(classesArray);
        }

        // Fetch tuition fees (Học_phí_riêng) from Supabase
        const tuitionData = await supabaseGetAll("datasheet/Lớp_học/Học_sinh");
        if (tuitionData && typeof tuitionData === 'object') {
          const tuitionMap: Record<string, number | null> = {};
          Object.values(tuitionData).forEach((item: any) => {
            const converted = convertFromSupabaseFormat(item, "lop_hoc_hoc_sinh");
            if (converted && converted.studentCode && converted.classCode) {
              const key = `${converted.studentCode}-${converted.classCode}`;
              tuitionMap[key] = converted.hocPhiRieng || null;
            }
          });
          setTuitionFees(tuitionMap);
        }

        // Fetch timetable entries from Supabase
        const timetableData = await supabaseGetAll("datasheet/Thời_khoá_biểu");
        if (timetableData && typeof timetableData === 'object') {
          const timetableArray = Object.entries(timetableData).map(([key, value]: [string, any]) => ({
            id: key,
            ...value,
          }));
          setTimetableEntries(timetableArray);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        message.error("Lỗi khi tải dữ liệu");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // No longer need calculateTravelAllowance - using salary per session instead

  // Helper function to get hoc_phi_rieng for a specific class
  // Key format: "Mã học sinh-Mã lớp"
  const getHocPhiRieng = (student: Student | undefined, classId?: string): number | null => {
    if (!student) {
      return null;
    }

    // Get class info to get class code
    if (!classId) {
      return null;
    }

    const classInfo = classes.find((c) => c.id === classId);
    if (!classInfo) {
      return null;
    }

    const studentCode = student["Mã học sinh"] || "";
    const classCode = classInfo["Mã lớp"] || "";
    if (!studentCode || !classCode) {
      return null;
    }

    // Look up in tuition fees table with key: "Mã học sinh-Mã lớp"
    const tuitionKey = `${studentCode}-${classCode}`;
    return tuitionFees[tuitionKey] || null;
  };

  // Helper function to get unit price: ưu tiên hoc_phi_rieng theo lớp học (số tiền), nếu không có thì lấy giá môn học
  const getUnitPrice = (studentId: string, subject?: string, classId?: string, pricePerSession?: number): number => {
    // Priority 1: Use student's hoc_phi_rieng for the specific class if available
    const student = students.find((s) => s.id === studentId);
    const hocPhiRieng = getHocPhiRieng(student, classId);
    if (hocPhiRieng !== null) {
      return hocPhiRieng;
    }

    // Priority 2: Get base price from subject (from invoice or class/course)
    if (pricePerSession) {
      // Use price from invoice if available
      return pricePerSession;
    } else if (classId) {
      // Get from class or course
      const classInfo = classes.find((c) => c.id === classId);
      if (classInfo) {
        const course = courses.find((c) => {
          if (c.Khối !== classInfo.Khối) return false;
          const classSubject = classInfo["Môn học"];
          const courseSubject = c["Môn học"];
          if (classSubject === courseSubject) return true;
          const subjectOption = subjectOptions.find(
            (opt) => opt.label === classSubject || opt.value === classSubject
          );
          if (subjectOption) {
            return courseSubject === subjectOption.label || courseSubject === subjectOption.value;
          }
          return false;
        });
        return classInfo?.["Học phí mỗi buổi"] || course?.Giá || 0;
      }
    }

    return 0;
  };

  // Load student invoices directly from Firebase (populated by attendance save)
  const studentInvoices = useMemo(() => {
    console.log(`📋 Loading invoices from Firebase for month ${studentMonth + 1}/${studentYear}`);

    const invoicesList: StudentInvoice[] = [];

    // Load all invoices from Firebase that match the selected month/year
    Object.entries(studentInvoiceStatus).forEach(([key, data]) => {
      if (!data) return;

      // Skip deleted invoices
      if (typeof data === "object" && data !== null && (data as any).deleted === true) {
        console.log(`⏭️ Skipping deleted invoice: ${key}`);
        return;
      }

      // Parse invoice data
      let invoiceData: any = {};
      if (typeof data === "object" && data !== null) {
        invoiceData = data;
      } else {
        // If data is just a status string, create minimal object
        invoiceData = { status: data };
      }

      const status = invoiceData.status || "unpaid";
      const month = invoiceData.month ?? 0;
      const year = invoiceData.year ?? 0;

      // Only include invoices matching selected month/year
      if (month !== studentMonth || year !== studentYear) {
        return;
      }

      // Get student info
      const studentId = invoiceData.studentId || key.split("-")[0];
      const student = students.find((s) => String(s.id) === String(studentId));

      // Get class/course info - prefer saved data, fallback to sessions
      let className = invoiceData.className || "";
      let classCode = invoiceData.classCode || "";
      let subject = "";
      let pricePerSession = 0;
      let classId = invoiceData.classId || "";

      // Filter sessions to only include those matching the invoice month/year
      // This prevents sessions from other months/years being counted incorrectly
      let validSessions: any[] = [];
      if (invoiceData.sessions && Array.isArray(invoiceData.sessions)) {
        validSessions = invoiceData.sessions.filter((session: any) => {
          if (!session["Ngày"]) return false;
          try {
            const sessionDate = new Date(session["Ngày"]);
            const sMonth = sessionDate.getMonth();
            const sYear = sessionDate.getFullYear();
            // Only include sessions that match the invoice month/year
            return sMonth === month && sYear === year;
          } catch (e) {
            return false;
          }
        });
      }

      // KHÔNG tính lại totalSessions từ sessions.length khi đã có giá trị từ database
      // Chỉ tính lại nếu chưa có giá trị totalSessions trong database
      const recalculatedTotalSessions = invoiceData.totalSessions !== undefined && invoiceData.totalSessions !== null
        ? invoiceData.totalSessions  // Dùng giá trị từ database
        : validSessions.length;      // Chỉ tính lại nếu chưa có

      if (validSessions.length > 0) {
        const firstSession = validSessions[0];
        if (!className) className = firstSession["Tên lớp"] || "";
        if (!classCode) classCode = firstSession["Mã lớp"] || "";
        if (!classId) classId = firstSession["Class ID"] || "";

        // Get subject from class info
        const classInfo = classes.find((c) => c.id === classId);
        if (classInfo) {
          subject = classInfo["Môn học"] || "";
        }
      }

      // Use getUnitPrice() to match table calculation
      // Priority: hoc_phi_rieng > pricePerSession from invoice > from class/course
      pricePerSession = getUnitPrice(
        studentId,
        subject,
        classId,
        invoiceData.pricePerSession
      );

      // Recalculate totalAmount based on valid sessions and pricePerSession
      const recalculatedTotalAmount = recalculatedTotalSessions * pricePerSession;
      const recalculatedFinalAmount = Math.max(0, recalculatedTotalAmount - (invoiceData.discount ?? 0));

      invoicesList.push({
        id: key,
        studentId: studentId,
        studentName: invoiceData.studentName || student?.["Họ và tên"] || "",
        studentCode: invoiceData.studentCode || student?.["Mã học sinh"] || "",
        month: month,
        year: year,
        totalSessions: recalculatedTotalSessions, // Use recalculated value
        totalAmount: recalculatedTotalAmount, // Use recalculated value
        discount: invoiceData.discount ?? 0,
        finalAmount: recalculatedFinalAmount, // Use recalculated value
        status: status as "paid" | "unpaid",
        sessions: validSessions, // Use filtered sessions
        invoiceImage: invoiceData.invoiceImage,
        className,
        classCode,
        subject,
        pricePerSession,
      });
    });

    // Step 2: Auto-create invoices from sessions if they don't exist
    // This handles cases where attendance was saved but invoice wasn't created
    const studentSessionsMap: Record<string, {
      studentId: string;
      classId: string;
      sessions: AttendanceSession[];
    }> = {};

    // Group sessions by student and class for the selected month/year
    sessions.forEach((session) => {
      if (!session["Ngày"] || !session["Điểm danh"]) return;
      
      const sessionDate = new Date(session["Ngày"]);
      const sMonth = sessionDate.getMonth();
      const sYear = sessionDate.getFullYear();
      
      // Only process sessions matching selected month/year
      if (sMonth !== studentMonth || sYear !== studentYear) return;

      const classId = session["Class ID"];
      if (!classId) return;

      // Process attendance records
      const attendanceRecords = Array.isArray(session["Điểm danh"]) ? session["Điểm danh"] : [];
      attendanceRecords.forEach((record: any) => {
        const studentId = record["Student ID"];
        const isPresent = record["Có mặt"] === true;
        
        if (!studentId || !isPresent) return;

        // Check if invoice already exists for this student-class-month-year
        const invoiceKey = `${studentId}-${classId}-${studentMonth}-${studentYear}`;
        const existingInvoice = invoicesList.find(
          inv => inv.id === invoiceKey || 
          (inv.studentId === studentId && inv.month === studentMonth && inv.year === studentYear && inv.classId === classId)
        );
        
        if (existingInvoice) return; // Invoice already exists

        // Group sessions by student-class
        const mapKey = `${studentId}-${classId}`;
        if (!studentSessionsMap[mapKey]) {
          studentSessionsMap[mapKey] = {
            studentId,
            classId,
            sessions: [],
          };
        }
        
        // Check if this session is already added
        const sessionExists = studentSessionsMap[mapKey].sessions.some(
          s => s.id === session.id
        );
        if (!sessionExists) {
          studentSessionsMap[mapKey].sessions.push(session);
        }
      });
    });

    // Create invoices for sessions that don't have invoices yet
    Object.values(studentSessionsMap).forEach(({ studentId, classId, sessions: studentSessions }) => {
      if (studentSessions.length === 0) return;

      const student = students.find((s) => s.id === studentId);
      if (!student) return;

      const classInfo = classes.find((c) => c.id === classId);
      if (!classInfo) return;

      // Use getUnitPrice() to match table calculation
      // Priority: hoc_phi_rieng > pricePerSession from invoice > from class/course
      const subject = classInfo["Môn học"] || "";
      const pricePerSession = getUnitPrice(
        studentId,
        subject,
        classId,
        undefined
      );

      if (pricePerSession === 0) return;

      // Create invoice from sessions
      const invoiceKey = `${studentId}-${classId}-${studentMonth}-${studentYear}`;
      const sessionInfos = studentSessions.map(session => ({
        Ngày: session["Ngày"],
        "Tên lớp": session["Tên lớp"],
        "Mã lớp": session["Mã lớp"],
        "Class ID": session["Class ID"],
      }));

      const totalSessions = studentSessions.length;
      const totalAmount = totalSessions * pricePerSession;
      const finalAmount = totalAmount;

      invoicesList.push({
        id: invoiceKey,
        studentId,
        studentName: student["Họ và tên"] || "",
        studentCode: student["Mã học sinh"] || "",
        month: studentMonth,
        year: studentYear,
        totalSessions,
        totalAmount,
        discount: 0,
        finalAmount,
        status: "unpaid",
        sessions: sessionInfos as any,
        className: classInfo["Tên lớp"] || "",
        classCode: classInfo["Mã lớp"] || "",
        classId,
        subject: classInfo["Môn học"] || "",
        pricePerSession,
      });
    });

    console.log(`📊 Total invoices loaded from Firebase: ${invoicesList.length}`);
    console.log(`📊 Unpaid: ${invoicesList.filter(i => i.status !== "paid").length}`);
    console.log(`📊 Paid: ${invoicesList.filter(i => i.status === "paid").length}`);

    return invoicesList;
  }, [
    studentInvoiceStatus,
    students,
    classes,
    courses,
    sessions,
    studentMonth,
    studentYear,
    refreshTrigger,
    tuitionFees,
  ]);

  // Calculate teacher salaries
  const teacherSalaries = useMemo(() => {
    const salariesMap: Record<string, TeacherSalary> = {};

    // First, load all paid salaries from Firebase (these are immutable)
    Object.entries(teacherSalaryStatus).forEach(([key, data]) => {
      if (!data) return;

      const status = typeof data === "string" ? data : data.status;

      // If paid and has complete data in Firebase, use it directly
      if (status === "paid" && typeof data === "object" && data.teacherId) {
        // Only include if it matches the selected month/year
        if (data.month === teacherMonth && data.year === teacherYear) {
          salariesMap[key] = {
            id: key,
            teacherId: data.teacherId,
            teacherName: data.teacherName || "",
            teacherCode: data.teacherCode || "",
            bienChe: data.bienChe || "Chưa phân loại",
            month: data.month ?? 0,
            year: data.year ?? 0,
            totalSessions: data.totalSessions ?? 0,
            salaryPerSession: data.salaryPerSession ?? 0,
            totalSalary: data.totalSalary ?? 0,
            totalAllowance: data.totalAllowance ?? 0,
            totalHours: data.totalHours ?? 0,
            totalMinutes: data.totalMinutes ?? 0,
            status: "paid",
            sessions: data.sessions || [],
          };
        }
      }
    });

    // Then calculate unpaid salaries from sessions
    sessions.forEach((session) => {
      const sessionDate = new Date(session["Ngày"]);
      const sessionMonth = sessionDate.getMonth();
      const sessionYear = sessionDate.getFullYear();

      if (sessionMonth === teacherMonth && sessionYear === teacherYear) {
        const teacherId = session["Teacher ID"];
        if (!teacherId) return;

        const key = `${teacherId}-${sessionMonth}-${sessionYear}`;

        // Skip if already loaded from Firebase as paid
        if (salariesMap[key]?.status === "paid") return;

        const teacher = teachers.find((t) => t.id === teacherId);
        if (!teacher) return;

        const bienChe = teacher["Biên chế"] || "Chưa phân loại";

        // Prefer per-session salary from class, fallback to session then teacher info
        const parseCurrency = (value: unknown) => {
          if (value === undefined || value === null) return 0;
          const num = Number(String(value).replace(/[^0-9.-]+/g, ""));
          return Number.isFinite(num) ? num : 0;
        };

        const classId = session["Class ID"];
        const classInfo = classes.find((c) => c.id === classId);
        
        // Check if there's saved session salary from database (for edited salaries)
        const savedData = teacherSalaryStatus[key];
        const savedSessionSalaries = (typeof savedData === "object" && savedData?.sessionSalaries) 
          ? savedData.sessionSalaries 
          : null;
        
        // Priority: 1. Saved session salary > 2. Session > 3. Class > 4. Teacher
        let salaryPerSession = 0;
        if (savedSessionSalaries && savedSessionSalaries[session.id] !== undefined) {
          salaryPerSession = savedSessionSalaries[session.id];
        } else {
          salaryPerSession =
            parseCurrency(getSafeField(session, "Lương/buổi")) ||          // Lương/buổi từ session
            parseCurrency(session["Lương GV"]) ||          // 1. Từ Session (ưu tiên)
            parseCurrency(classInfo?.["Lương GV"]) ||       // 2. Từ Lớp học (fallback)
            parseCurrency(teacher["Lương theo buổi"]);     // 3. Từ Giáo viên (fallback cuối)
        }

        if (!salariesMap[key]) {
          // Normalize status - handle both direct value and nested object
          const statusValue = teacherSalaryStatus[key];
          const status =
            typeof statusValue === "object" && statusValue?.status
              ? statusValue.status
              : (statusValue as "paid" | "unpaid") || "unpaid";

          salariesMap[key] = {
            id: key,
            teacherId,
            teacherName: teacher["Họ và tên"] || "",
            teacherCode: teacher["Mã giáo viên"] || "",
            bienChe,
            month: sessionMonth,
            year: sessionYear,
            totalSessions: 0,
            salaryPerSession: salaryPerSession,
            totalSalary: 0,
            totalAllowance: 0,
            totalHours: 0,
            totalMinutes: 0,
            status,
            sessions: [],
          };
        }

        salariesMap[key].totalSessions++;
        salariesMap[key].totalSalary += salaryPerSession;

        // Calculate hours and minutes from session
        const startTime = session["Giờ bắt đầu"];
        const endTime = session["Giờ kết thúc"];
        if (startTime && endTime) {
          const [startHour, startMin] = startTime.split(":").map(Number);
          const [endHour, endMin] = endTime.split(":").map(Number);
          const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
          salariesMap[key].totalMinutes += durationMinutes;
        }

        // Calculate travel allowance
        const travelAllowance = Number(session["Phụ cấp di chuyển"]) || 0;
        salariesMap[key].totalAllowance += travelAllowance;

        salariesMap[key].sessions.push(session);
      }
    });

    // Convert total minutes to hours and minutes
    Object.values(salariesMap).forEach((salary) => {
      if (salary.status !== "paid") {
        salary.totalHours = Math.floor(salary.totalMinutes / 60);
        salary.totalMinutes = salary.totalMinutes % 60;
      }
    });

    return Object.values(salariesMap);
  }, [
    sessions,
    teachers,
    classes,
    teacherMonth,
    teacherYear,
    teacherSalaryStatus,
  ]);

  // Get unique classes for filter
  const uniqueClasses = useMemo(() => {
    return classes.map((cls) => ({
      id: cls.id,
      name: cls["Mã lớp"] && cls["Tên lớp"]
        ? `${cls["Mã lớp"]} - ${cls["Tên lớp"]}`
        : cls["Tên lớp"] || cls.id,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes]);

  // Get unique teachers for filter
  const uniqueTeachers = useMemo(() => {
    return teachers.map((teacher) => ({
      id: teacher.id,
      name: teacher["Họ và tên"] || teacher["Tên giáo viên"] || teacher.id,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [teachers]);

  // Filter student invoices with all filters (tab "Chưa thanh toán")
  const filteredStudentInvoices = useMemo(() => {
    if (!studentInvoices || !Array.isArray(studentInvoices)) {
      return [];
    }

    try {
      return studentInvoices.filter((invoice) => {
        if (!invoice) return false;

        // Filter by search term (name)
        const matchSearch =
          !studentSearchTerm ||
          (invoice.studentName &&
            normalizeText(invoice.studentName).includes(
              normalizeText(studentSearchTerm)
            )) ||
          (invoice.studentCode &&
            normalizeText(invoice.studentCode).includes(
              normalizeText(studentSearchTerm)
            ));

        // Filter by month
        const matchMonth = invoice.month !== undefined && invoice.month === studentMonth;

        // Filter by year
        const matchYear = invoice.year !== undefined && invoice.year === studentYear;

        // Filter by status
        const matchStatus =
          invoice.status !== "paid" &&
          studentStatusFilter !== "paid";

        // Filter by class - check if invoice has sessions in selected classes
        const matchClass =
          studentClassFilter.length === 0 ||
          (invoice.sessions && Array.isArray(invoice.sessions) && invoice.sessions.some((session: any) => {
            if (!session) return false;
            const classId = session["Class ID"];
            return classId && studentClassFilter.includes(classId);
          }));

        // Filter by teacher - check if invoice has sessions with selected teacher
        const matchTeacher =
          studentTeacherFilter === "all" ||
          (invoice.sessions && Array.isArray(invoice.sessions) && invoice.sessions.some((session: any) => {
            if (!session) return false;
            const classId = session["Class ID"];
            if (!classId) return false;
            const classData = classes.find(c => c && c.id === classId);
            if (!classData) return false;
            const teacherId = classData["Teacher ID"];
            return teacherId === studentTeacherFilter;
          }));

        return matchSearch && matchMonth && matchYear && matchStatus && matchClass && matchTeacher;
      });
    } catch (error) {
      console.error("Error filtering student invoices:", error);
      return [];
    }
  }, [studentInvoices, studentSearchTerm, studentMonth, studentYear, studentStatusFilter, studentClassFilter, studentTeacherFilter, classes]);

  // Group unpaid invoices by student
  const groupedStudentInvoices = useMemo(() => {
    const groupMap = new Map<string, GroupedStudentInvoice>();

    filteredStudentInvoices.forEach((invoice) => {
      const key = invoice.studentId;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          studentId: invoice.studentId,
          studentName: invoice.studentName,
          studentCode: invoice.studentCode,
          month: invoice.month,
          year: invoice.year,
          invoices: [],
          totalSessions: 0,
          totalAmount: 0,
          discount: 0,
          finalAmount: 0,
          status: "unpaid",
        });
      }

      const group = groupMap.get(key)!;
      group.invoices.push(invoice);
      group.totalSessions += invoice.totalSessions;
      group.totalAmount += invoice.totalAmount;
      group.discount += invoice.discount;
      group.finalAmount += invoice.finalAmount;
    });

    return Array.from(groupMap.values());
  }, [filteredStudentInvoices]);

  // Filter paid student invoices (for paid tab)
  const filteredPaidStudentInvoices = useMemo(() => {
    return studentInvoices.filter((invoice) => {
      const matchSearch =
        !studentSearchTerm ||
        (invoice.studentName &&
          normalizeText(invoice.studentName).includes(
            normalizeText(studentSearchTerm)
          )) ||
        (invoice.studentCode &&
          normalizeText(invoice.studentCode).includes(
            normalizeText(studentSearchTerm)
          ));

      // Only show paid invoices
      const matchStatus = invoice.status === "paid";

      return matchSearch && matchStatus;
    });
  }, [studentInvoices, studentSearchTerm]);

  // Filter teacher salaries
  const filteredTeacherSalaries = useMemo(() => {
    return teacherSalaries.filter((salary) => {
      const matchSearch =
        !teacherSearchTerm ||
        salary.teacherName
          .toLowerCase()
          .includes(teacherSearchTerm.toLowerCase()) ||
        salary.teacherCode
          .toLowerCase()
          .includes(teacherSearchTerm.toLowerCase());

      const matchBienChe =
        teacherBienCheFilter === "all" ||
        salary.bienChe === teacherBienCheFilter;

      const matchStatus =
        teacherStatusFilter === "all" || salary.status === teacherStatusFilter;

      return matchSearch && matchBienChe && matchStatus;
    });
  }, [
    teacherSalaries,
    teacherSearchTerm,
    teacherBienCheFilter,
    teacherStatusFilter,
  ]);

  // Delete student invoices (bulk delete - unpaid tab) - removed, use individual delete instead
  const handleDeleteMultipleInvoices = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất một phiếu thu để xóa");
      return;
    }

    // selectedRowKeys ở tab chưa thanh toán là studentId (do bảng group theo học sinh)
    const groupedByStudent = new Map(groupedStudentInvoices.map((g) => [g.studentId, g]));

    Modal.confirm({
      title: "Xác nhận xóa",
      content: `Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} phiếu thu đã chọn? Dữ liệu sẽ bị xóa vĩnh viễn.`,
      okText: "Xóa",
      cancelText: "Hủy",
      okType: "danger",
      onOk: async () => {
        try {
          // Lấy thông tin các phiếu trước khi xóa để cập nhật nợ lũy kế
          const invoicesToDelete: Array<{ id: string; studentId: string; month: number; year: number }> = [];
          
          selectedRowKeys.forEach((studentIdKey) => {
            const group = groupedByStudent.get(String(studentIdKey));
            if (!group) return;
            group.invoices.forEach((invoice) => {
              invoicesToDelete.push({
                id: invoice.id,
                studentId: invoice.studentId,
                month: invoice.month,
                year: invoice.year,
              });
            });
          });
          
          const deletePromises: Promise<void>[] = [];
          let totalDeleted = 0;

          selectedRowKeys.forEach((studentIdKey) => {
            const group = groupedByStudent.get(String(studentIdKey));
            if (!group) return;
            group.invoices.forEach((invoice) => {
              const invoiceRef = ref(
                database,
                `datasheet/Phiếu_thu_học_phí/${invoice.id}`
              );
              deletePromises.push(remove(invoiceRef));
              totalDeleted += 1;
            });
          });

          await Promise.all(deletePromises);
          
          // Cập nhật lại nợ lũy kế cho các phiếu tháng sau
          const updatePromises = invoicesToDelete.map((invoice) =>
            updateDebtForLaterInvoices(invoice.studentId, invoice.month, invoice.year)
          );
          await Promise.all(updatePromises);
          
          message.success(`Đã xóa ${totalDeleted} phiếu thu`);
          setSelectedRowKeys([]);
          setRefreshTrigger((prev) => prev + 1);
        } catch (error) {
          console.error("Error deleting invoices:", error);
          message.error("Lỗi khi xóa phiếu thu");
        }
      },
    });
  };

  // Delete paid student invoices (bulk delete - paid tab)
  const handleDeleteMultiplePaidInvoices = async () => {
    if (selectedPaidRowKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất một phiếu thu để xóa");
      return;
    }

    Modal.confirm({
      title: "Xác nhận xóa",
      content: `Bạn có chắc chắn muốn xóa ${selectedPaidRowKeys.length} phiếu thu đã thanh toán đã chọn? Dữ liệu sẽ bị xóa vĩnh viễn.`,
      okText: "Xóa",
      cancelText: "Hủy",
      okType: "danger",
      onOk: async () => {
        try {
          // Lấy thông tin các phiếu trước khi xóa để cập nhật nợ lũy kế
          const invoicesToDelete: Array<{ id: string; studentId: string; month: number; year: number }> = [];
          
          for (const invoiceId of selectedPaidRowKeys) {
            const invoiceIdStr = String(invoiceId);
            
            const invoiceSnapshot = await get(invoiceRef);
            
            if (invoiceSnapshot.exists()) {
              const invoiceData = invoiceSnapshot.val();
              invoicesToDelete.push({
                id: invoiceIdStr,
                studentId: invoiceData.studentId || invoiceIdStr.split("-")[0],
                month: invoiceData.month ?? 0,
                year: invoiceData.year ?? 0,
              });
            }
          }
          
          // Xóa các phiếu
          const deletePromises = selectedPaidRowKeys.map(async (invoiceId) => {
            const invoiceIdStr = String(invoiceId);
            const invoiceRef = ref(
              database,
              `datasheet/Phiếu_thu_học_phí/${invoiceIdStr}`
            );
            // Permanently delete
            await remove(invoiceRef);
          });

          await Promise.all(deletePromises);
          
          // Cập nhật lại nợ lũy kế cho các phiếu tháng sau
          const updatePromises = invoicesToDelete.map((invoice) =>
            updateDebtForLaterInvoices(invoice.studentId, invoice.month, invoice.year)
          );
          await Promise.all(updatePromises);
          
          message.success(`Đã xóa ${selectedPaidRowKeys.length} phiếu thu`);
          setSelectedPaidRowKeys([]);
          setRefreshTrigger((prev) => prev + 1);
        } catch (error) {
          console.error("Error deleting invoices:", error);
          message.error("Lỗi khi xóa phiếu thu");
        }
      },
    });
  };


  // Helper function to update debt for invoices after a deleted invoice
  const updateDebtForLaterInvoices = async (
    deletedStudentId: string,
    deletedMonth: number,
    deletedYear: number
  ) => {
    // Tìm tất cả các phiếu tháng sau của cùng học sinh và xóa trường debt để tự tính lại
    const updatePromises: Promise<void>[] = [];
    Object.entries(studentInvoiceStatus).forEach(([key, data]) => {
      if (!data || typeof data !== "object") return;
      
      const invoiceStudentId = data.studentId || key.split("-")[0];
      const invoiceMonth = data.month ?? 0;
      const invoiceYear = data.year ?? 0;
      
      // Chỉ cập nhật các phiếu của cùng học sinh và tháng sau phiếu đã xóa
      if (invoiceStudentId === deletedStudentId) {
        const isAfterDeleted = invoiceYear > deletedYear || 
          (invoiceYear === deletedYear && invoiceMonth > deletedMonth);
        
        if (isAfterDeleted && data.debt !== undefined) {
          // Xóa trường debt để tự tính lại từ getStudentDebtBreakdown
          
          updatePromises.push(update(updateRef, { debt: null }));
        }
      }
    });
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`✅ Đã cập nhật lại nợ lũy kế cho ${updatePromises.length} phiếu tháng sau`);
    }
  };

  // Delete single invoice - permanently remove from database
  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      const invoiceRef = ref(
        database,
        `datasheet/Phiếu_thu_học_phí/${invoiceId}`
      );
      
      // Lấy thông tin phiếu trước khi xóa để cập nhật nợ lũy kế cho các phiếu tháng sau
      const invoiceSnapshot = await get(invoiceRef);
      let deletedInvoiceData: any = null;
      if (invoiceSnapshot.exists()) {
        deletedInvoiceData = invoiceSnapshot.val();
      }
      
      // Permanently delete the invoice from Firebase
      await remove(invoiceRef);
      
      // Nếu có thông tin phiếu đã xóa, cập nhật lại nợ lũy kế cho các phiếu tháng sau
      if (deletedInvoiceData) {
        const deletedStudentId = deletedInvoiceData.studentId || invoiceId.split("-")[0];
        const deletedMonth = deletedInvoiceData.month ?? 0;
        const deletedYear = deletedInvoiceData.year ?? 0;
        
        await updateDebtForLaterInvoices(deletedStudentId, deletedMonth, deletedYear);
      }
      
      message.success("Đã xóa phiếu thu");
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      message.error("Lỗi khi xóa phiếu thu");
    }
  };

  // Reset và tạo lại TẤT CẢ invoice từ dữ liệu điểm danh
  const resetAllInvoicesFromSessions = async () => {
    Modal.confirm({
      title: "Xác nhận reset toàn bộ invoice",
      content: `Bạn có chắc chắn muốn RESET và tạo lại TẤT CẢ invoice từ dữ liệu điểm danh?\n\nHành động này sẽ:\n- Xóa TẤT CẢ invoice (cả đã thanh toán và chưa thanh toán)\n- Tạo lại invoice từ dữ liệu điểm danh\n- Tự động tính công nợ cho từng invoice\n\n⚠️ CẢNH BÁO: Dữ liệu invoice hiện tại sẽ bị XÓA VĨNH VIỄN!`,
      okText: "Reset tất cả",
      cancelText: "Hủy",
      okType: "danger",
      width: 600,
      onOk: async () => {
        try {
          message.loading({ content: "Đang reset và tạo lại invoice từ điểm danh...", key: "resetInvoices", duration: 0 });
          
          // Step 1: Lấy tất cả invoice hiện tại
          const allInvoices = await supabaseGetAll("datasheet/Phiếu_thu_học_phí_chi_tiết") || {};
          
          // Step 2: Xóa tất cả invoice
          message.loading({ content: `Đang xóa ${Object.keys(allInvoices).length} invoice cũ...`, key: "resetInvoices" });
          const deletePromises = Object.keys(allInvoices).map((key) => {
            
            return remove(invoiceRef);
          });
          await Promise.all(deletePromises);
          
          // Step 3: Tạo lại invoice từ sessions
          message.loading({ content: "Đang tạo lại invoice từ điểm danh...", key: "resetInvoices" });
          
          const invoicesToCreate: Record<string, any> = {};
          const invoiceDebtMap: Record<string, number> = {}; // Lưu debt cho từng invoice
          
          // Group sessions by student-class-month-year
          sessions.forEach((session) => {
            if (!session["Ngày"] || !session["Điểm danh"]) return;
            
            const sessionDate = new Date(session["Ngày"]);
            const sessionMonth = sessionDate.getMonth();
            const sessionYear = sessionDate.getFullYear();
            const classId = session["Class ID"];
            const classInfo = classes.find((c) => c.id === classId);
            
            if (!classInfo) return;
            
            // Get price per session
            const subject = classInfo["Môn học"] || "";
            const course = courses.find((c) => {
              if (c.Khối !== classInfo.Khối) return false;
              const courseSubject = c["Môn học"];
              if (courseSubject === subject) return true;
              const subjectOption = subjectOptions.find(
                (opt) => opt.label === subject || opt.value === subject
              );
              if (subjectOption) {
                return courseSubject === subjectOption.label || courseSubject === subjectOption.value;
              }
              return false;
            });
            
            const pricePerSession = classInfo?.["Học phí mỗi buổi"] || course?.Giá || 0;
            if (pricePerSession === 0) return;
            
            // Process attendance records
            const attendanceRecords = session["Điểm danh"] || [];
            attendanceRecords.forEach((record: any) => {
              const studentId = record["Student ID"];
              const isPresent = record["Có mặt"] === true || record["Có mặt"] === "true";
              const isExcused = record["Vắng có phép"] === true || record["Vắng có phép"] === "true";
              
              // Tạo invoice cho học sinh có mặt hoặc vắng có phép
              if (!studentId || (!isPresent && !isExcused)) return;
              
              const student = students.find((s) => s.id === studentId);
              if (!student) return;
              
              // Key format: studentId-classId-month-year
              const invoiceKey = `${studentId}-${classId}-${sessionMonth}-${sessionYear}`;
              
              // Initialize invoice if not exists
              if (!invoicesToCreate[invoiceKey]) {
                invoicesToCreate[invoiceKey] = {
                  id: invoiceKey,
                  studentId,
                  studentName: student["Họ và tên"] || "",
                  studentCode: student["Mã học sinh"] || "",
                  classId,
                  className: classInfo["Tên lớp"] || "",
                  classCode: classInfo["Mã lớp"] || "",
                  month: sessionMonth,
                  year: sessionYear,
                  totalSessions: 0,
                  totalAmount: 0,
                  discount: 0,
                  finalAmount: 0,
                  status: "unpaid",
                  sessions: [],
                };
              }
              
              // Add session
              const sessionInfo = {
                Ngày: session["Ngày"],
                "Tên lớp": classInfo["Tên lớp"],
                "Mã lớp": classInfo["Mã lớp"],
                "Class ID": classId,
              };
              
              // Check if session already added
              const sessionExists = invoicesToCreate[invoiceKey].sessions.some(
                (s: any) => s["Ngày"] === session["Ngày"] && s["Class ID"] === classId
              );
              
              if (!sessionExists) {
                invoicesToCreate[invoiceKey].sessions.push(sessionInfo);
                invoicesToCreate[invoiceKey].totalSessions += 1;
                
                // Use hoc_phi_rieng if available
                const hocPhiRieng = getHocPhiRieng(student, classId);
                const sessionPrice = hocPhiRieng !== null ? hocPhiRieng : pricePerSession;
                
                invoicesToCreate[invoiceKey].totalAmount += sessionPrice;
              }
            });
          });
          
          // Step 4: Tính debt và tạo invoice
          message.loading({ content: "Đang tính công nợ và tạo invoice...", key: "resetInvoices" });
          
          const createPromises: Promise<void>[] = [];
          let createdCount = 0;
          
          // Sort invoices by year and month to calculate debt correctly
          const sortedInvoiceKeys = Object.keys(invoicesToCreate).sort((a, b) => {
            const invA = invoicesToCreate[a];
            const invB = invoicesToCreate[b];
            if (invA.year !== invB.year) return invA.year - invB.year;
            return invA.month - invB.month;
          });
          
          sortedInvoiceKeys.forEach((invoiceKey) => {
            const invoice = invoicesToCreate[invoiceKey];
            
            // Calculate final amount
            invoice.finalAmount = Math.max(0, invoice.totalAmount - (invoice.discount || 0));
            
            // Calculate debt from previous invoices (already created)
            let debt = 0;
            Object.entries(invoicesToCreate).forEach(([key, prevInvoice]) => {
              if (key === invoiceKey) return;
              
              // Only consider invoices before current invoice
              const isBefore = prevInvoice.year < invoice.year || 
                (prevInvoice.year === invoice.year && prevInvoice.month < invoice.month);
              
              if (isBefore && prevInvoice.studentId === invoice.studentId) {
                // Only count unpaid invoices
                if (prevInvoice.status !== "paid") {
                  debt += prevInvoice.finalAmount || prevInvoice.totalAmount || 0;
                }
              }
            });
            
            // Add debt to invoice
            invoice.debt = debt;
            
            // Create invoice in Firebase
            
            createPromises.push(
              set(invoiceRef, invoice).then(() => {
                createdCount++;
              })
            );
          });
          
          await Promise.all(createPromises);
          
          message.success({ 
            content: `Đã reset và tạo lại ${createdCount} invoice từ điểm danh. Tất cả công nợ đã được tính tự động.`, 
            key: "resetInvoices",
            duration: 5
          });
          
          // Refresh data
          setRefreshTrigger((prev) => prev + 1);
        } catch (error) {
          console.error("Error resetting invoices:", error);
          message.error({ 
            content: "Lỗi khi reset invoice", 
            key: "resetInvoices",
            duration: 3
          });
        }
      }
    });
  };

  // Delete all data for a specific month/year (invoices and sessions)
  const handleDeleteAllDataForMonth = async (targetMonth: number, targetYear: number) => {
    Modal.confirm({
      title: "Xác nhận xóa toàn bộ dữ liệu",
      content: `Bạn có chắc chắn muốn xóa TẤT CẢ dữ liệu tháng ${targetMonth + 1}/${targetYear}?\n\nBao gồm:\n- Tất cả phiếu thu (đã thanh toán và chưa thanh toán)\n- Tất cả buổi điểm danh\n\nDữ liệu sẽ bị xóa VĨNH VIỄN và không thể khôi phục!`,
      okText: "Xóa tất cả",
      cancelText: "Hủy",
      okType: "danger",
      width: 500,
      onOk: async () => {
        try {
          message.loading("Đang xóa dữ liệu...", 0);

          // Step 1: Delete all invoices for the month/year
          const invoicesToDelete: string[] = [];
          Object.entries(studentInvoiceStatus).forEach(([key, data]) => {
            if (!data) return;
            let invoiceData: any = {};
            if (typeof data === "object" && data !== null) {
              invoiceData = data;
            } else {
              invoiceData = { status: data };
            }
            const month = invoiceData.month ?? 0;
            const year = invoiceData.year ?? 0;
            if (month === targetMonth && year === targetYear) {
              invoicesToDelete.push(key);
            }
          });

          if (invoicesToDelete.length > 0) {
            const deleteInvoicePromises = invoicesToDelete.map((key) => {
              
              return remove(invoiceRef);
            });
            await Promise.all(deleteInvoicePromises);
            console.log(`✅ Deleted ${invoicesToDelete.length} invoices`);
          }

          // Step 2: Delete all sessions for the month/year
          const sessionsToDelete: string[] = [];
          sessions.forEach((session) => {
            if (!session["Ngày"] || !session.id) return;
            try {
              const sessionDate = new Date(session["Ngày"]);
              const sMonth = sessionDate.getMonth();
              const sYear = sessionDate.getFullYear();
              if (sMonth === targetMonth && sYear === targetYear) {
                sessionsToDelete.push(session.id);
              }
            } catch (e) {
              // Skip invalid dates
            }
          });

          if (sessionsToDelete.length > 0) {
            const deleteSessionPromises = sessionsToDelete.map((sessionId) => {
              
              return remove(sessionRef);
            });
            await Promise.all(deleteSessionPromises);
            console.log(`✅ Deleted ${sessionsToDelete.length} sessions`);
          }

          message.destroy();
          message.success(
            `Đã xóa ${invoicesToDelete.length} phiếu thu và ${sessionsToDelete.length} buổi điểm danh tháng ${targetMonth + 1}/${targetYear}`
          );
          setRefreshTrigger((prev) => prev + 1);
        } catch (error) {
          console.error("Error deleting data:", error);
          message.destroy();
          message.error("Lỗi khi xóa dữ liệu");
        }
      },
    });
  };

  // Revert paid invoice back to unpaid status
  const handleRevertToUnpaid = async (invoiceId: string) => {
    try {
      const invoiceRef = ref(
        database,
        `datasheet/Phiếu_thu_học_phí/${invoiceId}`
      );
      await update(invoiceRef, {
        status: "unpaid",
        paidAt: null,
        paidBy: null,
      });
      message.success("Đã chuyển phiếu thu về trạng thái chưa thanh toán");
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error reverting invoice:", error);
      message.error("Lỗi khi hoàn trả phiếu thu");
    }
  };

  // Update payment status
  const updateStudentInvoiceStatus = async (
    invoiceId: string,
    status: "paid" | "unpaid"
  ) => {
    Modal.confirm({
      title:
        status === "paid" ? "Xác nhận thanh toán" : "Hủy xác nhận thanh toán",
      content:
        status === "paid"
          ? "Bạn có chắc chắn muốn đánh dấu phiếu thu này đã thanh toán?"
          : "Bạn có chắc chắn muốn hủy trạng thái thanh toán?",
      okText: "Xác nhận",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          // Find the invoice data
          const invoice = studentInvoices.find((inv) => inv.id === invoiceId);
          if (!invoice) {
            message.error("Không tìm thấy thông tin phiếu thu");
            return;
          }

          const invoiceRef = ref(
            database,
            `datasheet/Phiếu_thu_học_phí/${invoiceId}`
          );

          // When marking as paid, save complete invoice data
          if (status === "paid") {
            await update(invoiceRef, {
              status,
              studentId: invoice.studentId,
              studentName: invoice.studentName,
              studentCode: invoice.studentCode,
              month: invoice.month,
              year: invoice.year,
              totalSessions: invoice.totalSessions,
              totalAmount: invoice.totalAmount,
              discount: invoice.discount,
              finalAmount: invoice.finalAmount,
              paidAt: new Date().toISOString(),
              sessions: invoice.sessions.map((s) => ({
                Ngày: s["Ngày"],
                "Tên lớp": s["Tên lớp"],
                "Mã lớp": s["Mã lớp"],
                "Class ID": s["Class ID"],
              })),
            });
          } else {
            // Only allow unpaid if not yet marked as paid
            await update(invoiceRef, {
              status,
            });
          }

          message.success(
            status === "paid"
              ? "Đã đánh dấu đã thanh toán"
              : "Đã đánh dấu chưa thanh toán"
          );
        } catch (error) {
          console.error("Error updating student invoice status:", error);
          message.error("Lỗi khi cập nhật trạng thái");
        }
      },
    });
  };

  // Inline update total amount for grouped invoices
  const handleInlineUpdateTotalAmount = async (
    record: GroupedStudentInvoice,
    newTotalAmount: number
  ) => {
    try {
      const safeTotal = Math.max(0, Math.round(newTotalAmount || 0));
      const currentTotal = record.invoices.reduce(
        (sum, inv) => sum + (inv.totalAmount || 0),
        0
      );

      if (currentTotal === 0) {
        message.warning("Tổng hiện tại bằng 0, không thể phân bổ");
        return;
      }

      const factor = safeTotal / currentTotal;

      const updatePromises = record.invoices.map((invoice) => {
        const newInvoiceTotal = Math.max(
          0,
          Math.round((invoice.totalAmount || 0) * factor)
        );
        // Calculate finalAmount: Thành tiền = (Số buổi × Đơn giá) - Miễn giảm
        // Đơn giá = Giá môn học × Học phí riêng (nếu có)
        const unitPrice = getUnitPrice(invoice.studentId, invoice.subject, invoice.classId, invoice.pricePerSession);
        const newFinal = Math.max(
          0,
          Math.round((invoice.totalSessions * unitPrice) - (invoice.discount || 0))
        );
        const invoiceRef = ref(
          database,
          `datasheet/Phiếu_thu_học_phí/${invoice.id}`
        );
        return update(invoiceRef, {
          totalAmount: newInvoiceTotal,
          finalAmount: newFinal,
        }).then(() => ({
          id: invoice.id,
          totalAmount: newInvoiceTotal,
          finalAmount: newFinal,
        }));
      });

      const updated = await Promise.all(updatePromises);

      // Update local state immediately for printing
      setStudentInvoiceStatus((prev) => {
        const next = { ...prev } as any;
        updated.forEach((item) => {
          const current = next[item.id];
          if (typeof current === "object" && current !== null) {
            next[item.id] = {
              ...current,
              totalAmount: item.totalAmount,
              finalAmount: item.finalAmount,
            };
          }
        });
        return next;
      });

      // Trigger UI refresh
      setRefreshTrigger((prev) => prev + 1);
      message.success("Đã cập nhật tổng tiền");
    } catch (error) {
      console.error("Error updating total amount:", error);
      message.error("Lỗi khi cập nhật tổng tiền");
    }
  };

  // Helper function to get price for a session
  const getSessionPrice = (session: AttendanceSession, studentId?: string): number => {
    // Priority 1: Use student's hoc_phi_rieng for the specific subject if available
    if (studentId) {
      const student = students.find((s) => s.id === studentId);
      const classId = session["Class ID"];
      const classInfo = classes.find((c) => c.id === classId);
      
      const hocPhiRieng = getHocPhiRieng(student, classId);
      if (hocPhiRieng !== null) {
        return hocPhiRieng;
      }
    }

    // Priority 2: Get base price from class or course (theo từng môn)
    const classId = session["Class ID"];
    const classInfo = classes.find((c) => c.id === classId);

    if (!classInfo) return 0;

    // Get price from class or course
    const course = courses.find((c) => {
      if (c.Khối !== classInfo.Khối) return false;
      const classSubject = classInfo["Môn học"];
      const courseSubject = c["Môn học"];
      if (classSubject === courseSubject) return true;
      const subjectOption = subjectOptions.find(
        (opt) => opt.label === classSubject || opt.value === classSubject
      );
      if (subjectOption) {
        return courseSubject === subjectOption.label || courseSubject === subjectOption.value;
      }
      return false;
    });

    return classInfo?.["Học phí mỗi buổi"] || course?.Giá || 0;
  };

  // Update invoice with custom session prices
  const updateStudentInvoiceWithSessionPrices = async (
    invoiceId: string,
    sessionPrices: { [sessionId: string]: number },
    discount: number,
    updatedSessions?: AttendanceSession[],
    debt?: number,
    customTotalSessions?: number
  ) => {
    try {
      const currentData = studentInvoiceStatus[invoiceId];
      const currentStatus =
        typeof currentData === "object" ? currentData.status : currentData;

      if (currentStatus === "paid") {
        message.error("Không thể cập nhật phiếu đã thanh toán.");
        return;
      }

      // Determine sessions to update: prefer provided updatedSessions, else use current invoice sessions
      const currentInvoice = studentInvoices.find((inv) => inv.id === invoiceId);
      if (!currentInvoice) {
        message.error("Không tìm thấy thông tin phiếu thu");
        return;
      }

      const sessionsToUse: AttendanceSession[] = updatedSessions && updatedSessions.length > 0
        ? updatedSessions
        : (currentInvoice.sessions || []).map((session: AttendanceSession) => {
          const newPrice = sessionPrices[session.id];
          if (newPrice !== undefined) {
            // Store price under sanitized key to avoid invalid Firebase keys
            return { ...session, [sanitizeKey("Giá/buổi")]: newPrice } as AttendanceSession;
          }
          return session;
        });

      // Calculate new total from sessionsToUse
      // Priority: Nếu có học phí riêng theo môn → dùng học phí riêng, nếu không → dùng giá từ session
      const student = students.find((st) => st.id === currentInvoice.studentId);
      let newTotalAmount = 0;
      
      // Tính theo từng session với học phí riêng của môn học tương ứng
      newTotalAmount = sessionsToUse.reduce((sum, s) => {
        const classId = s["Class ID"];
        const classInfo = classes.find((c) => c.id === classId);
        const hocPhiRieng = getHocPhiRieng(student, classId);
        
        if (hocPhiRieng !== null) {
          // Dùng học phí riêng cho môn học này
          return sum + hocPhiRieng;
        } else {
          // Dùng giá từ session
          const sessionPrice = Number(getSafeField(s, "Giá/buổi") || 0);
          return sum + sessionPrice;
        }
      }, 0);
      // Calculate finalAmount: Thành tiền = Tổng tiền - Miễn giảm
      const newFinalAmount = Math.max(0, newTotalAmount - discount);

      
      // Sử dụng totalSessions tùy chỉnh nếu có, nếu không giữ nguyên từ database
      const currentTotalSessions = customTotalSessions !== undefined
        ? customTotalSessions
        : (typeof currentData === "object" && currentData.totalSessions !== undefined
          ? currentData.totalSessions
          : currentInvoice.totalSessions);

      // Đảm bảo totalSessions không bị tính lại từ sessions.length
      // Luôn giữ nguyên giá trị hiện tại từ database
      const updateData = {
        ...(typeof currentData === "object" ? currentData : { status: currentStatus || "unpaid" }),
        discount,
        debt: debt !== undefined ? debt : (typeof currentData === "object" && currentData.debt !== undefined ? currentData.debt : 0),
        sessions: sessionsToUse, // Update sessions array with new prices
        sessionPrices, // Store custom prices mapping
        totalAmount: newTotalAmount,
        // QUAN TRỌNG: Giữ nguyên totalSessions từ database, KHÔNG tính từ sessions.length
        // Điều này ngăn số buổi tự động tăng khi cập nhật
        totalSessions: currentTotalSessions, 
        finalAmount: newFinalAmount,
      };
      
      // Đảm bảo totalSessions không bị override bởi logic tính toán tự động
      // KHÔNG BAO GIỜ dùng sessionsToUse.length để tránh số buổi tự động tăng
      if (updateData.totalSessions === undefined || updateData.totalSessions === null) {
        // Chỉ dùng giá trị từ currentInvoice, không dùng sessionsToUse.length
        updateData.totalSessions = currentInvoice.totalSessions || 0;
      }

      console.log("💾 Updating invoice:", {
        invoiceId,
        oldTotalAmount: currentInvoice.totalAmount,
        newTotalAmount,
        oldDiscount: currentInvoice.discount,
        newDiscount: discount,
        oldFinalAmount: currentInvoice.finalAmount,
        newFinalAmount,
        sessionsUpdated: updatedSessions.length,
      });

      // Lưu vào database - nhưng không tự động tính lại số buổi
      const safeData = sanitizeObjectKeys(updateData);
      await set(invoiceRef, safeData);
      message.success("Đã cập nhật phiếu thu học phí");
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error updating invoice:", error);
      message.error("Lỗi khi cập nhật phiếu thu");
    }
  };

  // Reset invoice to original values from database
  const resetInvoiceToOriginal = async (invoiceId: string) => {
    try {
      const currentData = studentInvoiceStatus[invoiceId];
      const currentStatus =
        typeof currentData === "object" ? currentData.status : currentData;

      if (currentStatus === "paid") {
        message.error("Không thể reset phiếu đã thanh toán.");
        return;
      }

      const invoice = studentInvoices.find((inv) => inv.id === invoiceId);
      if (!invoice) {
        message.error("Không tìm thấy thông tin phiếu thu");
        return;
      }

      // Lấy giá gốc từ sessions và tính lại tổng tiền
      const student = students.find((st) => st.id === invoice.studentId);
      let originalTotalAmount = 0;
      const originalSessions: AttendanceSession[] = [];

      invoice.sessions.forEach((session: AttendanceSession) => {
        const classId = session["Class ID"];
        const classInfo = classes.find((c) => c.id === classId);
        const hocPhiRieng = getHocPhiRieng(student, classId);
        
        // Khôi phục session về giá gốc (xóa custom price)
        const originalSession = { ...session };
        // Xóa custom price nếu có
        delete (originalSession as any)[sanitizeKey("Giá/buổi")];
        originalSessions.push(originalSession);

        if (hocPhiRieng !== null) {
          originalTotalAmount += hocPhiRieng;
        } else {
          const sessionPrice = Number(getSafeField(session, "Giá/buổi") || 0);
          if (sessionPrice === 0) {
            // Nếu không có giá trong session, lấy từ class/course
            const course = courses.find((c) => {
              if (c.Khối !== classInfo?.Khối) return false;
              const classSubject = classInfo?.["Môn học"];
              const courseSubject = c["Môn học"];
              return classSubject === courseSubject;
            });
            originalTotalAmount += classInfo?.["Học phí mỗi buổi"] || course?.Giá || 0;
          } else {
            originalTotalAmount += sessionPrice;
          }
        }
      });

      
      // Reset về giá trị gốc: giá gốc, discount = 0, debt = 0, totalSessions giữ nguyên
      const originalTotalSessions = typeof currentData === "object" && currentData.totalSessions !== undefined
        ? currentData.totalSessions
        : invoice.totalSessions;

      const resetData = {
        ...(typeof currentData === "object" ? currentData : { status: currentStatus || "unpaid" }),
        discount: 0, // Reset miễn giảm về 0
        debt: 0, // Reset nợ về 0
        sessions: originalSessions, // Khôi phục sessions về giá gốc
        sessionPrices: {}, // Xóa tất cả custom prices
        totalAmount: originalTotalAmount, // Tính lại từ giá gốc
        totalSessions: originalTotalSessions, // Giữ nguyên số buổi
        finalAmount: originalTotalAmount, // Thành tiền = tổng tiền (không có miễn giảm)
      };

      const safeData = sanitizeObjectKeys(resetData);
      await set(invoiceRef, safeData);
      message.success("Đã reset phiếu thu về giá trị ban đầu");
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error resetting invoice:", error);
      message.error("Lỗi khi reset phiếu thu");
    }
  };

  // Update discount
  const updateStudentDiscount = async (invoiceId: string, discount: number) => {
    console.log(invoiceId, discount, ">>>>>>>>>");
    try {
      const currentData = studentInvoiceStatus[invoiceId];
      const currentStatus =
        typeof currentData === "object" ? currentData.status : currentData;

      // Không cho phép cập nhật nếu đã thanh toán
      if (currentStatus === "paid") {
        message.error(
          "Không thể cập nhật phiếu đã thanh toán. Dữ liệu đã được lưu cố định."
        );
        return;
      }

      // Find the invoice to get totalAmount
      const invoice = studentInvoices.find((inv) => inv.id === invoiceId);
      if (!invoice) {
        message.error("Không tìm thấy thông tin phiếu thu");
        return;
      }

      // Calculate new finalAmount: Thành tiền = (Số buổi × Đơn giá) - Miễn giảm
      // Đơn giá = Giá môn học × Học phí riêng (nếu có)
      const unitPrice = getUnitPrice(invoice.studentId, invoice.subject, invoice.classId, invoice.pricePerSession);
      const finalAmount = Math.max(0, (invoice.totalSessions * unitPrice) - discount);

      // Lưu vào database
      const invoiceRef = ref(
        database,
        `datasheet/Phiếu_thu_học_phí/${invoiceId}`
      );
      const updateData =
        typeof currentData === "object"
          ? { ...currentData, discount, finalAmount }
          : { status: currentStatus || "unpaid", discount, finalAmount };

      await update(invoiceRef, updateData);
      message.success("Đã cập nhật miễn giảm");

      // Trigger recalculation of table
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error updating discount:", error);
      message.error("Lỗi khi cập nhật miễn giảm");
    }
  };

  // Update teacher salary with custom session salaries
  const updateTeacherSalaryWithSessionSalaries = async (
    salaryId: string,
    sessionSalaries: { [sessionId: string]: number },
    updatedSessions?: AttendanceSession[]
  ) => {
    try {
      const currentData = teacherSalaryStatus[salaryId];
      const currentStatus =
        typeof currentData === "object" ? currentData.status : currentData;

      if (currentStatus === "paid") {
        message.error("Không thể cập nhật phiếu lương đã thanh toán.");
        return;
      }

      const currentSalary = teacherSalaries.find((s) => s.id === salaryId);
      if (!currentSalary) {
        message.error("Không tìm thấy thông tin phiếu lương");
        return;
      }

      const sessionsToUse: AttendanceSession[] = updatedSessions && updatedSessions.length > 0
        ? updatedSessions
        : (currentSalary.sessions || []).map((session: AttendanceSession) => {
          const newSalary = sessionSalaries[session.id];
          if (newSalary !== undefined) {
            return { ...session, [sanitizeKey("Lương/buổi")]: newSalary } as AttendanceSession;
          }
          return session;
        });

      // Calculate new totals
      let totalSalary = 0;
      let totalMinutes = 0;
      sessionsToUse.forEach((session) => {
        const salary = Number(getSafeField(session, "Lương/buổi") || sessionSalaries[session.id] || 0);
        totalSalary += salary;
        
        // Calculate duration
        const startTime = session["Giờ bắt đầu"];
        const endTime = session["Giờ kết thúc"];
        if (startTime && endTime) {
          const [startHour, startMin] = startTime.split(":").map(Number);
          const [endHour, endMin] = endTime.split(":").map(Number);
          const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
          totalMinutes += duration;
        }
      });

      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;

      
      const updateData = {
        ...(typeof currentData === "object" ? currentData : { status: currentStatus || "unpaid" }),
        sessions: sessionsToUse,
        sessionSalaries,
        totalSessions: sessionsToUse.length,
        totalSalary,
        totalHours,
        totalMinutes: remainingMinutes,
      };

      const safeData = sanitizeObjectKeys(updateData);
      await set(salaryRef, safeData);
      message.success("Đã cập nhật phiếu lương giáo viên");
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error updating teacher salary:", error);
      message.error("Lỗi khi cập nhật phiếu lương");
    }
  };

  const updateTeacherSalaryStatus = async (
    salaryId: string,
    status: "paid" | "unpaid"
  ) => {
    Modal.confirm({
      title:
        status === "paid" ? "Xác nhận thanh toán" : "Hủy xác nhận thanh toán",
      content:
        status === "paid"
          ? "Bạn có chắc chắn muốn đánh dấu phiếu lương này đã thanh toán?"
          : "Bạn có chắc chắn muốn hủy trạng thái thanh toán?",
      okText: "Xác nhận",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          console.log("🔄 Updating teacher salary status:", {
            salaryId,
            status,
          });

          // Find the salary data
          const salary = teacherSalaries.find((sal) => sal.id === salaryId);
          if (!salary) {
            message.error("Không tìm thấy thông tin phiếu lương");
            return;
          }

          const salaryRef = ref(
            database,
            `datasheet/Phiếu_lương_giáo_viên/${salaryId}`
          );

          console.log(
            "📍 Firebase path:",
            `datasheet/Phiếu_lương_giáo_viên/${salaryId}`
          );

          // When marking as paid, save complete salary data
          if (status === "paid") {
            const teacher = teachers.find((t) => t.id === salary.teacherId);
            await update(salaryRef, {
              status,
              teacherId: salary.teacherId,
              teacherName: salary.teacherName,
              teacherCode: salary.teacherCode,
              bienChe: salary.bienChe,
              month: salary.month,
              year: salary.year,
              totalSessions: salary.totalSessions,
              salaryPerSession: salary.salaryPerSession,
              totalSalary: salary.totalSalary,
              totalAllowance: salary.totalAllowance,
              totalHours: salary.totalHours,
              totalMinutes: salary.totalMinutes,
              paidAt: new Date().toISOString(),
              bankInfo: {
                bank: teacher?.["Ngân hàng"] || null,
                accountNo: teacher?.STK || null,
                accountName: teacher?.["Họ và tên"] || null,
              },
              sessions: salary.sessions.map((s) => ({
                id: s.id,
                Ngày: s["Ngày"],
                "Giờ bắt đầu": s["Giờ bắt đầu"],
                "Giờ kết thúc": s["Giờ kết thúc"],
                "Tên lớp": s["Tên lớp"],
                "Mã lớp": s["Mã lớp"],
              })),
            });
          } else {
            // Only allow unpaid if not yet marked as paid
            await update(salaryRef, { status });
          }

          console.log("✅ Firebase updated successfully");

          // Update local state to trigger re-render
          setTeacherSalaryStatus((prev) => ({
            ...prev,
            [salaryId]: status,
          }));

          message.success(
            status === "paid"
              ? "Đã đánh dấu đã thanh toán"
              : "Đã đánh dấu chưa thanh toán"
          );
        } catch (error) {
          console.error("❌ Error updating teacher salary status:", error);
          message.error("Lỗi khi cập nhật trạng thái");
        }
      },
    });
  };

  // Helper function to merge multiple invoices from same student into one
  const mergeStudentInvoices = (invoices: StudentInvoice[]): StudentInvoice => {
    if (invoices.length === 0) {
      throw new Error("No invoices to merge");
    }
    if (invoices.length === 1) {
      return invoices[0];
    }

    // Use first invoice as base, merge sessions from all invoices
    const base = invoices[0];
    const allSessions = invoices.flatMap(inv => inv.sessions || []);
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalSessions = invoices.reduce((sum, inv) => sum + (inv.totalSessions || 0), 0);
    const totalDiscount = invoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);
    const totalFinalAmount = invoices.reduce((sum, inv) => sum + (inv.finalAmount || 0), 0);

    return {
      ...base,
      sessions: allSessions,
      totalSessions,
      totalAmount,
      discount: totalDiscount,
      finalAmount: totalFinalAmount,
    };
  };

  // View and export invoice
  const viewStudentInvoice = (invoice: StudentInvoice) => {
    let currentInvoiceData = { ...invoice };
    const currentIncludeQR = invoiceQRPreferences[invoice.id] !== false; // Get QR preference from list
    let modal: any = null;

    // Get the latest data from state - but preserve merged sessions
    const getLatestInvoiceData = () => {
      const latestInvoiceData = studentInvoiceStatus[invoice.id];
      let updatedInvoice = { ...currentInvoiceData };

      // Merge with latest data if available, but keep the merged sessions
      if (typeof latestInvoiceData === "object" && latestInvoiceData !== null) {
        updatedInvoice = {
          ...currentInvoiceData,
          studentName: latestInvoiceData.studentName || currentInvoiceData.studentName,
          studentCode: latestInvoiceData.studentCode || currentInvoiceData.studentCode,
          // Keep the merged sessions - don't override with single invoice sessions from Firebase
          // Only update name/code from latest Firebase data
        };
      }
      return updatedInvoice;
    };

    const refreshModal = () => {
      currentInvoiceData = getLatestInvoiceData();
      const freshContent = generateStudentInvoiceHTML(currentInvoiceData, currentIncludeQR);

      // Update modal content
      const modalElement = document.getElementById(`student-invoice-${invoice.id}`);
      if (modalElement) {
        modalElement.innerHTML = freshContent;
      }

      // Update modal title
      if (modal) {
        modal.update({
          title: `Phiếu thu học phí - ${currentInvoiceData.studentName}`,
        });
      }
    };

    const initialInvoiceData = getLatestInvoiceData();
    const content = generateStudentInvoiceHTML(initialInvoiceData, currentIncludeQR);
    const isPaid = initialInvoiceData.status === "paid";

    // Add message listener for auto-save from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SAVE_INVOICE_DATA') {
        const updatedData = event.data.data;
        console.log('Received invoice data update:', updatedData);

        // Update Firebase with the changes
        updateInvoiceFromEditableForm(updatedData);

        // Update current invoice data
        currentInvoiceData = {
          ...currentInvoiceData,
          studentName: updatedData.studentName || currentInvoiceData.studentName,
          studentCode: updatedData.studentCode || currentInvoiceData.studentCode
        };

        // Refresh modal with new data after a short delay to allow Firebase update
        setTimeout(() => {
          refreshModal();
        }, 1000);
      }
    };

    // Function to restore original invoice data from database
    const restoreOriginalInvoice = async () => {
      Modal.confirm({
        title: "Xác nhận reset phiếu thu",
        content: `Bạn có chắc chắn muốn reset phiếu thu về giá trị gốc từ database? Tất cả các thay đổi đã chỉnh sửa sẽ bị mất.`,
        okText: "Reset",
        okType: "danger",
        cancelText: "Hủy",
        onOk: async () => {
          try {
            const latestInvoiceData = studentInvoiceStatus[invoice.id];
            if (typeof latestInvoiceData === "object" && latestInvoiceData !== null) {
              // Refresh modal with original data from database
              currentInvoiceData = {
                ...invoice,
                studentName: latestInvoiceData.studentName || invoice.studentName,
                studentCode: latestInvoiceData.studentCode || invoice.studentCode,
              };
              refreshModal();
              message.success("Đã reset về giá trị gốc");
            } else {
              // If no saved data, use original invoice
              currentInvoiceData = { ...invoice };
              refreshModal();
              message.success("Đã reset về giá trị gốc");
            }
          } catch (error) {
            console.error('Error restoring invoice:', error);
            message.error('Lỗi khi reset');
          }
        }
      });
    };

    window.addEventListener('message', handleMessage);

    modal = Modal.info({
      title: `Phiếu thu học phí - ${initialInvoiceData.studentName}`,
      width: 900,
      maskClosable: true,
      closable: true,
      content: (
        <div
          id={`student-invoice-${invoice.id}`}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ),
      footer: (
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          {!isPaid && (
            <>
              <Button
                danger
                icon={<RollbackOutlined />}
                onClick={restoreOriginalInvoice}
              >
                Reset
              </Button>
              <Button
                icon={<PrinterOutlined />}
                onClick={() => {
                  // Always get the latest data before printing
                  const latestData = getLatestInvoiceData();
                  printInvoice(latestData, currentIncludeQR);
                }}
              >
                In phiếu (gốc)
              </Button>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={() => {
                  // Print with edited values from contenteditable fields
                  printInvoiceWithEditedValues(invoice.id, currentIncludeQR);
                }}
              >
                In với giá trị đã chỉnh sửa
              </Button>
            </>
          )}
          <Button onClick={() => {
            window.removeEventListener('message', handleMessage);
            modal.destroy();
          }}>Đóng</Button>
        </Space>
      ),
    });
  };

  // Function to update invoice data from editable form
  const updateInvoiceFromEditableForm = async (updatedData: any) => {
    try {
      
      // Get current data first
      const currentData = studentInvoiceStatus[updatedData.id];
      if (typeof currentData === "object" && currentData !== null) {
        // Update only the changed fields (name, code) - không tự động tính lại số buổi
        const updateFields: any = {};

        if (updatedData.studentName !== currentData.studentName) {
          updateFields.studentName = updatedData.studentName;
        }
        if (updatedData.studentCode !== currentData.studentCode) {
          updateFields.studentCode = updatedData.studentCode;
        }

        if (Object.keys(updateFields).length > 0) {
          await update(invoiceRef, updateFields);
          message.success('Đã lưu thay đổi tự động');

          // Update local state immediately so print function uses new data
          setStudentInvoiceStatus(prev => ({
            ...prev,
            [updatedData.id]: {
              ...currentData,
              ...updateFields
            }
          }));

          // Refresh the invoice list
          setRefreshTrigger(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error updating invoice from form:', error);
      message.error('Lỗi khi lưu thay đổi');
    }
  };

  const viewTeacherSalary = (salary: TeacherSalary) => {
    const modal = Modal.info({
      title: `Phiếu lương giáo viên - ${salary.teacherName}`,
      width: 800,
      maskClosable: true,
      closable: true,
      content: (
        <div
          id={`teacher-salary-${salary.id}`}
          dangerouslySetInnerHTML={{ __html: generateTeacherSalaryHTML(salary) }}
        />
      ),
      footer: (
        <Space>
        <Button onClick={() => modal.destroy()}>Đóng</Button>
          <Button
            icon={<PrinterOutlined />}
            onClick={() => {
              // Generate fresh content for printing
              const freshContent = generateTeacherSalaryHTML(salary);
              const printWindow = window.open("", "_blank");
              if (!printWindow) return;
              printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <title>In phiếu lương</title>
                  <style>
                    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                    @media print { body { margin: 0; } }
                  </style>
                </head>
                <body>${freshContent}</body>
                </html>
              `);
              printWindow.document.close();
              setTimeout(() => printWindow.print(), 500);
            }}
          >
            In phiếu
          </Button>
        </Space>
      ),
    });
  };

  // Build detailed debt breakdown per month for a student
  // Tính TỔNG TOÀN BỘ NỢ từ TẤT CẢ các tháng/năm TRƯỚC tháng hiện tại, không chỉ trong cùng năm
  const getStudentDebtBreakdown = (
    studentId: string,
    currentMonth: number,
    currentYear: number
  ): { items: { month: number; year: number; amount: number }[]; total: number } => {
    const debtMap: Record<string, { month: number; year: number; amount: number }> = {};

    // 1) Check persisted invoices from Firebase
    // LƯU Ý: studentInvoiceStatus chứa TẤT CẢ invoice từ Firebase (không bị filter theo tháng/năm)
    // Nên có thể tính nợ từ TẤT CẢ các năm trước, không chỉ trong cùng năm
    Object.entries(studentInvoiceStatus).forEach(([key, data]) => {
      if (!data || typeof data === "string") return;
      const sid = data.studentId;
      const m = data.month ?? null;
      const y = data.year ?? null;
      if (!sid || m === null || y === null) return;

      // Only consider invoices for the current student
      if (sid !== studentId) return;

      // Tính TẤT CẢ các tháng/năm TRƯỚC tháng hiện tại
      // Logic: (năm < năm hiện tại) HOẶC (năm = năm hiện tại VÀ tháng < tháng hiện tại)
      // IMPORTANT: currentMonth is 0-indexed (0=Jan, 11=Dec)
      // Ví dụ: Xem tháng 2/2025 (currentMonth=1, currentYear=2025)
      //        → Tính nợ từ: TẤT CẢ các tháng năm 2024, tháng 1/2025, và các tháng/năm trước đó
      const isBeforeCurrentMonth = y < currentYear || (y === currentYear && m < currentMonth);
      if (isBeforeCurrentMonth) {
        // Chỉ tính các invoice CHƯA THANH TOÁN (status !== "paid")
        const status = data.status || "unpaid";
        if (status !== "paid") {
          const amt = data.finalAmount ?? data.totalAmount ?? 0;
          // Double-check: ensure this invoice month is strictly before current month
          // This is a safety check to prevent any edge cases
          if (y < currentYear || (y === currentYear && m < currentMonth)) {
            const mapKey = `${m}-${y}`;
            if (!debtMap[mapKey]) {
              debtMap[mapKey] = { month: m, year: y, amount: 0 };
            }
            debtMap[mapKey].amount += amt;
          }
        }
      }
    });

    // 1b) Also check processed invoices from studentInvoices (fallback if Firebase data is missing)
    // LƯU Ý: studentInvoices chỉ chứa invoice của tháng/năm được chọn (bị filter)
    // Nên phần này chỉ là fallback, chủ yếu dựa vào studentInvoiceStatus ở trên
    studentInvoices.forEach((invoice) => {
      if (invoice.studentId !== studentId) return;
      
      const m = invoice.month;
      const y = invoice.year;
      
      // Tính TẤT CẢ các tháng/năm TRƯỚC tháng hiện tại
      const isBeforeCurrentMonth = y < currentYear || (y === currentYear && m < currentMonth);
      if (!isBeforeCurrentMonth) return;
      
      // Check if already counted from studentInvoiceStatus
      const mapKey = `${m}-${y}`;
      if (debtMap[mapKey]) return; // Already counted
      
      // Chỉ tính các invoice CHƯA THANH TOÁN
      if (invoice.status !== "paid") {
        const amt = invoice.finalAmount ?? invoice.totalAmount ?? 0;
        if (amt > 0) {
          debtMap[mapKey] = { month: m, year: y, amount: amt };
        }
      }
    });

    // 2) Also check sessions that may not have persisted invoices
    // Tính các buổi học chưa có invoice (bổ sung cho trường hợp thiếu invoice)
    sessions.forEach((session) => {
      if (!session["Ngày"] || !session["Điểm danh"]) return;
      const sessionDate = new Date(session["Ngày"]);
      const sMonth = sessionDate.getMonth();
      const sYear = sessionDate.getFullYear();

      // Tính TẤT CẢ các tháng/năm TRƯỚC tháng hiện tại
      // IMPORTANT: currentMonth is 0-indexed (0=Jan, 11=Dec)
      // Ví dụ: Xem tháng 2/2025 → Tính các buổi học từ TẤT CẢ các tháng/năm trước
      const isBeforeCurrentMonth = sYear < currentYear || (sYear === currentYear && sMonth < currentMonth);
      if (!isBeforeCurrentMonth) return;

      // Check if student was present in this session
      const present = Array.isArray(session["Điểm danh"]) &&
        session["Điểm danh"].some(
          (r: any) => r["Student ID"] === studentId && r["Có mặt"]
        );
      if (!present) return;

      // Priority 1: Use student's hoc_phi_rieng for the specific subject if available
      const student = students.find((s) => s.id === studentId);
      const classId = session["Class ID"];
      const classInfo = classes.find((c) => c.id === classId);
      // Use per-class private tuition fee if available
      const hocPhiRieng = getHocPhiRieng(student, classId);
      
      let pricePerSession = 0;
      if (hocPhiRieng !== null) {
        pricePerSession = hocPhiRieng;
      } else {
        // Priority 2: Find class/course price
        if (classInfo) {
          const course = courses.find((c) => {
            if (c.Khối !== classInfo.Khối) return false;
            const classSubject = classInfo["Môn học"];
            const courseSubject = c["Môn học"];
            if (classSubject === courseSubject) return true;
            const subjectOption = subjectOptions.find(
              (opt) => opt.label === classSubject || opt.value === classSubject
            );
            if (subjectOption) {
              return (
                courseSubject === subjectOption.label ||
                courseSubject === subjectOption.value
              );
            }
            return false;
          });
          pricePerSession = classInfo?.["Học phí mỗi buổi"] || course?.Giá || 0;
        }
      }

      // Check if there's a persisted invoice for this month
      const persistedKey = `${studentId}-${sMonth}-${sYear}`;
      const persisted = studentInvoiceStatus[persistedKey];
      if (persisted) {
        // If invoice exists and is paid, skip (no debt)
        const persistedStatus = typeof persisted === "object" ? persisted.status : persisted;
        if (persistedStatus === "paid") {
          return; // Already paid, no debt
        }
        // If invoice exists but unpaid, skip to avoid double counting
        // Part 1 already counted the invoice amount
        return;
      }

      const mapKey = `${sMonth}-${sYear}`;
      // Double-check: ensure this session month is strictly before current month
      // This is a safety check to prevent any edge cases
      const isStrictlyBefore = sYear < currentYear || (sYear === currentYear && sMonth < currentMonth);
      if (!isStrictlyBefore) {
        // Skip this session - it's not before the current month
        return;
      }
      
      if (!debtMap[mapKey]) {
        debtMap[mapKey] = { month: sMonth, year: sYear, amount: 0 };
      }
      debtMap[mapKey].amount += pricePerSession;
    });

    // Final validation: filter out any items that are not strictly before current month/year
    // This is a safety check to prevent any edge cases
    const items = Object.values(debtMap)
      .filter((d) => {
        const isStrictlyBefore = d.year < currentYear || (d.year === currentYear && d.month < currentMonth);
        return d.amount > 0 && isStrictlyBefore;
      })
      .sort((a, b) => a.year - b.year || a.month - b.month);
    const total = items.reduce((sum, d) => sum + (d.amount || 0), 0);

    return { items, total };
  };

  // Calculate total accumulated debt for a student across all previous months
  const calculateStudentTotalDebt = (studentId: string, currentMonth: number, currentYear: number): number => {
    const { total, items } = getStudentDebtBreakdown(studentId, currentMonth, currentYear);
    
    // Debug log for specific student (Việt Anh)
    const student = students.find((s) => s.id === studentId);
    if (student && (student["Họ và tên"]?.includes("Việt Anh") || student["Tên học sinh"]?.includes("Việt Anh"))) {
      console.log(`[Debt Debug] ${student["Họ và tên"] || student["Tên học sinh"]} - Tháng ${currentMonth + 1}/${currentYear}:`, {
        totalDebt: total,
        debtItems: items,
        studentId,
        currentMonth,
        currentYear
      });
    }
    
    return total;
  };

  // Tra cứu nợ chi tiết cho một học sinh
  const lookupStudentDebt = (studentName: string, targetMonth: number, targetYear: number) => {
    // Tìm học sinh
    const student = students.find((s) => 
      s["Họ và tên"]?.includes(studentName) || 
      s["Tên học sinh"]?.includes(studentName) ||
      (s as any)?.name?.includes(studentName)
    );

    if (!student) {
      console.log(`❌ Không tìm thấy học sinh: ${studentName}`);
      message.error(`Không tìm thấy học sinh: ${studentName}`);
      return;
    }

    const studentId = student.id;
    const breakdown = getStudentDebtBreakdown(studentId, targetMonth, targetYear);
    
    // Tìm tất cả invoice của học sinh này trong Firebase
    const allInvoices: any[] = [];
    let savedDebtFromInvoice: number | null = null;
    
    Object.entries(studentInvoiceStatus).forEach(([key, data]) => {
      if (!data || typeof data === "string") return;
      if (data.studentId === studentId) {
        const invoiceData = {
          id: key,
          ...data,
          month: data.month ?? null,
          year: data.year ?? null,
        };
        allInvoices.push(invoiceData);
        
        // Kiểm tra xem có invoice của tháng đích có debt đã lưu không
        if (invoiceData.month === targetMonth && invoiceData.year === targetYear) {
          if (typeof data === "object" && data.debt !== undefined && data.debt !== null) {
            savedDebtFromInvoice = data.debt;
          }
        }
      }
    });

    // Lọc invoice trước tháng đích
    const previousInvoices = allInvoices.filter((inv) => {
      const m = inv.month;
      const y = inv.year;
      if (m === null || y === null) return false;
      return y < targetYear || (y === targetYear && m < targetMonth);
    });

    // Phân loại invoice
    const unpaidInvoices = previousInvoices.filter((inv) => inv.status !== "paid");
    const paidInvoices = previousInvoices.filter((inv) => inv.status === "paid");

    // Tổng hợp thông tin
    const totalUnpaid = unpaidInvoices.reduce((sum, inv) => {
      return sum + (inv.finalAmount ?? inv.totalAmount ?? 0);
    }, 0);

    // Tìm invoice của tháng đích
    const currentMonthInvoices = allInvoices.filter((inv) => {
      return inv.month === targetMonth && inv.year === targetYear;
    });

    const detailInfo = {
      studentName: student["Họ và tên"] || student["Tên học sinh"] || (student as any)?.name,
      studentId,
      targetMonth: targetMonth + 1, // Convert to 1-indexed for display
      targetYear,
      calculatedDebt: breakdown.total, // Nợ tính từ các tháng trước
      savedDebt: savedDebtFromInvoice, // Nợ đã lưu trong database
      totalDebt: savedDebtFromInvoice !== null ? savedDebtFromInvoice : breakdown.total, // Nợ hiển thị (giống logic trong bảng)
      debtBreakdown: breakdown.items,
      currentMonthInvoices: currentMonthInvoices.map((inv) => ({
        id: inv.id,
        month: (inv.month ?? 0) + 1,
        year: inv.year ?? 0,
        amount: inv.finalAmount ?? inv.totalAmount ?? 0,
        status: inv.status,
        debt: inv.debt,
      })),
      previousInvoices: {
        total: previousInvoices.length,
        unpaid: unpaidInvoices.length,
        paid: paidInvoices.length,
        unpaidList: unpaidInvoices.map((inv) => ({
          id: inv.id,
          month: (inv.month ?? 0) + 1,
          year: inv.year ?? 0,
          amount: inv.finalAmount ?? inv.totalAmount ?? 0,
          status: inv.status,
        })),
        paidList: paidInvoices.map((inv) => ({
          id: inv.id,
          month: (inv.month ?? 0) + 1,
          year: inv.year ?? 0,
          amount: inv.finalAmount ?? inv.totalAmount ?? 0,
          status: inv.status,
        })),
      },
      totalUnpaidAmount: totalUnpaid,
    };

    // Log chi tiết
    console.log("=".repeat(80));
    console.log(`📊 TRA CỨU NỢ - ${detailInfo.studentName}`);
    console.log(`📅 Tháng ${detailInfo.targetMonth}/${detailInfo.targetYear}`);
    console.log("=".repeat(80));
    console.log(`💰 NỢ TÍNH TOÁN (từ các tháng trước): ${detailInfo.calculatedDebt.toLocaleString("vi-VN")} đ`);
    console.log(`💰 NỢ ĐÃ LƯU (trong database): ${detailInfo.savedDebt !== null ? detailInfo.savedDebt.toLocaleString("vi-VN") + " đ" : "Không có"}`);
    console.log(`💰 TỔNG NỢ HIỂN THỊ (giống trong bảng): ${detailInfo.totalDebt.toLocaleString("vi-VN")} đ`);
    console.log(`\n📋 Chi tiết nợ theo tháng (từ các tháng TRƯỚC tháng ${detailInfo.targetMonth}/${detailInfo.targetYear}):`);
    if (detailInfo.debtBreakdown.length === 0) {
      console.log("   ✅ Không có nợ từ các tháng trước");
    } else {
      detailInfo.debtBreakdown.forEach((item) => {
        console.log(`   - Tháng ${item.month + 1}/${item.year}: ${item.amount.toLocaleString("vi-VN")} đ`);
      });
    }
    console.log(`\n📄 Invoice của tháng ${detailInfo.targetMonth}/${detailInfo.targetYear}:`);
    if (detailInfo.currentMonthInvoices.length === 0) {
      console.log("   (Không có invoice)");
    } else {
      detailInfo.currentMonthInvoices.forEach((inv) => {
        console.log(`   - Invoice ${inv.id}: ${inv.amount.toLocaleString("vi-VN")} đ, Status: ${inv.status}, Debt đã lưu: ${inv.debt !== undefined && inv.debt !== null ? inv.debt.toLocaleString("vi-VN") + " đ" : "Không có"}`);
      });
    }
    console.log(`\n📄 Invoice trước tháng ${detailInfo.targetMonth}/${detailInfo.targetYear}:`);
    console.log(`   - Tổng số: ${detailInfo.previousInvoices.total}`);
    console.log(`   - Chưa thanh toán: ${detailInfo.previousInvoices.unpaid}`);
    console.log(`   - Đã thanh toán: ${detailInfo.previousInvoices.paid}`);
    console.log(`\n💸 Danh sách invoice CHƯA THANH TOÁN:`);
    if (detailInfo.previousInvoices.unpaidList.length === 0) {
      console.log("   ✅ Không có");
    } else {
      detailInfo.previousInvoices.unpaidList.forEach((inv) => {
        console.log(`   - Invoice ${inv.id}: Tháng ${inv.month}/${inv.year} - ${inv.amount.toLocaleString("vi-VN")} đ`);
      });
    }
    console.log(`\n✅ Danh sách invoice ĐÃ THANH TOÁN:`);
    if (detailInfo.previousInvoices.paidList.length === 0) {
      console.log("   (Không có)");
    } else {
      detailInfo.previousInvoices.paidList.forEach((inv) => {
        console.log(`   - Invoice ${inv.id}: Tháng ${inv.month}/${inv.year} - ${inv.amount.toLocaleString("vi-VN")} đ`);
      });
    }
    console.log("=".repeat(80));

    // Hiển thị modal với thông tin chi tiết
    Modal.info({
      title: `Tra cứu nợ - ${detailInfo.studentName}`,
      width: 800,
      content: (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Tháng tra cứu: </Text>
            <Text>{detailInfo.targetMonth}/{detailInfo.targetYear}</Text>
          </div>
          <div style={{ marginBottom: 16, padding: 12, background: "#f0f0f0", borderRadius: 4 }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong style={{ fontSize: 16, color: detailInfo.totalDebt > 0 ? "#ff4d4f" : "#52c41a" }}>
                TỔNG NỢ HIỂN THỊ (giống trong bảng): {detailInfo.totalDebt.toLocaleString("vi-VN")} đ
              </Text>
            </div>
            <div style={{ marginTop: 8, fontSize: 14 }}>
              <Text type="secondary">- Nợ tính toán (từ các tháng trước): {detailInfo.calculatedDebt.toLocaleString("vi-VN")} đ</Text><br />
              <Text type="secondary">- Nợ đã lưu (trong database): {detailInfo.savedDebt !== null ? detailInfo.savedDebt.toLocaleString("vi-VN") + " đ" : "Không có"}</Text>
            </div>
          </div>
          
          {detailInfo.currentMonthInvoices.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>Invoice của tháng {detailInfo.targetMonth}/{detailInfo.targetYear}:</Text>
              <ul style={{ marginTop: 8 }}>
                {detailInfo.currentMonthInvoices.map((inv, idx) => (
                  <li key={idx}>
                    Invoice {inv.id}: <Text strong>{inv.amount.toLocaleString("vi-VN")} đ</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>(Status: {inv.status})</Text>
                    {inv.debt !== undefined && inv.debt !== null && (
                      <Text type="secondary" style={{ marginLeft: 8 }}>Debt đã lưu: {inv.debt.toLocaleString("vi-VN")} đ</Text>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div style={{ marginBottom: 16 }}>
            <Text strong>Chi tiết nợ theo tháng:</Text>
            {detailInfo.debtBreakdown.length === 0 ? (
              <div style={{ marginTop: 8, color: "#52c41a" }}>✅ Không có nợ</div>
            ) : (
              <ul style={{ marginTop: 8 }}>
                {detailInfo.debtBreakdown.map((item, idx) => (
                  <li key={idx}>
                    Tháng {item.month + 1}/{item.year}: <Text strong>{item.amount.toLocaleString("vi-VN")} đ</Text>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>Thống kê invoice trước tháng {detailInfo.targetMonth}/{detailInfo.targetYear}:</Text>
            <div style={{ marginTop: 8 }}>
              <Text>- Tổng số: {detailInfo.previousInvoices.total}</Text><br />
              <Text>- Chưa thanh toán: <Text strong style={{ color: "#ff4d4f" }}>{detailInfo.previousInvoices.unpaid}</Text></Text><br />
              <Text>- Đã thanh toán: <Text strong style={{ color: "#52c41a" }}>{detailInfo.previousInvoices.paid}</Text></Text>
            </div>
          </div>

          {detailInfo.previousInvoices.unpaidList.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ color: "#ff4d4f" }}>Danh sách invoice CHƯA THANH TOÁN:</Text>
              <ul style={{ marginTop: 8 }}>
                {detailInfo.previousInvoices.unpaidList.map((inv, idx) => (
                  <li key={idx}>
                    Tháng {inv.month}/{inv.year}: <Text strong>{inv.amount.toLocaleString("vi-VN")} đ</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>(ID: {inv.id})</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ),
    });

    return detailInfo;
  };

  // Generate VietQR URL with hardcoded bank info for students
  const generateVietQR = (
    amount: string,
    studentName: string,
    month: string
  ): string => {
    const bankId = "VPB"; // VPBank
    const accountNo = "4319888";
    const accountName = "NGUYEN THI HOA";
    const numericAmount = amount.replace(/[^0-9]/g, "");
    const description = `HP T${month} ${studentName}`;
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${numericAmount}&addInfo=${encodeURIComponent(
      description
    )}&accountName=${encodeURIComponent(accountName)}`;
  };

  // Generate VietQR URL for teacher salary payment
  const generateTeacherVietQR = (
    amount: number,
    teacherName: string,
    month: number,
    bankName: string,
    accountNo: string,
    accountName: string
  ): string => {
    // Extract bank code from bank name (simple mapping)
    const bankCodeMap: Record<string, string> = {
      VPBank: "VPB",
      Vietcombank: "VCB",
      Techcombank: "TCB",
      BIDV: "BIDV",
      Agribank: "ABB",
      VietinBank: "CTG",
      MBBank: "MB",
      ACB: "ACB",
      Sacombank: "STB",
      VIB: "VIB",
    };

    const bankId = bankCodeMap[bankName] || "VCB"; // Default to VCB if not found
    const numericAmount = amount.toString().replace(/[^0-9]/g, "");
    const description = `Luong T${month + 1} ${teacherName}`;

    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${numericAmount}&addInfo=${encodeURIComponent(
      description
    )}&accountName=${encodeURIComponent(accountName)}`;
  };

  const generateStudentInvoiceHTML = (invoice: StudentInvoice, includeQR: boolean = true) => {
    // Helper to generate decor border HTML
    const generateDecorIcons = () => {
      let html = "";
      const schoolIcons = [
        "fa-book",
        "fa-book-open",
        "fa-ruler-horizontal",
        "fa-pencil-alt",
        "fa-drafting-compass",
        "fa-briefcase",
        "fa-chalkboard",
        "fa-calculator",
        "fa-eraser",
        "fa-pen-nib",
        "fa-graduation-cap",
      ];
      const grayColors = ["c-gray-1", "c-gray-2", "c-gray-3", "c-gray-4"];
      const countH = 9;
      const countV = 12;

      const createIcon = (style: string) => {
        const iconClass =
          schoolIcons[Math.floor(Math.random() * schoolIcons.length)];
        const colorClass =
          grayColors[Math.floor(Math.random() * grayColors.length)];
        const rot = Math.random() * 60 - 30;
        return `<i class="fas ${iconClass} decor-icon ${colorClass}" style="${style}; transform: rotate(${rot}deg);"></i>`;
      };

      for (let i = 0; i < countH; i++)
        html += createIcon(`top: 5px; left: ${(i / countH) * 100 + 4}%`);
      for (let i = 0; i < countH; i++)
        html += createIcon(`bottom: 5px; left: ${(i / countH) * 100 + 4}%`);
      for (let i = 0; i < countV; i++)
        html += createIcon(`left: 5px; top: ${(i / countV) * 100 + 4}%`);
      for (let i = 0; i < countV; i++)
        html += createIcon(`right: 5px; top: ${(i / countV) * 100 + 4}%`);

      return html;
    };

    // Group sessions by class and calculate totals
    const classSummary: Record<
      string,
      {
        className: string;
        classCode: string;
        subject: string;
        sessionCount: number;
        pricePerSession: number;
        totalPrice: number;
      }
    > = {};

    // Process each session and group by subject, using getUnitPrice() to match table calculation
    invoice.sessions.forEach((session) => {
      const className = session["Tên lớp"] || "";
      const classCode = session["Mã lớp"] || "";
      const classId = session["Class ID"];
      const classInfo = classes.find((c) => c.id === classId);
      const subject = classInfo?.["Môn học"] || "N/A";

      const key = `${classCode}-${className}-${subject}`;

      if (!classSummary[key]) {
        // Use getUnitPrice() to match table calculation
        // Priority: hoc_phi_rieng > pricePerSession from invoice > from class/course
        const pricePerSession = getUnitPrice(
          invoice.studentId,
          subject,
          classId,
          invoice.pricePerSession
        );
        
        classSummary[key] = {
          className,
          classCode,
          subject,
          sessionCount: 0,
          pricePerSession: pricePerSession,
          totalPrice: 0,
        };
      }

      classSummary[key].sessionCount++;
      // Recalculate totalPrice using unitPrice × sessionCount to match table calculation
      classSummary[key].totalPrice =
        classSummary[key].pricePerSession * classSummary[key].sessionCount;
    });

    const classRows = Object.values(classSummary);

    // Compute a compact subjects list and attempt to determine the student's grade (Khối)
    const subjects = Array.from(new Set(classRows.map((r) => r.subject))).join(
      ", "
    );
    const subjectDisplay =
      subjectMap[subjects] ||
      subjects
        .split(",")
        .map((item) => subjectMap[item.trim()] || item.trim())
        .join(", ");
    const firstSession =
      invoice.sessions && invoice.sessions.length > 0
        ? invoice.sessions[0]
        : null;
    const firstClassId = firstSession ? firstSession["Class ID"] : null;
    const firstClassInfo = classes.find((c) => c.id === firstClassId);
    const grade = firstClassInfo?.["Khối"] || "";

    // Check if this invoice has a saved debt value in database
    // Priority: invoice.debt (if provided) > studentInvoiceStatus > calculated debt
    let savedDebt: number | null = null;
    
    // First, check if invoice.debt is explicitly provided (e.g., from edit modal)
    if (invoice.debt !== undefined && invoice.debt !== null) {
      savedDebt = invoice.debt;
    } else {
      // Otherwise, check database
      const invoiceData = studentInvoiceStatus[invoice.id];
      savedDebt = typeof invoiceData === "object" && invoiceData.debt !== undefined
        ? invoiceData.debt
        : null;
    }

    // Calculate previous unpaid months (debt) for this student across ALL months
    // Only calculate if no saved debt exists
    const debtMap: Record<
      string,
      { month: number; year: number; amount: number }
    > = {};
    
    let totalDebt = 0;
    let debtDetails: { month: number; year: number; amount: number }[] = [];

    if (savedDebt !== null) {
      // Use saved debt value from database or invoice.debt
      totalDebt = savedDebt;
      // Create a single entry for display if there's debt
      if (savedDebt > 0) {
        debtDetails = [{
          month: invoice.month - 1 >= 0 ? invoice.month - 1 : 11,
          year: invoice.month - 1 >= 0 ? invoice.year : invoice.year - 1,
          amount: savedDebt
        }];
      }
    } else {
      // Calculate debt from previous months using shared breakdown helper
      const breakdown = getStudentDebtBreakdown(invoice.studentId, invoice.month, invoice.year);
      debtDetails = breakdown.items;
      totalDebt = breakdown.total;
    } // End of else block (no saved debt)

    // Build debt summary for display in receipt (simplified version)
    const debtSummary = debtDetails.length > 0
      ? `Nợ lũy kế ${debtDetails.length} tháng: ${totalDebt.toLocaleString("vi-VN")} đ`
      : "Không có nợ cũ";

    const debtDetail1 = debtDetails.length > 0
      ? `Nợ các tháng: ${debtDetails.map(d => `T${d.month + 1}/${d.year}`).join(", ")}`
      : "";

    const debtDetail2 = debtDetails.length > 0
      ? `Tổng nợ lũy kế: ${totalDebt.toLocaleString("vi-VN")} đ`
      : "";

    // Build debt details table (per unpaid month) with totals
    const debtDetailsHtml =
      debtDetails.length > 0
        ? `
      <div style="margin:14px 0;">
        <strong style="color:#1a3353; font-size:15px;">Chi tiết nợ:</strong>
        <table style="width:100%; border-collapse: collapse; margin-top:8px; font-size:14px; border:1px solid #d9d9d9;">
          <thead>
            <tr style="background:#1a3353; color:#ffffff;">
              <th style="text-align:left; padding:10px 12px; border:1px solid #d9d9d9; font-weight:600;">Tháng</th>
              <th style="text-align:right; padding:10px 12px; border:1px solid #d9d9d9; font-weight:600;">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            ${debtDetails
          .map(
            (d, idx) => `
              <tr style="background:${idx % 2 === 0 ? '#f0f5ff' : '#ffffff'};">
                <td style="padding:10px 12px; border:1px solid #e8e8e8;">Tháng ${d.month + 1}/${d.year}</td>
                <td style="padding:10px 12px; text-align:right; border:1px solid #e8e8e8; color:#c40000; font-weight:600;">${d.amount.toLocaleString("vi-VN")} đ</td>
              </tr>`
          )
          .join("")}
            <tr style="font-weight:700; background:#fff1f0; border-top:2px solid #c40000;">
              <td style="padding:12px; border:1px solid #e8e8e8; color:#c40000;">Tổng nợ lũy kế</td>
              <td style="padding:12px; text-align:right; border:1px solid #e8e8e8; color:#c40000; font-size:16px;">${totalDebt.toLocaleString("vi-VN")} đ</td>
            </tr>
          </tbody>
        </table>
      </div>`
        : `<p style="margin:14px 0;"><strong style="color:#1a3353; font-size:15px;">Chi tiết nợ:</strong> <span style="color:#666;">Không có nợ cũ</span></p>`;
    // Build current month breakdown HTML (classes and totals)
    const currentMonthRows = classRows.map((r) => ({
      subject: r.subject,
      className: r.className,
      sessions: r.sessionCount,
      pricePerSession: r.pricePerSession,
      totalPrice: r.totalPrice,
    }));

    const currentMonthTotal =
      currentMonthRows.reduce((s, r) => s + (r.totalPrice || 0), 0) ||
      invoice.totalAmount ||
      0;

    const discountAmount = invoice.discount || 0;
    const discountPercent = currentMonthTotal > 0 ? (discountAmount / currentMonthTotal) * 100 : 0;
    const discountLabel = discountAmount > 0
      ? `- ${discountAmount.toLocaleString("vi-VN")} đ${discountPercent > 0 ? ` (${discountPercent.toFixed(1)}%)` : ""}`
      : "";
    const netCurrentMonth = Math.max(0, currentMonthTotal - discountAmount);

    const currentMonthHtml =
      currentMonthRows.length > 0
        ? `
      <div style="margin:14px 0;">
        <strong style="color:#1a3353; font-size:15px;">Chi tiết tháng ${invoice.month + 1}:</strong>
        <table style="width:100%; border-collapse: collapse; margin-top:8px; font-size:14px; border:1px solid #d9d9d9;">
          <thead>
            <tr style="background:#1a3353; color:#ffffff;">
              <th style="text-align:left; padding:10px 12px; border:1px solid #d9d9d9; font-weight:600;">Môn học</th>
              <th style="text-align:left; padding:10px 12px; border:1px solid #d9d9d9; font-weight:600;">Lớp</th>
              <th style="text-align:center; padding:10px 12px; border:1px solid #d9d9d9; font-weight:600;">Số buổi</th>
              <th style="text-align:right; padding:10px 12px; border:1px solid #d9d9d9; font-weight:600;">Giá/buổi</th>
              <th style="text-align:right; padding:10px 12px; border:1px solid #d9d9d9; font-weight:600;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${currentMonthRows
          .map(
            (r, idx) => `
              <tr style="background:${idx % 2 === 0 ? '#f0f5ff' : '#ffffff'};">
                <td style="padding:10px 12px; border:1px solid #e8e8e8;">${subjectMap[r.subject] || r.subject}</td>
                <td style="padding:10px 12px; border:1px solid #e8e8e8;">${r.className}</td>
                <td style="padding:10px 12px; text-align:center; border:1px solid #e8e8e8; font-weight:600;">${r.sessions}</td>
                <td style="padding:10px 12px; text-align:right; border:1px solid #e8e8e8;">${r.pricePerSession.toLocaleString("vi-VN")} đ</td>
                <td style="padding:10px 12px; text-align:right; border:1px solid #e8e8e8; font-weight:600; color:#1890ff;">${r.totalPrice.toLocaleString("vi-VN")} đ</td>
              </tr>`
          )
          .join("")}
          </tbody>
        </table>
        ${discountAmount > 0
          ? `
        <div style="margin-top:8px; padding:10px 12px; background:#e6f7ff; border-radius:4px; border:1px solid #91d5ff;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#003a8c; font-size:14px; font-weight:600;">Miễn giảm học phí</span>
            <span style="color:#003a8c; font-size:15px; font-weight:700;">${discountLabel}</span>
          </div>
        </div>`
          : ""
        }
      </div>`
        : `<p style="margin:14px 0;"><strong style="color:#1a3353; font-size:15px;">Chi tiết tháng ${invoice.month + 1}:</strong> <span style="color:#666;">Không có buổi học</span></p>`;

    const combinedTotalDue = totalDebt + netCurrentMonth;

    // Get subject icons mapping
    const getSubjectIcon = (subject: string) => {
      const lowerSubject = subject.toLowerCase();
      if (lowerSubject.includes("toán") || lowerSubject.includes("math")) return "fa-calculator";
      if (lowerSubject.includes("văn") || lowerSubject.includes("literature")) return "fa-pen-nib";
      if (lowerSubject.includes("anh") || lowerSubject.includes("english")) return "fa-language";
      if (lowerSubject.includes("khoa") || lowerSubject.includes("science")) return "fa-flask";
      if (lowerSubject.includes("thuyết trình") || lowerSubject.includes("presentation")) return "fa-user-tie";
      if (lowerSubject.includes("kỹ năng") || lowerSubject.includes("skill")) return "fa-gear";
      return "fa-book";
    };

    // Prepare subjects array for table
    const subjectsForTable = currentMonthRows.map((r) => ({
      subject: r.subject,
      className: r.className || "Lớp",
      sessions: r.sessions,
      pricePerSession: r.pricePerSession,
      total: r.totalPrice,
    }));

    // Get bank info
    const bankId = "VPB";
    const accountNo = "4319888";
    const accountName = "NGUYEN THI HOA";

    const qrUrl = generateVietQR(
      combinedTotalDue.toString(),
      invoice.studentName,
      (invoice.month + 1).toString()
    );

    const decorIconsHtml = generateDecorIcons();
    const logoUrl =
      "https://www.appsheet.com/template/gettablefileurl?appName=Appsheet-325045268&tableName=Kho%20%E1%BA%A3nh&fileName=Kho%20%E1%BA%A3nh_Images%2F323065b6.%E1%BA%A2nh.115930.png";
    const watermarkUrl =
      "https://www.appsheet.com/template/gettablefileurl?appName=Appsheet-325045268&tableName=Kho%20%E1%BA%A3nh&fileName=Kho%20%E1%BA%A3nh_Images%2F5efd9944.%E1%BA%A2nh.120320.png";

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Phiếu Thu A5</title>
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
          <style>
              /* --- CẤU HÌNH MÀU SẮC --- */
              :root {
                  --primary-navy: #003366;
                  --accent-yellow: #FFD700;
                  --accent-red: #D32F2F;
                  --accent-orange: #d35400;
                  --border-color: #ced6e0;
                  --page-width: 148mm;
                  --page-height: 210mm;
                  
                  /* Palette Xám Nhạt cho Viền */
                  --gray-1: #bdc3c7; --gray-2: #cfd8dc; --gray-3: #b0bec5; --gray-4: #90a4ae;
              }
      
              .invoice-body {
                  background-color: #333; font-family: 'Montserrat', sans-serif;
                  margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 30px;
                  -webkit-print-color-adjust: exact;
              }
      
              /* --- TRANG GIẤY A5 --- */
              .page {
                  width: var(--page-width); min-height: var(--page-height);
                  background: white; position: relative; overflow: hidden; box-sizing: border-box;
                  display: flex; flex-direction: column; 
                  padding: 12px; /* Giảm lề để vừa khít A5 */
                  box-shadow: none;
                  margin: 0;
              }
      
              /* --- VIỀN DECOR --- */
              .school-border-layer {
                  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                  pointer-events: none; z-index: 1; overflow: hidden;
              }
              .decor-icon {
                  position: absolute; display: flex; align-items: center; justify-content: center;
                  font-size: 22px; opacity: 0.4; filter: drop-shadow(1px 1px 0px white);
              }
              .c-gray-1 { color: var(--gray-1); } .c-gray-2 { color: var(--gray-2); }
              .c-gray-3 { color: var(--gray-3); } .c-gray-4 { color: var(--gray-4); }
              /* --- WATERMARK --- */
              .watermark-layer {
                  position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%);
                  width: 80%; opacity: 0.12; z-index: 0; pointer-events: none;
                  display: flex; justify-content: center; align-items: center;
              }
              .watermark-img { width: 100%; height: auto; object-fit: contain; }
      
              /* --- HEADER --- */
              .header {
                  background-color: var(--primary-navy); color: white; padding: 12px 15px;
                  position: relative; z-index: 2; border-bottom: 4px solid var(--accent-yellow);
                  display: flex; align-items: center; gap: 15px;
                  border-radius: 8px 8px 0 0; margin-bottom: 10px;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
              }
              .header-left { display: flex; flex-direction: column; gap: 2px; }
              .brand-name { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
              .doc-title { font-size: 18px; font-weight: 700; margin-top: 4px; color: var(--accent-yellow); }
              .sub-title { font-size: 10px; opacity: 0.9; font-style: italic; }
      
              .logo-container {
                  width: 65px; height: 65px; background: white; border-radius: 50%;
                  border: 3px solid var(--accent-yellow);
                  display: flex; align-items: center; justify-content: center;
                  overflow: hidden; cursor: pointer; position: relative; z-index: 10;
                  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
              }
              .logo-img { width: 100%; height: 100%; object-fit: contain; }
      
              /* --- CONTENT --- */
              .content { padding: 0; position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column;}
      
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
              .info-box {
                  background: #fff; border: 1px solid #ced6e0; border-radius: 8px;
                  padding: 8px 12px; position: relative; box-shadow: 0 2px 5px rgba(0,0,0,0.03);
              }
              .info-box::before {
                  content: ''; position: absolute; top: 10px; bottom: 10px; left: 0;
                  width: 3px; background: var(--primary-navy); border-radius: 0 4px 4px 0;
              }
              .box-title {
                  font-size: 11px; font-weight: 700; color: var(--primary-navy);
                  text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;
              }
              .info-row {
                  display: flex; justify-content: space-between; margin-bottom: 4px;
                  font-size: 10px; border-bottom: 1px dashed #eee; padding-bottom: 2px;
              }
              .info-label { color: #666; font-weight: 500; }
              .info-val { font-weight: 600; color: #333; text-align: right; }
      
              /* --- BẢNG --- */
              .table-container { margin-bottom: ${includeQR ? '10px' : '5px'}; border-radius: 8px; overflow: hidden; border: 1px solid var(--primary-navy); }
              table { width: 100%; border-collapse: collapse; font-size: 10px; }
              thead { background-color: var(--primary-navy); color: white; }
              th { padding: 8px 5px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 9px; border-right: 1px solid rgba(255,255,255,0.2); }
              th:last-child { border-right: none; }
              td { padding: 6px 5px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); color: #000 !important; font-weight: 500 !important; vertical-align: middle; }
              td:last-child { border-right: none; }
              tr:last-child td { border-bottom: none; }
              tr:nth-child(even) { background-color: #f9f9f9; }
              .row-icon { color: var(--primary-navy); margin-right: 3px; opacity: 0.7; font-size: 10px; }
              .text-right { text-align: right; } .text-center { text-align: center; }
              .text-red { color: var(--accent-red) !important; font-weight: 600 !important; }
              .text-orange { color: #d35400 !important; font-weight: 600 !important; }
              .total-row-highlight { font-size: 12px; font-weight: 700 !important; color: var(--accent-red) !important; text-transform: uppercase; }
      
              /* --- FOOTER --- */
              .bottom-layout { display: flex; gap: 15px; margin-top: auto; padding-bottom: 0px; align-items: flex-start; }
              
              .debt-container { flex: 1; background: white; border: 1px solid var(--primary-navy); border-radius: 8px; overflow: hidden; }
              .debt-header { background: var(--primary-navy); color: white; padding: 5px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; display: flex; align-items: center; gap: 5px; }
              .debt-table { width: 100%; font-size: 9px; border-collapse: collapse; }
              .debt-table th { background: #f0f4f8; color: var(--primary-navy); padding: 5px; border-bottom: 1px solid #ddd; border-right: 1px solid #eee; text-align: center; font-weight: 600; }
              .debt-table td { padding: 5px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; text-align: center; color: #333; font-weight: 500; }
              
              .payment-column { width: 150px; display: flex; flex-direction: column; gap: 10px; }
              .grand-total-box { background: var(--primary-navy); color: white; padding: 10px; border-radius: 8px; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
              .grand-total-label { font-size: 9px; text-transform: uppercase; opacity: 0.9; margin-bottom: 2px; line-height: 1.2; }
              .grand-total-val { font-size: 18px; font-weight: 700; color: var(--accent-yellow); line-height: 1.1; }
      
              .qr-block-stack { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 5px; text-align: center; }
              .qr-placeholder-stack { width: 100%; aspect-ratio: 1/1; background: white; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; overflow: hidden; margin-bottom: 5px; }
              .qr-img { width: 100%; height: 100%; object-fit: cover; }
              .qr-note { font-size: 9px; color: #555; line-height: 1.3; font-weight: 500; word-break: break-word; }
              [contenteditable]:hover { background: rgba(255, 215, 0, 0.1); outline: none; border-radius: 2px;}
              [contenteditable]:focus { background: #fff; outline: 1px solid var(--primary-navy); }

              /* --- PRINT A5 SIZE --- */
              @page {
                  size: A5 portrait;
                  margin: 5mm;
              }

              @media print {
                  .invoice-body { background: white; padding: 0; gap: 0; display: block; }
                  .toolbar { display: none !important; }
                  .page { box-shadow: none; width: 100%; height: auto; min-height: auto; margin: 0; border: none; padding: 8px; page-break-inside: avoid; }
                  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              }
          </style>
          <script>
              // Auto-save functionality for contenteditable fields
              let saveTimeout;
              let invoiceData = ${JSON.stringify({
      id: invoice.id,
      studentId: invoice.studentId,
      studentName: invoice.studentName,
      studentCode: invoice.studentCode,
      month: invoice.month,
      year: invoice.year,
      totalSessions: invoice.totalSessions,
      totalAmount: invoice.totalAmount,
      discount: invoice.discount,
      finalAmount: invoice.finalAmount
    })};

              function saveInvoiceData() {
                console.log('Saving invoice data...', invoiceData);
                // Show saving indicator
                showSaveIndicator('Đang lưu...');
                
                // Trigger parent window to save data
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({
                    type: 'SAVE_INVOICE_DATA',
                    data: invoiceData
                  }, '*');
                }
              }

              function showSaveIndicator(text) {
                let indicator = document.getElementById('save-indicator');
                if (!indicator) {
                  indicator = document.createElement('div');
                  indicator.id = 'save-indicator';
                  indicator.style.cssText = \`
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: #52c41a;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-size: 12px;
                    z-index: 9999;
                    transition: all 0.3s;
                  \`;
                  document.body.appendChild(indicator);
                }
                indicator.textContent = text;
                indicator.style.display = 'block';
                
                setTimeout(() => {
                  if (text === 'Đang lưu...') {
                    indicator.textContent = '✓ Đã lưu';
                    indicator.style.background = '#52c41a';
                  }
                  setTimeout(() => {
                    indicator.style.opacity = '0';
                    setTimeout(() => {
                      indicator.style.display = 'none';
                      indicator.style.opacity = '1';
                    }, 300);
                  }, 1000);
                }, 500);
              }

              function debounceSubmit() {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                  saveInvoiceData();
                }, 1000); // Save after 1 second of no changes
              }

              document.addEventListener('DOMContentLoaded', function() {
                // Add event listeners to all contenteditable fields
                const editableFields = document.querySelectorAll('[contenteditable="true"]');
                
                editableFields.forEach(field => {
                  field.addEventListener('input', function(e) {
                    const target = e.target;
                    const text = target.textContent.trim();
                    
                    // Visual feedback for editing
                    target.style.background = 'rgba(255, 215, 0, 0.2)';
                    target.style.transition = 'background 0.3s';
                    
                    // Update invoice data based on field type
                    if (target.closest('.info-val') && target.closest('.info-row')) {
                      const label = target.closest('.info-row').querySelector('.info-label').textContent;
                      if (label.includes('Họ tên')) {
                        invoiceData.studentName = text;
                      } else if (label.includes('Mã HS')) {
                        invoiceData.studentCode = text;
                      }
                    }
                    
                    debounceSubmit();
                  });

                  // Show save indicator and tooltip
                  field.addEventListener('focus', function(e) {
                    e.target.title = 'Chỉnh sửa trực tiếp - tự động lưu sau 1 giây';
                    e.target.style.background = 'rgba(24, 144, 255, 0.1)';
                  });

                  field.addEventListener('blur', function(e) {
                    e.target.style.background = '';
                  });
                });

                // Edit hint removed per UX request
              });
          </script>
          </style>
      </head>
      <body>
          <!-- TRANG A5 -->
          <div class="invoice-body">
              <div class="page" id="page-final">
                  <!-- Viền Decor (Gray) -->
                  <div class="school-border-layer" id="border-layer">
                      ${decorIconsHtml}
                  </div>
      
                  <!-- Watermark (Có Sẵn Logo) -->
                  <div class="watermark-layer">
                      <img class="watermark-img" src="${watermarkUrl}">
                  </div>
      
                  <!-- Header -->
                  <div class="header">
                      <!-- Logo Container (Có Sẵn Logo) - Moved to Left -->
                      <div class="logo-container">
                          <img class="logo-img" src="${logoUrl}">
                      </div>
                      <div class="header-left">
                          <div class="brand-name">TRUNG TÂM PHÁT TRIỂN TƯ DUY - TRÍ TUỆ 8+</div>
                          <div class="doc-title">PHIẾU THU HỌC PHÍ</div>
                          <div class="sub-title" contenteditable="true">Tháng ${invoice.month + 1
      } / ${invoice.year}</div>
                      </div>
                  </div>
      
                  <div class="content">
                      <div class="info-grid">
                          <div class="info-box">
                              <div class="box-title"><i class="fas fa-user-graduate"></i> Học sinh</div>
                              <div class="info-row"><span class="info-label">Họ tên:</span><span class="info-val" contenteditable="true">${invoice.studentName
      }</span></div>
                              <div class="info-row"><span class="info-label">Lớp:</span><span class="info-val" contenteditable="true">${grade}</span></div>
                              <div class="info-row"><span class="info-label">Mã HS:</span><span class="info-val" contenteditable="true">${invoice.studentCode || "..."
      }</span></div>
                          </div>
                          ${includeQR ? `<div class="info-box">
                              <div class="box-title"><i class="fas fa-credit-card"></i> Thanh toán</div>
                              <div class="info-row"><span class="info-label">Người nhận:</span><span class="info-val">${accountName}</span></div>
                              <div class="info-row"><span class="info-label">NH:</span><span class="info-val" contenteditable="true">${bankId}</span></div>
                              <div class="info-row"><span class="info-label">STK:</span><span class="info-val" contenteditable="true">${accountNo}</span></div>
                          </div>` : `<div class="info-box">
                              <div class="box-title"><i class="fas fa-bell"></i> Ghi chú</div>
                              <div style="padding: 10px; color: #000; font-size: 13px; line-height: 1.6;">
                                  Phụ huynh vui lòng để học phí trong phong bì dán kín. Học sinh nộp tận tay cho bộ phận trực hoặc Thầy/Cô giáo tại lớp.
                              </div>
                          </div>`}
                      </div>
      
                      <div class="table-container">
                          <table>
                              <thead>
                                  <tr>
                                      <th style="width: 35%;">Môn học</th>
                                      <th class="text-center" style="width: 15%;">Lớp</th>
                                      <th class="text-center" style="width: 12%;">Buổi</th>
                                      <th class="text-right" style="width: 18%;">Đơn giá</th>
                                      <th class="text-right" style="width: 20%;">Thành tiền</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  ${subjectsForTable
        .map(
          (item) => `
                                  <tr>
                                      <td><i class="fas ${getSubjectIcon(
            item.subject
          )} row-icon"></i> <span contenteditable="true">${subjectMap[item.subject] || item.subject
            }</span></td>
                                      <td class="text-center" contenteditable="true">${item.className
            }</td>
                                      <td class="text-center" contenteditable="true">${item.sessions
            }</td>
                                      <td class="text-right" contenteditable="true">${item.pricePerSession.toLocaleString(
              "vi-VN"
            )}</td>
                                      <td class="text-right" contenteditable="true">${item.total.toLocaleString(
              "vi-VN"
            )}</td>
                                  </tr>
                                  `
        )
        .join("")}
                                  
                                  ${discountAmount > 0
        ? `
                                  <tr style="background-color: #fff0f0;">
                                      <td colspan="4" class="text-right text-red"><i>Miễn giảm:</i></td>
                                      <td class="text-right text-red" contenteditable="true">${discountLabel}</td>
                                  </tr>
                                  `
        : ""
      }
                                  <tr style="background-color: #e8f0fe;">
                                      <td colspan="4" class="text-right total-row-highlight">TỔNG THÁNG NÀY:</td>
                                      <td class="text-right total-row-highlight" contenteditable="true">${currentMonthTotal.toLocaleString(
        "vi-VN"
      )} đ</td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>
      
                      <div class="bottom-layout">
                          <div class="debt-container">
                              <div class="debt-header"><i class="fas fa-clipboard-list"></i> NỢ LŨY KẾ CÁC THÁNG TRƯỚC</div>
                              <table class="debt-table">
                                  <thead><tr><th style="width:40%">Tháng</th><th>Số tiền</th></tr></thead>
                                  <tbody>
                                      ${debtDetails.length > 0
        ? debtDetails
          .map(
            (d) => `
                                          <tr>
                                              <td contenteditable="true">T${d.month + 1
              }/${d.year}</td>
                                              <td contenteditable="true">${d.amount.toLocaleString(
                "vi-VN"
              )} đ</td>
                                          </tr>
                                      `
          )
          .join("")
        : `<tr><td colspan="2" class="text-center" style="color: #999;">Không có nợ</td></tr>`
      }
                                      ${debtDetails.length > 0
        ? `
                                      <tr style="font-weight: bold; background: #fff8e1;">
                                          <td class="text-center">TỔNG NỢ LŨY KẾ</td>
                                          <td>${totalDebt.toLocaleString(
          "vi-VN"
        )} đ</td>
                                      </tr>
                                      `
        : ""
      }
                                  </tbody>
                              </table>
                          </div>
                              <div class="payment-column">
                              <div class="grand-total-box">
                                  <div class="grand-total-label">TỔNG PHẢI THU (NỢ CŨ + THÁNG NÀY)</div>
                                  <div class="grand-total-val" contenteditable="true">${combinedTotalDue.toLocaleString(
        "vi-VN"
      )} đ</div>
                              </div>
                              ${includeQR ? `
                              <div class="qr-block-stack">
                                  <div class="qr-placeholder-stack">
                                      <img class="qr-img" src="${qrUrl}" style="display:block;">
                                  </div>
                                  <div class="qr-note" contenteditable="true">${invoice.studentName
        } - ${grade} - T${invoice.month + 1}${totalDebt > 0 ? ` (có nợ ${debtDetails.length} tháng)` : ""}</div>
                              </div>
                              ` : ''}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </body>
      </html>
    `;
  };

  const generateTeacherSalaryHTML = (salary: TeacherSalary) => {
    const teacher = teachers.find((t) => t.id === salary.teacherId);

    const parseCurrency = (value: unknown) => {
      if (value === undefined || value === null) return 0;
      const num = Number(String(value).replace(/[^0-9.-]+/g, ""));
      return Number.isFinite(num) ? num : 0;
    };

    // Group sessions by class
    const classSummary: Record<
      string,
      {
        classId: string;
        className: string;
        classCode: string;
        subject: string;
        sessionCount: number;
        salaryPerSession: number;
        totalSalary: number;
        totalAllowance: number;
      }
    > = {};

    // Get saved session salaries from database if available
    const savedData = teacherSalaryStatus[salary.id];
    const savedSessionSalaries = (typeof savedData === "object" && savedData?.sessionSalaries)
      ? savedData.sessionSalaries
      : {};

    salary.sessions.forEach((session) => {
      const classId = session["Class ID"];
      const className = session["Tên lớp"] || "";
      const classCode = session["Mã lớp"] || "";

      // Find class info to get subject and salary per session
      const classInfo = classes.find((c) => c.id === classId);
      const subject = classInfo?.["Môn học"] || "";

      if (!classSummary[classId]) {
        classSummary[classId] = {
          classId,
          className,
          classCode,
          subject,
          sessionCount: 0,
          salaryPerSession: 0,
          totalSalary: 0,
          totalAllowance: 0,
        };
      }

      // Priority: saved sessionSalaries > session Lương/buổi > session Lương GV > class Lương GV > teacher Lương theo buổi
      let salaryPerSession = 0;
      if (savedSessionSalaries[session.id] !== undefined) {
        salaryPerSession = savedSessionSalaries[session.id];
      } else if (getSafeField(session, "Lương/buổi")) {
        salaryPerSession = Number(getSafeField(session, "Lương/buổi"));
      } else {
        salaryPerSession =
          parseCurrency(session["Lương GV"]) ||          // 1. Từ Session (ưu tiên)
          parseCurrency(classInfo?.["Lương GV"]) ||     // 2. Từ Lớp học (fallback)
          parseCurrency(teacher?.["Lương theo buổi"]);  // 3. Từ Giáo viên (fallback cuối)
      }

      const allowancePerSession = parseCurrency(session["Phụ cấp di chuyển"]);

      // Update salaryPerSession on first session of class
      if (classSummary[classId].sessionCount === 0) {
        classSummary[classId].salaryPerSession = salaryPerSession;
      }

      classSummary[classId].sessionCount++;
      classSummary[classId].totalSalary += salaryPerSession;
      classSummary[classId].totalAllowance += allowancePerSession;
    });

    const classData = Object.values(classSummary).sort((a, b) =>
      a.className.localeCompare(b.className)
    );

    const totalSessions = salary.totalSessions || salary.sessions?.length || 0;
    const totalAllowanceAll = classData.reduce((sum, item) => sum + item.totalAllowance, 0);

    // Build a compact table similar to the provided image
    const subjects = Array.from(
      new Set(
        salary.sessions
          .map((s) => classes.find((c) => c.id === s["Class ID"])?.["Môn học"])
          .filter(Boolean)
      )
    ).join(", ");

    // Layout: left details + right QR/bank block (if available)

    // totalSessions already calculated above

    const logoUrl = "https://www.appsheet.com/template/gettablefileurl?appName=Appsheet-325045268&tableName=Kho%20%E1%BA%A3nh&fileName=Kho%20%E1%BA%A3nh_Images%2F323065b6.%E1%BA%A2nh.115930.png";
    const watermarkUrl = logoUrl;
    const bankName = teacher?.["Ngân hàng"] || "N/A";
    const bankAcc = teacher?.STK || "N/A";
    const note = teacher?.["Ghi chú"] || "Thầy/Cô vui lòng kiểm tra thông tin và liên hệ ngay nếu có sai sót.";
    const subjectDisplay =
      subjectMap[subjects] ||
      subjects
        ?.split(",")
        .map((s) => subjectMap[s.trim()] || s.trim())
        .join(", ") ||
      teacher?.["Môn phụ trách"] ||
      "N/A";

    const classRows = classData
      .map(
        (c, idx) => `
          <tr class="${idx % 2 === 1 ? "pl-tr-even" : ""}">
            <td class="pl-td">
              <div style="font-weight:700;">${c.className}${c.classCode ? ` (${c.classCode})` : ""}</div>
              ${c.subject ? `<div style="font-size:11px;color:#666;">${subjectMap[c.subject] || c.subject}</div>` : ""}
            </td>
            <td class="pl-td pl-text-center">${c.sessionCount}</td>
            <td class="pl-td pl-text-right">${c.salaryPerSession.toLocaleString("vi-VN")}</td>
            <td class="pl-td pl-text-right">${(c.totalSalary + c.totalAllowance).toLocaleString("vi-VN")}</td>
          </tr>
        `
      )
      .join("");

    // Calculate total salary across all classes
    const totalSalaryAll = classData.reduce((sum, item) => sum + item.totalSalary + item.totalAllowance, 0);

    const totalRow = `
      <tr style="background-color: #e8f4f8; border-top: 2px solid #003366; border-bottom: 2px solid #003366;">
        <td class="pl-td" style="font-weight: 700; color: #003366;">Tổng lương</td>
        <td class="pl-td pl-text-center" style="font-weight: 700; color: #003366;">${totalSessions}</td>
        <td class="pl-td pl-text-right" style="font-weight: 700; color: #003366;"></td>
        <td class="pl-td pl-text-right" style="font-weight: 700; color: #d32f2f; font-size: 12px;">${totalSalaryAll.toLocaleString("vi-VN")} đ</td>
      </tr>
    `;

    return `
      <div class="pl-wrapper">
        <style>
          .pl-wrapper { --primary-color: #003366; --secondary-color: #f8f9fa; --accent-color: #d32f2f; --success-color: #2e7d32; font-family: 'Montserrat', sans-serif; }
          .pl-page { width: 148mm; min-height: 210mm; background: white; box-shadow: none; position: relative; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box; margin: 0; }
          .pl-watermark-container { position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%); width: 70%; z-index: 0; pointer-events: none; opacity: 0.08; display: flex; justify-content: center; align-items: center; }
          .pl-watermark-img { width: 100%; height: auto; filter: grayscale(0%); }
          .pl-header { background-color: var(--primary-color); color: white; padding: 10px 16px; border-bottom: 4px solid rgba(0,0,0,0.2); position: relative; z-index: 1; }
          .pl-brand-section { margin-bottom: 6px; display: flex; align-items: center; gap: 12px; }
          .pl-logo-header { height: 55px; width: auto; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
          .pl-brand-info { display: flex; flex-direction: column; }
          .pl-brand-name { font-size: 10px; opacity: 0.9; letter-spacing: 0.4px; margin-bottom: 1px; text-transform: uppercase; font-family: 'Times New Roman', Times, serif; }
          .pl-brand-main { font-size: 16px; font-weight: 800; line-height: 1.2; font-family: 'Times New Roman', Times, serif; }
          .pl-title-section { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px; }
          .pl-main-title { font-size: 15px; font-weight: 700; text-transform: uppercase; }
          .pl-sub-title { font-size: 11px; opacity: 0.85; font-style: italic; }
          .pl-content { padding: 10px 16px; flex: 1; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; }
          .pl-info-grid { display: grid; grid-template-columns: 0.7fr 0.3fr; gap: 8px; }
          .pl-info-card { background: var(--secondary-color); padding: 10px 12px; border-radius: 8px; border-left: 4px solid var(--primary-color); }
          .pl-card-header { font-size: 11px; font-weight: 700; color: var(--primary-color); margin-bottom: 6px; text-transform: uppercase; font-family: 'Times New Roman', Times, serif; }
          .pl-info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; border-bottom: 1px dashed #d1d9e6; padding-bottom: 2px; }
          .pl-info-row:last-child { border-bottom: none; }
          .pl-label { color: #555; font-weight: 500; font-size: 10px; }
          .pl-value { font-weight: 700; color: #222; text-align: right; }
          .pl-table-container { border-radius: 6px; overflow: hidden; border: 1px solid #e0e0e0; }
          .pl-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .pl-thead { background-color: var(--primary-color); color: white; }
          .pl-th { padding: 8px 5px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 9px; }
          .pl-td { padding: 8px 5px; border-bottom: 1px solid #e0e0e0; color: #444; vertical-align: middle; }
          .pl-tr-even { background-color: #f8f9fa; }
          .pl-text-center { text-align: center; }
          .pl-text-right { text-align: right; }
          .pl-total-section { background-color: #fff7f7; border: 2px dashed var(--accent-color); border-radius: 8px; padding: 12px; text-align: center; }
          .pl-total-label { font-size: 11px; color: #555; text-transform: uppercase; }
          .pl-total-amount { font-size: 20px; font-weight: 800; color: var(--accent-color); }
          .pl-footer { display: flex; justify-content: space-between; padding-top: 10px; margin-top: auto; }
          .pl-sign-box { text-align: center; width: 45%; }
          .pl-sign-title { font-size: 9px; font-weight: 700; margin-bottom: 3px; color: var(--primary-color); text-transform: uppercase; }
          .pl-sign-date { font-size: 9px; font-style: italic; color: #666; margin-bottom: 40px; }
          .pl-sign-placeholder { font-size: 9px; color: #aaa; font-style: italic; border-top: 1px solid #ccc; padding-top: 5px; width: 80%; margin: 0 auto; }
          @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
        </style>

        <div class="pl-page" id="salarySlip">
          <div class="pl-watermark-container">
            <img src="${watermarkUrl}" alt="Watermark" class="pl-watermark-img" />
          </div>

          <div class="pl-header">
            <div class="pl-brand-section">
              <img src="${logoUrl}" alt="Logo" class="pl-logo-header" />
              <div class="pl-brand-info">
                <div class="pl-brand-name">TRUNG TÂM TRI TUỆ 8+</div>
                <div class="pl-brand-main">Phiếu Lương Giáo Viên</div>
              </div>
            </div>
            <div class="pl-title-section">
              <div class="pl-main-title">THÁNG ${salary.month + 1}/${salary.year}</div>
              <div class="pl-sub-title">Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}</div>
            </div>
          </div>

          <div class="pl-content">
            <div class="pl-info-grid">
              <div class="pl-info-card">
                <div class="pl-card-header">Thông tin giáo viên</div>
                <div class="pl-info-row"><span class="pl-label">Họ và tên</span><span class="pl-value">${salary.teacherName}</span></div>
                <div class="pl-info-row"><span class="pl-label">Môn phụ trách</span><span class="pl-value">${subjectDisplay}</span></div>
                <div class="pl-info-row"><span class="pl-label">Tổng số buổi</span><span class="pl-value">${totalSessions} buổi</span></div>
              </div>
              <div class="pl-info-card">
                <div class="pl-card-header">Ngân hàng</div>
                <div class="pl-info-row"><span class="pl-label">Ngân hàng</span><span class="pl-value">${bankName}</span></div>
                <div class="pl-info-row"><span class="pl-label">Số tài khoản</span><span class="pl-value">${bankAcc}</span></div>
                <div class="pl-info-row"><span class="pl-label">Tổng trợ cấp</span><span class="pl-value">${totalAllowanceAll.toLocaleString("vi-VN")} đ</span></div>
              </div>
            </div>

            <div class="pl-table-container">
              <table class="pl-table">
                <thead class="pl-thead">
                  <tr>
                    <th class="pl-th">Lớp học</th>
                    <th class="pl-th pl-text-center">Số buổi</th>
                    <th class="pl-th pl-text-right">Lương/buổi (đ)</th>
                    <th class="pl-th pl-text-right">Tổng lương</th>
                  </tr>
                </thead>
                <tbody>
                  ${classRows}
                  ${totalRow}
                </tbody>
              </table>
            </div>
            <div class="pl-info-row" style="margin-top:4px;">
              <span class="pl-label">Ghi chú</span>
              <span class="pl-value" style="text-align:left; flex:1; margin-left:8px;">${note}</span>
            </div>

            <div class="pl-footer">
              <div class="pl-sign-box">
                <div class="pl-sign-title">Trung tâm xác nhận</div>
                <div class="pl-sign-date">Ngày ....... / ....... / .......</div>
                <div class="pl-sign-placeholder">(Ký và ghi rõ họ tên)</div>
              </div>
              <div class="pl-sign-box">
                <div class="pl-sign-title">Giáo viên</div>
                <div class="pl-sign-date">Ngày ....... / ....... / .......</div>
                <div class="pl-sign-placeholder">(Ký và ghi rõ họ tên)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const exportToImage = async (elementId: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${elementId}-${new Date().getTime()}.png`;
      link.click();
      message.success("Đã xuất ảnh thành công");
    } catch (error) {
      console.error("Error exporting image:", error);
      message.error("Lỗi khi xuất ảnh");
    }
  };

  const printInvoice = (invoice: StudentInvoice, includeQR: boolean = true) => {
    console.log('🖨️ Printing invoice with QR:', includeQR);
    // Get the latest data from state instead of using the passed invoice object
    const latestInvoiceData = studentInvoiceStatus[invoice.id];
    let updatedInvoice = { ...invoice };

    // Only update name/code from Firebase, preserve merged sessions
    if (typeof latestInvoiceData === "object" && latestInvoiceData !== null) {
      updatedInvoice = {
        ...invoice,
        studentName: latestInvoiceData.studentName || invoice.studentName,
        studentCode: latestInvoiceData.studentCode || invoice.studentCode,
        // Keep the merged sessions - don't override with single invoice sessions from Firebase
      };
    }

    // Always regenerate HTML with latest data to include any edits
    const freshContent = generateStudentInvoiceHTML(updatedInvoice, includeQR);

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>In phiếu</title>
        <style>
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        ${freshContent}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Print invoice with edited values from modal (contenteditable fields)
  // Print invoice from edit modal with edited values
  const printInvoiceFromEditModal = (includeQR: boolean = true) => {
    if (!editingInvoice) {
      message.error("Không có phiếu thu để in");
      return;
    }

    // Tạo invoice tạm thời với các giá trị đã chỉnh sửa
    const editedInvoice: StudentInvoice = {
      ...editingInvoice,
      discount: editDiscount,
      debt: editDebt,
    };

    // Cập nhật sessions với giá mới từ editSessionPrices
    const updatedSessions: AttendanceSession[] = editingInvoice.sessions.map((session: AttendanceSession) => {
      const classId = session["Class ID"];
      const classData = classes.find(c => c.id === classId);
      const subject = classData?.["Môn học"] || session["Môn học"] || "Chưa xác định";
      
      const priceForSubject = editSessionPrices[subject];
      // Ưu tiên: giá đã chỉnh sửa > giá từ session > getUnitPrice()
      let newPrice = priceForSubject;
      if (newPrice === undefined) {
        const sessionPrice = getSafeField(session, "Giá/buổi");
        newPrice = sessionPrice ? Number(sessionPrice) : getUnitPrice(editingInvoice.studentId, subject, classId, editingInvoice.pricePerSession);
      }

      return {
        ...session,
        [sanitizeKey("Giá/buổi")]: newPrice,
      } as AttendanceSession;
    });

    // Tính tổng số buổi từ editSessionCounts nếu có
    let totalSessions = editingInvoice.totalSessions;
    if (Object.keys(editSessionCounts).length > 0) {
      // Group by subject để tính tổng số buổi
      const subjectGroups: Record<string, number> = {};
      updatedSessions.forEach((session: AttendanceSession) => {
        const classId = session["Class ID"];
        const classData = classes.find(c => c.id === classId);
        const subject = classData?.["Môn học"] || session["Môn học"] || "Chưa xác định";
        
        if (!subjectGroups[subject]) {
          subjectGroups[subject] = 0;
        }
        subjectGroups[subject]++;
      });

      // Tính tổng từ editSessionCounts
      totalSessions = Object.entries(subjectGroups).reduce((sum, [subject, originalCount]) => {
        const editedCount = editSessionCounts[subject] !== undefined ? editSessionCounts[subject] : originalCount;
        return sum + editedCount;
      }, 0);
    }

    // Tính tổng tiền từ các môn học đã chỉnh sửa
    const subjectGroups: Record<string, { count: number; price: number }> = {};
    updatedSessions.forEach((session: AttendanceSession) => {
      const classId = session["Class ID"];
      const classData = classes.find(c => c.id === classId);
      const subject = classData?.["Môn học"] || session["Môn học"] || "Chưa xác định";
      
      if (!subjectGroups[subject]) {
        const priceForSubject = editSessionPrices[subject];
        // Ưu tiên: giá đã chỉnh sửa > giá từ session > getUnitPrice()
        let price = priceForSubject;
        if (price === undefined) {
          const sessionPrice = getSafeField(session, "Giá/buổi");
          price = sessionPrice ? Number(sessionPrice) : getUnitPrice(editingInvoice.studentId, subject, classId, editingInvoice.pricePerSession);
        }
        subjectGroups[subject] = { count: 0, price: price || 0 };
      }
      subjectGroups[subject].count++;
    });

    // Tính tổng tiền với số buổi đã chỉnh sửa
    let totalAmount = 0;
    Object.entries(subjectGroups).forEach(([subject, data]) => {
      const editedCount = editSessionCounts[subject] !== undefined ? editSessionCounts[subject] : data.count;
      totalAmount += data.price * editedCount;
    });

    // Cập nhật invoice với các giá trị đã chỉnh sửa
    editedInvoice.sessions = updatedSessions;
    editedInvoice.totalSessions = totalSessions;
    editedInvoice.totalAmount = totalAmount;
    editedInvoice.finalAmount = Math.max(0, totalAmount - editDiscount);

    // Generate HTML và in
    const htmlContent = generateStudentInvoiceHTML(editedInvoice, includeQR);
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      message.error("Không thể mở cửa sổ in");
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);

    message.success("Đang in phiếu với giá trị đã chỉnh sửa");
  };

  const printInvoiceWithEditedValues = (invoiceId: string, includeQR: boolean = true) => {
    const modalElement = document.getElementById(`student-invoice-${invoiceId}`);
    if (!modalElement) {
      message.error("Không tìm thấy phiếu thu để in");
      return;
    }

    // Get the original invoice to extract styles
    const originalInvoice = studentInvoices.find(inv => inv.id === invoiceId);
    if (!originalInvoice) {
      message.error("Không tìm thấy thông tin phiếu thu");
      return;
    }

    // Get the original HTML template to extract styles
    const originalContent = generateStudentInvoiceHTML(originalInvoice, includeQR);
    
    // Extract styles from original content
    const styleMatch = originalContent.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const styles = styleMatch ? styleMatch[1] : '';

    // Get the invoice body from modal (contains all edited content)
    const invoiceBody = modalElement.querySelector('.invoice-body') || modalElement.querySelector('.page') || modalElement;
    
    if (!invoiceBody) {
      message.error("Không tìm thấy nội dung phiếu thu");
      return;
    }

    // Get edited HTML content (clone to avoid modifying original)
    const clonedBody = invoiceBody.cloneNode(true) as HTMLElement;
    const editedContent = clonedBody.innerHTML;

    // Create full HTML document with edited content
    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>In phiếu (đã chỉnh sửa)</title>
        <style>
          ${styles}
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
          @media print {
            body { margin: 0; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        </style>
      </head>
      <body>
        ${editedContent}
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      message.error("Không thể mở cửa sổ in");
      return;
    }

    printWindow.document.write(fullHTML);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);

    message.success("Đang in phiếu với giá trị đã chỉnh sửa");
  };

  // Bulk print invoices
  const handleBulkPrintInvoices = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất một phiếu thu để in");
      return;
    }

    // Get all invoices for selected students and merge by student
    const groupedByStudent = new Map(groupedStudentInvoices.map((g) => [g.studentId, g]));
    const mergedInvoicesToPrint: StudentInvoice[] = [];

    selectedRowKeys.forEach((studentIdKey) => {
      const group = groupedByStudent.get(String(studentIdKey));
      if (group && group.invoices.length > 0) {
        // Merge all invoices of this student into one
        const mergedInvoice = mergeStudentInvoices(group.invoices);
        mergedInvoicesToPrint.push(mergedInvoice);
      }
    });

    if (mergedInvoicesToPrint.length === 0) {
      message.warning("Không tìm thấy phiếu thu để in");
      return;
    }

    // Create a new window with all invoices
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      message.error("Không thể mở cửa sổ in. Vui lòng cho phép mở popup.");
      return;
    }

    // Generate HTML for all merged invoices
    const allInvoiceHTML = mergedInvoicesToPrint
      .map((invoice) => {
        const latestInvoiceData = studentInvoiceStatus[invoice.id];
        let updatedInvoice = { ...invoice };

        // Only update name/code from Firebase, preserve merged sessions
        if (typeof latestInvoiceData === "object" && latestInvoiceData !== null) {
          updatedInvoice = {
            ...invoice,
            studentName: latestInvoiceData.studentName || invoice.studentName,
            studentCode: latestInvoiceData.studentCode || invoice.studentCode,
            // Keep merged sessions - don't override
          };
        }

        const hasQR = invoiceQRPreferences[updatedInvoice.id] !== false;
        const freshContent = generateStudentInvoiceHTML(updatedInvoice, hasQR);
        return `
          <div style="page-break-after: always; margin-bottom: 20px;">
            ${freshContent}
          </div>
        `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>In hàng loạt phiếu thu</title>
        <style>
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        ${allInvoiceHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);

    message.success(`Đang in ${mergedInvoicesToPrint.length} phiếu thu...`);
  };

  // Expandable row render for student invoice details
  const expandedRowRender = (record: StudentInvoice) => {
    // Group sessions by class
    const classSummary: Record<
      string,
      {
        className: string;
        classCode: string;
        subject: string;
        sessionCount: number;
        pricePerSession: number;
        totalPrice: number;
      }
    > = {};

    // If invoice is paid, use sessions data from Firebase (already saved)
    if (record.status === "paid") {
      const firebaseData = studentInvoiceStatus[record.id];
      if (
        firebaseData &&
        typeof firebaseData === "object" &&
        firebaseData.sessions
      ) {
        // Use saved sessions from Firebase
        firebaseData.sessions.forEach((session: any) => {
          const className = session["Tên lớp"] || "";
          const classCode = session["Mã lớp"] || "";
          const classId = session["Class ID"];
          const classInfo = classes.find((c) => c.id === classId);
          const subject = classInfo?.["Môn học"] || "N/A";
          const key = `${classCode}-${className}-${subject}`;

          if (!classSummary[key]) {
            classSummary[key] = {
              className,
              classCode,
              subject,
              sessionCount: 0,
              pricePerSession: 0,
              totalPrice: 0,
            };
          }

          classSummary[key].sessionCount++;
        });

        // Calculate prices from saved totalAmount
        const totalSessions = firebaseData.totalSessions || 1;
        const avgPrice = (firebaseData.totalAmount || 0) / totalSessions;

        Object.values(classSummary).forEach((summary) => {
          summary.pricePerSession = avgPrice;
          summary.totalPrice = avgPrice * summary.sessionCount;
        });
      }
    } else {
      // For unpaid invoices, calculate from current data
      record.sessions.forEach((session) => {
        const className = session["Tên lớp"] || "";
        const classCode = session["Mã lớp"] || "";

        // Find class info using Class ID from session
        const classId = session["Class ID"];
        const classInfo = classes.find((c) => c.id === classId);
        const subject = classInfo?.["Môn học"] || "N/A";
        const key = `${classCode}-${className}-${subject}`;

        // Priority 1: Use student's hoc_phi_rieng for the specific subject if available
        const student = students.find((s) => s.id === record.studentId);
        const hocPhiRieng = getHocPhiRieng(student, subject);
        
        let pricePerSession = 0;
        if (hocPhiRieng !== null) {
          pricePerSession = hocPhiRieng;
        } else {
          // Priority 2: Find course using Khối and Môn học from class info
          const course = classInfo
            ? courses.find((c) => {
              if (c.Khối !== classInfo.Khối) return false;
              const classSubject = classInfo["Môn học"];
              const courseSubject = c["Môn học"];
              // Direct match
              if (classSubject === courseSubject) return true;
              // Try matching with subject options (label <-> value)
              const subjectOption = subjectOptions.find(
                (opt) =>
                  opt.label === classSubject || opt.value === classSubject
              );
              if (subjectOption) {
                return (
                  courseSubject === subjectOption.label ||
                  courseSubject === subjectOption.value
                );
              }
              return false;
            })
            : undefined;

          pricePerSession = classInfo?.["Học phí mỗi buổi"] || course?.Giá || 0;
        }

        if (!classSummary[key]) {
          classSummary[key] = {
            className,
            classCode,
            subject,
            sessionCount: 0,
            pricePerSession,
            totalPrice: 0,
          };
        }

        classSummary[key].sessionCount++;
        classSummary[key].totalPrice += pricePerSession;
      });
    }

    const classData = Object.values(classSummary);

    const expandColumns = [
      {
        title: "Tên lớp",
        dataIndex: "className",
        key: "className",
        width: 200,
      },
      {
        title: "Mã lớp",
        dataIndex: "classCode",
        key: "classCode",
        width: 100,
      },
      {
        title: "Môn học",
        dataIndex: "subject",
        key: "subject",
        width: 120,
      },
      {
        title: "Số buổi",
        dataIndex: "sessionCount",
        key: "sessionCount",
        width: 100,
        align: "center" as const,
        render: (count: number) => <Tag color="blue">{count} buổi</Tag>,
      },
      {
        title: "Giá/buổi",
        dataIndex: "pricePerSession",
        key: "pricePerSession",
        width: 130,
        align: "right" as const,
        render: (price: number) => (
          <Text style={{ color: "#52c41a" }}>
            {price.toLocaleString("vi-VN")} đ
          </Text>
        ),
      },
      {
        title: "Tổng tiền",
        dataIndex: "totalPrice",
        key: "totalPrice",
        width: 130,
        align: "right" as const,
        render: (total: number) => (
          <Text strong style={{ color: "#1890ff" }}>
            {total.toLocaleString("vi-VN")} đ
          </Text>
        ),
      },
    ];

    return (
      <Table
        columns={expandColumns}
        dataSource={classData}
        pagination={false}
        rowKey={(row) => `${row.classCode}-${row.className}-${row.subject}`}
        size="small"
        style={{ margin: "0 48px" }}
      />
    );
  };

  // State for image upload
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<string | null>(
    null
  );
  const [previewImage, setPreviewImage] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Convert file to base64
  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle image upload for student invoice
  const handleStudentImageUpload = async (file: File, invoiceId: string) => {
    try {
      const base64 = await getBase64(file);
      const invoiceRef = ref(
        database,
        `datasheet/Phiếu_thu_học_phí/${invoiceId}`
      );
      const currentData = studentInvoiceStatus[invoiceId] || {};

      await update(invoiceRef, {
        ...currentData,
        invoiceImage: base64,
      });

      message.success("Đã tải ảnh hóa đơn lên");
      return false; // Prevent default upload behavior
    } catch (error) {
      console.error("Error uploading image:", error);
      message.error("Lỗi khi tải ảnh lên");
      return false;
    }
  };

  // Handle image upload for teacher salary
  const handleTeacherImageUpload = async (file: File, salaryId: string) => {
    try {
      const base64 = await getBase64(file);
      const salaryRef = ref(
        database,
        `datasheet/Phiếu_lương_giáo_viên/${salaryId}`
      );
      const currentData = teacherSalaryStatus[salaryId] || {};

      await update(salaryRef, {
        ...currentData,
        invoiceImage: base64,
      });

      message.success("Đã tải ảnh phiếu lương lên");
      return false; // Prevent default upload behavior
    } catch (error) {
      console.error("Error uploading image:", error);
      message.error("Lỗi khi tải ảnh lên");
      return false;
    }
  };

  // Student invoice columns (grouped by student) - for unpaid tab
  const groupedStudentColumns = useMemo(
    () => [
      {
        title: "Mã HS",
        dataIndex: "studentCode",
        key: "studentCode",
        width: 100,
      },
      {
        title: "Họ tên",
        dataIndex: "studentName",
        key: "studentName",
        width: 200,
      },
      {
        title: "Số buổi",
        dataIndex: "totalSessions",
        key: "totalSessions",
        width: 100,
        align: "center" as const,
      },
      {
        title: "Miễn giảm",
        key: "discount",
        width: 150,
        render: (_: any, record: GroupedStudentInvoice) => {
          // Show grouped discount input (editable for all invoices in this student)
          return (
            <InputNumber
              value={record.discount}
              min={0}
              max={record.totalAmount}
              onChange={(value) => {
                const discount = value || 0;
                // Update all invoices for this student with the same discount
                record.invoices.forEach((invoice) => {
                  updateStudentDiscount(invoice.id, discount);
                });
              }}
              onBlur={() => {
                // Trigger refresh after blur
                setRefreshTrigger((prev) => prev + 1);
              }}
              style={{ width: "100%" }}
              size="small"
              placeholder="0"
            />
          );
        },
      },
      {
        title: "Thành tiền",
        key: "finalAmount",
        width: 130,
        render: (_: any, record: GroupedStudentInvoice) => {
          // Tính tổng giá từ tất cả các môn
          // Mỗi môn sẽ dùng học phí riêng của môn đó (nếu có), nếu không thì dùng giá môn học
          const student = students.find((s) => s.id === record.studentId);
          let totalAmount = 0;
          
          // Tính từng môn và cộng lại (mỗi môn có học phí riêng riêng)
          record.invoices.forEach((inv) => {
            const unitPrice = getUnitPrice(record.studentId, inv.subject, inv.classId, inv.pricePerSession);
            totalAmount += unitPrice * inv.totalSessions;
          });
          const finalAmount = Math.max(0, totalAmount - record.discount);
          return (
            <Text strong style={{ color: "#1890ff", fontSize: "14px" }}>
              {finalAmount.toLocaleString("vi-VN")} đ
            </Text>
          );
        },
      },
      {
        title: "Nợ học phí",
        key: "debt",
        width: 130,
        render: (_: any, record: GroupedStudentInvoice) => {
          // Nợ học phí = đọc từ database đã lưu, nếu không có thì tính toán
          let savedDebt: number | null = null;
          
          // Kiểm tra trong từng invoice của student có debt đã lưu không
          record.invoices.forEach((inv) => {
            const invoiceData = studentInvoiceStatus[inv.id];
            if (typeof invoiceData === "object" && invoiceData.debt !== undefined && invoiceData.debt !== null) {
              savedDebt = invoiceData.debt; // Lấy debt đã lưu
            }
          });
          
          // Tính toán debt từ các tháng trước (luôn tính để đảm bảo chính xác)
          const calculatedDebt = calculateStudentTotalDebt(record.studentId, record.month, record.year);
          
          // Ưu tiên: Nếu có debt đã lưu và > 0, dùng debt đã lưu
          // Nếu debt đã lưu = 0 nhưng calculated > 0, dùng calculated (có thể có invoice mới chưa được cập nhật)
          // Nếu không có debt đã lưu, dùng calculated
          let debt = savedDebt !== null ? savedDebt : calculatedDebt;
          
          // Nếu saved debt = 0 nhưng calculated > 0, có thể có invoice mới chưa được cập nhật
          // Trong trường hợp này, ưu tiên calculated để đảm bảo hiển thị đúng
          if (savedDebt === 0 && calculatedDebt > 0) {
            debt = calculatedDebt;
          }
          
          // Đảm bảo debt là số (không phải null)
          debt = debt ?? 0;
          
          return (
            <Text strong style={{ color: debt > 0 ? "#ff4d4f" : "#52c41a", fontSize: "14px" }}>
              {debt.toLocaleString("vi-VN")} đ
            </Text>
          );
        },
      },
      {
        title: "Tổng nợ lũy kế",
        key: "totalDebt",
        width: 140,
        render: (_: any, record: GroupedStudentInvoice) => {
          // Đọc debt từ database (Nợ học phí)
          let debt: number | null = null;
          record.invoices.forEach((inv) => {
            const invoiceData = studentInvoiceStatus[inv.id];
            if (typeof invoiceData === "object" && invoiceData.debt !== undefined && invoiceData.debt !== null) {
              debt = invoiceData.debt;
            }
          });
          // Nếu không có debt đã lưu, tính toán từ các tháng trước
          if (debt === null) {
            debt = calculateStudentTotalDebt(record.studentId, record.month, record.year);
          }
          // Đảm bảo debt là số
          debt = debt || 0;
          // Tính Thành tiền theo công thức thống nhất: Tổng giá từng môn - Miễn giảm
          // Tổng giá mỗi môn = unitPrice × totalSessions của môn đó
          // unitPrice được lấy từ getUnitPrice() với thứ tự ưu tiên:
          // 1. Học phí riêng của học sinh cho lớp đó (nếu có)
          // 2. Giá từ invoice (pricePerSession)
          // 3. Giá từ lớp học hoặc khóa học
          let totalAmount = 0;
          record.invoices.forEach((inv) => {
            const unitPrice = getUnitPrice(record.studentId, inv.subject, inv.classId, inv.pricePerSession);
            totalAmount += unitPrice * inv.totalSessions;
          });
          const thanhTien = record.status === "unpaid"
            ? Math.max(0, totalAmount - record.discount)
            : 0;
          // Tổng nợ lũy kế = Thành tiền + Nợ học phí
          const combinedDebt = thanhTien + debt;
          return (
            <Text
              strong
              style={{
                color: combinedDebt > 0 ? "#ff4d4f" : "#52c41a",
                fontSize: "14px",
                cursor: combinedDebt > 0 ? "pointer" : "default",
                textDecoration: combinedDebt > 0 ? "underline" : "none",
              }}
              onClick={() => {
                if (combinedDebt <= 0) return;
                const student = students.find((s) => s.id === record.studentId);
                const breakdown = getStudentDebtBreakdown(
                  record.studentId,
                  record.month,
                  record.year
                );
                setDebtDetailModal({
                  visible: true,
                  studentId: record.studentId,
                  studentName: student?.["Tên học sinh"] || (student as any)?.name || "",
                  month: record.month,
                  year: record.year,
                  items: breakdown.items,
                  total: breakdown.total,
                });
              }}
            >
              {combinedDebt.toLocaleString("vi-VN")} đ
            </Text>
          );
        },
      },
      {
        title: "QR",
        key: "qr",
        width: 80,
        align: "center" as const,
        render: (_: any, record: GroupedStudentInvoice) => {
          const firstInvoice = record.invoices[0];
          const hasQR = invoiceQRPreferences[firstInvoice.id] !== false;
          return (
            <Button
              size="small"
              type={hasQR ? "primary" : "default"}
              onClick={() => {
                const newPreference = !hasQR;
                setInvoiceQRPreferences(prev => ({
                  ...prev,
                  [firstInvoice.id]: newPreference
                }));
                // Persist to localStorage
                localStorage.setItem(`qr-pref-${firstInvoice.id}`, String(newPreference));
              }}
            >
              {hasQR ? "✓" : "✗"}
            </Button>
          );
        },
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 80,
        align: "center" as const,
        render: (_: any, record: GroupedStudentInvoice) => {
          const firstInvoice = record.invoices[0];
          const mergedInvoice = mergeStudentInvoices(record.invoices);
          const hasQR = invoiceQRPreferences[firstInvoice.id] !== false;

          const menu = (
            <Menu>
              <Menu.Item
                key="view"
                icon={<EyeOutlined />}
                onClick={() => viewStudentInvoice(mergedInvoice)}
              >
                Xem
              </Menu.Item>
              <Menu.Item
                key="edit"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingInvoice(mergedInvoice);
                  const prices: Record<string, number> = {};
                  mergedInvoice.sessions?.forEach((session: AttendanceSession) => {
                    const classId = session["Class ID"];
                    const classData = classes.find(c => c.id === classId);
                    const subject = classData?.["Môn học"] || session["Môn học"] || "Chưa xác định";
                    if (prices[subject] === undefined) {
                      prices[subject] = Number(getSafeField(session, "Giá/buổi")) || 0;
                    }
                  });
                  setEditSessionPrices(prices);
                  setEditDiscount(mergedInvoice.discount || 0);
                  // Load debt from Firebase or calculate if not exists
                  const invoiceData = studentInvoiceStatus[mergedInvoice.id];
                  const savedDebt = typeof invoiceData === "object" && invoiceData.debt !== undefined 
                    ? invoiceData.debt 
                    : calculateStudentTotalDebt(record.studentId, record.month, record.year);
                  setEditDebt(savedDebt);
                  setEditInvoiceModalOpen(true);
                }}
              >
                Sửa
              </Menu.Item>
              <Menu.Item
                key="print"
                icon={<PrinterOutlined />}
                onClick={() => printInvoice(mergedInvoice, hasQR)}
              >
                In
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                key="confirm"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  record.invoices.forEach((invoice) => {
                    updateStudentInvoiceStatus(invoice.id, "paid");
                  });
                }}
              >
                Xác nhận TT
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                key="reset"
                icon={<RollbackOutlined />}
                danger
                onClick={() => {
                  Modal.confirm({
                    title: "Xác nhận reset phiếu thu",
                    content: `Bạn có chắc chắn muốn reset tất cả giá trị của phiếu thu về ban đầu?\n\nSẽ reset:\n- Giá/buổi về giá gốc\n- Miễn giảm về 0\n- Nợ học phí về 0\n- Số buổi giữ nguyên`,
                    okText: "Reset",
                    okType: "danger",
                    cancelText: "Hủy",
                    onOk: async () => {
                      // Reset tất cả invoices của học sinh này
                      for (const invoice of record.invoices) {
                        await resetInvoiceToOriginal(invoice.id);
                      }
                    }
                  });
                }}
              >
                Reset về ban đầu
              </Menu.Item>
            </Menu>
          );

          return (
            <Dropdown overlay={menu} trigger={['click']}>
              <Button size="small" icon={<MoreOutlined />} />
            </Dropdown>
          );
        },
      },
    ],
    [viewStudentInvoice, updateStudentDiscount, updateStudentInvoiceStatus, handleDeleteInvoice, setEditingInvoice, setEditSessionPrices, setEditDiscount, setEditInvoiceModalOpen, mergeStudentInvoices, classes, studentInvoiceStatus, calculateStudentTotalDebt, students, resetInvoiceToOriginal, courses]
  );

  // Paid student invoice columns (flat, not grouped)
  const paidStudentColumns = useMemo(
    () => [
      {
        title: "Mã HS",
        dataIndex: "studentCode",
        key: "studentCode",
        width: 100,
      },
      {
        title: "Họ tên",
        dataIndex: "studentName",
        key: "studentName",
        width: 200,
      },
      {
        title: "Tên lớp",
        dataIndex: "className",
        key: "className",
        width: 150,
      },
      {
        title: "Mã lớp",
        dataIndex: "classCode",
        key: "classCode",
        width: 100,
      },
      {
        title: "Môn học",
        dataIndex: "subject",
        key: "subject",
        width: 120,
      },
      {
        title: "Số buổi",
        dataIndex: "totalSessions",
        key: "totalSessions",
        width: 100,
        align: "center" as const,
      },
      {
        title: "Miễn giảm",
        dataIndex: "discount",
        key: "discount",
        width: 130,
        render: (discount: number) => (
          <Text>{discount.toLocaleString("vi-VN")} đ</Text>
        ),
      },
      {
        title: "Thành tiền",
        key: "finalAmount",
        width: 130,
        render: (_: any, record: StudentInvoice) => {
          // Tính giá: (Giá môn × Học phí riêng) × Số buổi
          const unitPrice = getUnitPrice(record.studentId, record.subject, record.classId, record.pricePerSession);
          const finalAmount = Math.max(0, (record.totalSessions * unitPrice) - record.discount);
          return (
            <Text strong style={{ color: "#52c41a", fontSize: "14px" }}>
              {finalAmount.toLocaleString("vi-VN")} đ
            </Text>
          );
        },
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (status: "paid" | "unpaid") => (
          <Tag color={status === "paid" ? "green" : "red"}>
            {status === "paid" ? "Đã thu" : "Chưa thu"}
          </Tag>
        ),
      },
      {
        title: "Nợ học phí",
        key: "debt",
        width: 130,
        render: (_: any, record: StudentInvoice) => {
          // Nợ học phí = nợ từ các tháng trước (không bao gồm tháng hiện tại)
          // Nếu không có tháng trước thì = 0đ
          const debt = calculateStudentTotalDebt(record.studentId, record.month, record.year);
          return (
            <Text strong style={{ color: debt > 0 ? "#ff4d4f" : "#52c41a", fontSize: "14px" }}>
              {debt.toLocaleString("vi-VN")} đ
            </Text>
          );
        },
      },
      {
        title: "Tổng nợ lũy kế",
        key: "totalDebt",
        width: 140,
        render: (_: any, record: StudentInvoice) => {
          // Nợ học phí (từ các tháng trước)
          const totalDebt = calculateStudentTotalDebt(record.studentId, record.month, record.year);
          // Tính Thành tiền theo công thức thống nhất: (Số buổi × Đơn giá) - Miễn giảm
          // unitPrice được lấy từ getUnitPrice() với thứ tự ưu tiên:
          // 1. Học phí riêng của học sinh cho lớp đó (nếu có)
          // 2. Giá từ invoice (pricePerSession)
          // 3. Giá từ lớp học hoặc khóa học
          const unitPrice = getUnitPrice(record.studentId, record.subject, record.classId, record.pricePerSession);
          const thanhTien = record.status === "unpaid"
            ? Math.max(0, (record.totalSessions * unitPrice) - record.discount)
            : 0;
          // Tổng nợ lũy kế = Thành tiền + Nợ học phí
          const combinedDebt = thanhTien + totalDebt;
          return (
            <Text strong style={{ color: combinedDebt > 0 ? "#ff4d4f" : "#52c41a", fontSize: "14px" }}>
              {combinedDebt.toLocaleString("vi-VN")} đ
            </Text>
          );
        },
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 220,
        render: (_: any, record: StudentInvoice) => (
          <Space>
          <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => viewStudentInvoice(record)}
            >
              Xem
            </Button>
            <Popconfirm
              title="Hoàn trả về chưa thanh toán"
              description="Chuyển phiếu thu này về trạng thái chưa thanh toán?"
              onConfirm={() => handleRevertToUnpaid(record.id)}
              okText="Hoàn trả"
              cancelText="Hủy"
            >
              <Button
                size="small"
                icon={<RollbackOutlined />}
              >
                Hoàn trả
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [viewStudentInvoice, handleRevertToUnpaid, students]
  );

  // Columns for expanded row (class details)
  const expandedStudentColumns = [
    {
      title: "Tên lớp",
      dataIndex: "className",
      key: "className",
      width: 150,
    },
    {
      title: "Mã lớp",
      dataIndex: "classCode",
      key: "classCode",
      width: 100,
    },
    {
      title: "Môn học",
      dataIndex: "subject",
      key: "subject",
      width: 120,
    },
    {
      title: "Số buổi",
      dataIndex: "totalSessions",
      key: "totalSessions",
      width: 80,
      align: "center" as const,
    },
    {
      title: "Giá/buổi",
      dataIndex: "pricePerSession",
      key: "pricePerSession",
      width: 120,
      render: (price: number) => (
        <Text>{price.toLocaleString("vi-VN")} đ</Text>
      ),
    },
    {
      title: "Tổng tiền",
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 130,
      render: (amount: number) => (
        <Text style={{ color: "#36797f" }}>
          {amount.toLocaleString("vi-VN")} đ
        </Text>
      ),
    },
    {
      title: "Miễn giảm",
      dataIndex: "discount",
      key: "discount",
      width: 150,
      render: (discount: number) => (
        <Text>{discount.toLocaleString("vi-VN")} đ</Text>
      ),
    },
    {
      title: "Thành tiền",
      key: "finalAmount",
      width: 130,
      render: (_: any, record: StudentInvoice) => {
        // Tính giá: (Giá môn × Học phí riêng) × Số buổi
        const unitPrice = getUnitPrice(record.studentId, record.subject, record.classId, record.pricePerSession);
        const finalAmount = Math.max(0, (record.totalSessions * unitPrice) - record.discount);
        return (
          <Text strong style={{ color: "#1890ff", fontSize: "14px" }}>
            {finalAmount.toLocaleString("vi-VN")} đ
          </Text>
        );
      },
    },
  ];

  // Expandable row render for grouped student invoices
  const expandedStudentRowRender = (record: GroupedStudentInvoice) => {
    // If only 1 invoice, no need to expand
    if (record.invoices.length <= 1) {
      return null;
    }

    return (
      <Table
        columns={expandedStudentColumns}
        dataSource={record.invoices}
        pagination={false}
        rowKey="id"
        size="small"
      />
    );
  };

  // Expandable row render for teacher salary details
  const expandedTeacherRowRender = (record: TeacherSalary) => {
    // Find teacher info to get travel allowance per session
    const teacher = teachers.find((t) => t.id === record.teacherId);
    const travelAllowancePerSession = teacher?.["Trợ cấp đi lại"] || 0;

    // Group sessions by class
    const classSummary: Record<
      string,
      {
        className: string;
        classCode: string;
        sessionCount: number;
        salaryPerSession: number;
        totalSalary: number;
        totalAllowance: number;
      }
    > = {};

    // If salary is paid, use sessions data from Firebase (already saved)
    if (record.status === "paid") {
      const firebaseData = teacherSalaryStatus[record.id];
      if (
        firebaseData &&
        typeof firebaseData === "object" &&
        firebaseData.sessions
      ) {
        // Use saved sessions from Firebase
        firebaseData.sessions.forEach((session: any) => {
          const className = session["Tên lớp"] || "";
          const classCode = session["Mã lớp"] || "";
          const key = `${classCode}-${className}`;

          if (!classSummary[key]) {
            classSummary[key] = {
              className,
              classCode,
              sessionCount: 0,
              salaryPerSession: 0,
              totalSalary: 0,
              totalAllowance: 0,
            };
          }

          classSummary[key].sessionCount++;
        });

        // Calculate from saved data
        const totalSessions = firebaseData.totalSessions || 1;
        const avgSalary = (firebaseData.totalSalary || 0) / totalSessions;
        const avgAllowance = (firebaseData.totalAllowance || 0) / totalSessions;

        Object.values(classSummary).forEach((summary) => {
          summary.salaryPerSession = avgSalary;
          summary.totalSalary = avgSalary * summary.sessionCount;
          summary.totalAllowance = avgAllowance * summary.sessionCount;
        });
      }
    } else {
      // For unpaid salaries, calculate from current data
      // Get saved session salaries from database if available
      const savedData = teacherSalaryStatus[record.id];
      const savedSessionSalaries = (typeof savedData === "object" && savedData?.sessionSalaries)
        ? savedData.sessionSalaries
        : {};
      
      record.sessions.forEach((session) => {
        const className = session["Tên lớp"] || "";
        const classCode = session["Mã lớp"] || "";
        const classId = session["Class ID"];
        const key = `${classId}`; // Use classId as key for consistency

        // Find class info using Class ID from session
        const classInfo = classes.find((c) => c.id === classId);

        // Priority: saved sessionSalaries > session Lương/buổi > course salary > 0
        let salaryPerSession = 0;
        if (savedSessionSalaries[session.id] !== undefined) {
          salaryPerSession = savedSessionSalaries[session.id];
        } else if (getSafeField(session, "Lương/buổi")) {
          salaryPerSession = Number(getSafeField(session, "Lương/buổi"));
        } else {
          // Find course using Khối and Môn học from class info
          const course = classInfo
            ? courses.find(
              (c) =>
                c.Khối === classInfo.Khối &&
                c["Môn học"] === classInfo["Môn học"]
            )
            : undefined;
          salaryPerSession =
            record.bienChe === "Full-time"
              ? course?.["Lương GV Full-time"] || 0
              : course?.["Lương GV Part-time"] || 0;
        }

        if (!classSummary[key]) {
          classSummary[key] = {
            className,
            classCode,
            sessionCount: 0,
            salaryPerSession,
            totalSalary: 0,
            totalAllowance: 0,
          };
        }

        classSummary[key].sessionCount++;
        classSummary[key].salaryPerSession = salaryPerSession; // Update to use per-session salary
        classSummary[key].totalSalary += salaryPerSession;
        // Calculate allowance = allowancePerSession * sessionCount for this class
        classSummary[key].totalAllowance =
          travelAllowancePerSession * classSummary[key].sessionCount;
      });
    }

    const classData = Object.values(classSummary);

    const expandColumns = [
      {
        title: "Tên lớp",
        dataIndex: "className",
        key: "className",
        width: 250,
      },
      {
        title: "Mã lớp",
        dataIndex: "classCode",
        key: "classCode",
        width: 120,
      },
      {
        title: "Số buổi",
        dataIndex: "sessionCount",
        key: "sessionCount",
        width: 100,
        align: "center" as const,
        render: (count: number) => <Tag color="blue">{count} buổi</Tag>,
      },
      {
        title: "Lương/buổi",
        dataIndex: "salaryPerSession",
        key: "salaryPerSession",
        width: 150,
        align: "right" as const,
        render: (salary: number) => (
          <Text style={{ color: "#52c41a" }}>
            {salary.toLocaleString("vi-VN")} đ
          </Text>
        ),
      },
      {
        title: "Phụ cấp",
        dataIndex: "totalAllowance",
        key: "totalAllowance",
        width: 150,
        align: "right" as const,
        render: (allowance: number) => (
          <Text style={{ color: "#fa8c16" }}>
            {allowance.toLocaleString("vi-VN")} đ
          </Text>
        ),
      },
      {
        title: "Tổng lương",
        key: "totalPay",
        width: 150,
        align: "right" as const,
        render: (_: any, row: any) => (
          <Text strong style={{ color: "#1890ff" }}>
            {(row.totalSalary + row.totalAllowance).toLocaleString("vi-VN")} đ
          </Text>
        ),
      },
    ];

    return (
      <Table
        columns={expandColumns}
        dataSource={classData}
        pagination={false}
        rowKey={(row) => `${row.classCode}-${row.className}`}
        size="small"
        style={{ margin: "0 48px" }}
      />
    );
  };

  // Teacher salary columns
  const teacherColumns = [
    {
      title: "Mã GV",
      dataIndex: "teacherCode",
      key: "teacherCode",
      width: 100,
    },
    {
      title: "Họ tên",
      dataIndex: "teacherName",
      key: "teacherName",
      width: 180,
    },
    {
      title: "Biên chế",
      dataIndex: "bienChe",
      key: "bienChe",
      width: 120,
    },
    {
      title: "Số buổi",
      dataIndex: "totalSessions",
      key: "totalSessions",
      width: 80,
      align: "center" as const,
    },
    // {
    //   title: "Giờ dạy",
    //   key: "hours",
    //   width: 100,
    //   render: (_: any, record: TeacherSalary) => (
    //     <Text>
    //       {record.totalHours}h {record.totalMinutes}p
    //     </Text>
    //   ),
    // },
    {
      title: "Lương",
      key: "totalPay",
      width: 150,
      render: (_: any, record: TeacherSalary) => (
        <Text strong style={{ color: "#36797f" }}>
          {(record.totalSalary + record.totalAllowance).toLocaleString("vi-VN")}{" "}
          đ
        </Text>
      ),
    },
    {
      title: "Hóa đơn",
      key: "invoiceImage",
      width: 120,
      align: "center" as const,
      render: (_: any, record: TeacherSalary) => {
        const salaryData = teacherSalaryStatus[record.id];
        const hasImage =
          salaryData &&
          typeof salaryData === "object" &&
          salaryData.invoiceImage;

        return (
          <Space direction="vertical" size="small">
            {hasImage ? (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setPreviewImage(salaryData.invoiceImage!);
                  setPreviewOpen(true);
                }}
              >
                Xem
              </Button>
            ) : (
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) =>
                  handleTeacherImageUpload(file, record.id)
                }
              >
                <Button size="small" icon={<FileImageOutlined />}>
                  Tải lên
                </Button>
              </Upload>
            )}
          </Space>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: "paid" | "unpaid") => (
        <Tag color={status === "paid" ? "green" : "red"}>
          {status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 200,
      render: (_: any, record: TeacherSalary) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => viewTeacherSalary(record)}
          >
            Xem
          </Button>
          {record.status !== "paid" && (
            <>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingTeacherSalary(record);
                  const salaries: Record<string, number> = {};
                  
                  // Get saved session salaries from database
                  const savedData = teacherSalaryStatus[record.id];
                  const savedSessionSalaries = (typeof savedData === "object" && savedData?.sessionSalaries)
                    ? savedData.sessionSalaries
                    : {};
                  
                  // Group by class and get salary (prioritize saved data)
                  record.sessions?.forEach((session: AttendanceSession) => {
                    const classId = session["Class ID"];
                    const classKey = `${classId}`;
                    if (salaries[classKey] === undefined) {
                      // Priority: saved sessionSalaries > session Lương/buổi > record.salaryPerSession
                      const savedSalary = savedSessionSalaries[session.id];
                      if (savedSalary !== undefined) {
                        salaries[classKey] = savedSalary;
                      } else {
                        salaries[classKey] = Number(getSafeField(session, "Lương/buổi")) || record.salaryPerSession || 0;
                      }
                    }
                  });
                  setEditTeacherSessionSalaries(salaries);
                  setEditTeacherModalOpen(true);
                }}
              >
                Sửa
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => updateTeacherSalaryStatus(record.id, "paid")}
              >
                Đã TT
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const studentTab = (
    <Space direction="vertical" className="w-full">
      {/* Filters */}
      <Card className="mb-4">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Text strong className="block mb-2">
              Lọc theo lớp
            </Text>
            <Select
              mode="multiple"
              value={studentClassFilter}
              onChange={setStudentClassFilter}
              style={{ width: "100%" }}
              placeholder="Tất cả các lớp"
              showSearch
              filterOption={(input, option) => {
                const label = option?.label || option?.children || "";
                return String(label).toLowerCase().includes(input.toLowerCase());
              }}
            >
              {uniqueClasses.map((cls) => (
                <Select.Option key={cls.id} value={cls.id} label={cls.name}>
                  {cls.name}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong className="block mb-2">
              Tìm theo tên
            </Text>
            <Input
              placeholder="Nhập tên học sinh..."
              prefix={<SearchOutlined />}
              value={studentSearchTerm}
              onChange={(e) => setStudentSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Text strong className="block mb-2">
              Tháng
            </Text>
            <Select
              value={studentMonth + 1}
              onChange={(month) => setStudentMonth(month - 1)}
              style={{ width: "100%" }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <Option key={i + 1} value={i + 1}>
                  Tháng {i + 1}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Text strong className="block mb-2">
              Năm
            </Text>
            <Select
              value={studentYear}
              onChange={setStudentYear}
              style={{ width: "100%" }}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = dayjs().year() - 2 + i;
                return (
                  <Option key={year} value={year}>
                    {year}
                  </Option>
                );
              })}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Text strong className="block mb-2">
              Giáo viên
            </Text>
            <Select
              value={studentTeacherFilter}
              onChange={setStudentTeacherFilter}
              style={{ width: "100%" }}
            >
              <Option value="all">Tất cả</Option>
              {uniqueTeachers.map((teacher) => (
                <Option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Text strong className="block mb-2">
              Trạng thái
            </Text>
            <Select
              value={studentStatusFilter}
              onChange={setStudentStatusFilter}
              style={{ width: "100%" }}
            >
              <Option value="all">Tất cả</Option>
              <Option value="unpaid">Chưa thanh toán</Option>
              <Option value="paid">Đã thanh toán</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Summary */}
      <Row gutter={16} className="mb-4">
        <Col span={6}>
          <Card>
            <Text type="secondary">Tổng học sinh</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#36797f" }}>
              {groupedStudentInvoices.length}
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">Tổng số buổi</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#1890ff" }}>
              {groupedStudentInvoices
                .reduce((sum, i) => sum + i.totalSessions, 0)
                .toLocaleString("vi-VN")}
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">Tổng thu</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#36797f" }}>
              {groupedStudentInvoices
                .reduce((sum, i) => sum + i.finalAmount, 0)
                .toLocaleString("vi-VN")}{" "}
              đ
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">Tổng tiền (trước giảm)</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#52c41a" }}>
              {groupedStudentInvoices
                .reduce((sum, i) => sum + i.totalAmount, 0)
                .toLocaleString("vi-VN")}{" "}
              đ
            </Title>
          </Card>
        </Col>
      </Row>

      {/* Update debt button */}

      {/* Bulk delete button */}
      {selectedRowKeys.length > 0 && (
        <div className="mb-4">
          <Button
            type="primary"
              icon={<PrinterOutlined />}
              onClick={handleBulkPrintInvoices}
            >
              In {selectedRowKeys.length} phiếu đã chọn
            </Button>
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteMultipleInvoices}
            >
              Xóa {selectedRowKeys.length} phiếu đã chọn
          </Button>
      </div>
      )}

      {/* Table */}
      <Table
        columns={groupedStudentColumns}
        dataSource={groupedStudentInvoices}
        loading={loading}
        rowKey="studentId"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        rowSelection={{
          selectedRowKeys: selectedRowKeys,
          onChange: (newSelectedRowKeys) => {
            setSelectedRowKeys(newSelectedRowKeys);
          },
        }}
        expandable={{
          expandedRowRender: expandedStudentRowRender,
          rowExpandable: (record) => record.invoices.length > 1,
        }}
      />
    </Space>
  );

  const paidStudentTab = (
    <Space direction="vertical" className="w-full">
      {/* Filters */}
      <Card className="mb-4">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Text strong className="block mb-2">
              Tháng
            </Text>
            <DatePicker
              picker="month"
              value={dayjs().month(studentMonth).year(studentYear)}
              onChange={(date) => {
                if (date) {
                  setStudentMonth(date.month());
                  setStudentYear(date.year());
                }
              }}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} sm={12} md={18}>
            <Text strong className="block mb-2">
              Tìm kiếm
            </Text>
            <Input
              placeholder="Tìm theo tên hoặc mã học sinh..."
              prefix={<SearchOutlined />}
              value={studentSearchTerm}
              onChange={(e) => setStudentSearchTerm(e.target.value.trim())}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Summary */}
      <Row gutter={16} className="mb-4">
        <Col span={6}>
          <Card>
            <Text type="secondary">Tổng phiếu đã thanh toán</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#52c41a" }}>
              {filteredPaidStudentInvoices.length}
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">Tổng số buổi</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#1890ff" }}>
              {filteredPaidStudentInvoices
                .reduce((sum, i) => sum + (i.totalSessions || 0), 0)
                .toLocaleString("vi-VN")}
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">Tổng đã thu</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#52c41a" }}>
              {filteredPaidStudentInvoices
                .reduce((sum, i) => sum + (i.finalAmount || 0), 0)
                .toLocaleString("vi-VN")}{" "}
              đ
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">Tổng tiền (trước giảm)</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#52c41a" }}>
              {filteredPaidStudentInvoices
                .reduce((sum, i) => sum + (i.totalAmount || 0), 0)
                .toLocaleString("vi-VN")}{" "}
              đ
            </Title>
          </Card>
        </Col>
      </Row>

      {/* Table - Read only, with revert option */}
      <Table
        columns={paidStudentColumns}
        dataSource={filteredPaidStudentInvoices}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        expandable={{
          expandedRowRender,
          rowExpandable: (record) => record.sessions.length > 0,
        }}
      />
    </Space>
  );

  const teacherTab = (
    <Space direction="vertical" className="w-full">
      {/* Filters */}
      <Card className="mb-4">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Text strong className="block mb-2">
              Tháng
            </Text>
            <DatePicker
              picker="month"
              value={dayjs().month(teacherMonth).year(teacherYear)}
              onChange={(date) => {
                if (date) {
                  setTeacherMonth(date.month());
                  setTeacherYear(date.year());
                }
              }}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong className="block mb-2">
              Biên chế
            </Text>
            <Select
              value={teacherBienCheFilter}
              onChange={setTeacherBienCheFilter}
              style={{ width: "100%" }}
            >
              <Option value="all">Tất cả</Option>
              <Option value="Full-time">Full-time</Option>
              <Option value="Part-time">Part-time</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong className="block mb-2">
              Trạng thái
            </Text>
            <Select
              value={teacherStatusFilter}
              onChange={setTeacherStatusFilter}
              style={{ width: "100%" }}
            >
              <Option value="all">Tất cả</Option>
              <Option value="unpaid">Chưa thanh toán</Option>
              <Option value="paid">Đã thanh toán</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong className="block mb-2">
              Tìm kiếm
            </Text>
            <Input
              placeholder="Tìm theo tên hoặc mã giáo viên..."
              prefix={<SearchOutlined />}
              value={teacherSearchTerm}
              onChange={(e) => setTeacherSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Summary */}
      <Row gutter={16} className="mb-4">
        <Col span={8}>
          <Card>
            <Text type="secondary">Tổng phiếu lương</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#36797f" }}>
              {filteredTeacherSalaries.length}
            </Title>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Text type="secondary">Đã thanh toán</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#52c41a" }}>
              {
                filteredTeacherSalaries.filter((s) => s.status === "paid")
                  .length
              }
            </Title>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Text type="secondary">Tổng chi</Text>
            <Title level={3} style={{ margin: "10px 0", color: "#36797f" }}>
              {filteredTeacherSalaries
                .reduce((sum, s) => sum + s.totalSalary + s.totalAllowance, 0)
                .toLocaleString("vi-VN")}{" "}
              đ
            </Title>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Table
        columns={teacherColumns}
        dataSource={filteredTeacherSalaries}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        expandable={{
          expandedRowRender: expandedTeacherRowRender,
          rowExpandable: (record) => record.sessions.length > 0,
        }}
      />
    </Space>
  );

  return (
    <WrapperContent title="Hóa đơn & Biên nhận">
      <Tabs
        activeKey={activeTab}
        defaultActiveKey="students"
        onChange={(key) => {
          setActiveTab(key);
          if (key === "students") {
            setStudentStatusFilter("unpaid");
            setSelectedRowKeys([]);
          } else if (key === "paid") {
            setStudentStatusFilter("paid");
            setSelectedPaidRowKeys([]);
          }
        }}
        items={[
          {
            key: "students",
            label: "Phiếu thu học phí (Chưa thanh toán)",
            children: studentTab,
          },
          {
            key: "paid",
            label: "Đã thanh toán",
            children: paidStudentTab,
          },
          {
            key: "teachers",
            label: "Phiếu lương giáo viên",
            children: teacherTab,
          },
        ]}
      />

      {/* Edit Invoice Modal - Group by Subject */}
      <Modal
        title="Chỉnh sửa phiếu thu học phí"
        open={editInvoiceModalOpen}
        width={800}
        onCancel={() => {
          setEditInvoiceModalOpen(false);
          setEditingInvoice(null);
          setEditDiscount(0);
          setEditDebt(0);
          setEditSessionPrices({});
          setEditSessionCounts({});
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setEditInvoiceModalOpen(false);
            setEditingInvoice(null);
            setEditDiscount(0);
            setEditDebt(0);
            setEditSessionPrices({});
            setEditSessionCounts({});
          }}>
            Hủy
          </Button>,
          <Button
            key="print"
            icon={<PrinterOutlined />}
            onClick={() => printInvoiceFromEditModal(true)}
          >
            In với giá trị đã chỉnh sửa
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={async () => {
              if (!editingInvoice) return;

              // Build updated sessions array where each session in the invoice
              // gets the price defined by its subject in editSessionPrices.
              // Also build a sessionPrices map keyed by session.id when available,
              // otherwise keyed by an index token so we can still compute totals.
              const sessionBasedPrices: Record<string, number> = {};
              const updatedSessions: AttendanceSession[] = [];

              editingInvoice.sessions.forEach((session: AttendanceSession, idx: number) => {
                const classId = session["Class ID"];
                const classData = classes.find(c => c.id === classId);
                const subject = classData?.["Môn học"] || session["Môn học"] || "Chưa xác định";

                const priceForSubject = editSessionPrices[subject];
                const newPrice = priceForSubject !== undefined ? priceForSubject : (getSafeField(session, "Giá/buổi") || 0);

                // Clone session and set new price
                const updated = {
                  ...session,
                  [sanitizeKey("Giá/buổi")]: newPrice,
                } as AttendanceSession;
                updatedSessions.push(updated);

                const key = session.id || `__idx_${idx}`;
                sessionBasedPrices[key] = newPrice;
              });

              // Tính tổng số buổi từ số buổi đã chỉnh sửa (nếu có)
              // Cần tính toán totalBySubject trước khi sử dụng
              let totalSessionsToSave = editingInvoice.totalSessions;
              if (Object.keys(editSessionCounts).length > 0) {
                // Group sessions by subject để tính totalBySubject
                const subjectGroups: Record<string, {
                  subject: string;
                  sessionCount: number;
                  sessions: AttendanceSession[];
                  currentPrice: number;
                }> = {};

                editingInvoice.sessions.forEach((session: AttendanceSession) => {
                  const classId = session["Class ID"];
                  const classData = classes.find(c => c.id === classId);
                  const subject = classData?.["Môn học"] || session["Môn học"] || "Chưa xác định";

                  if (!subjectGroups[subject]) {
                    subjectGroups[subject] = {
                      subject,
                      sessionCount: 0,
                      sessions: [],
                      currentPrice: editSessionPrices[subject] || (getSafeField(session, "Giá/buổi") || 0),
                    };
                  }

                  subjectGroups[subject].sessionCount++;
                  subjectGroups[subject].sessions.push(session);
                });

                // Lấy số buổi gốc từ database và cho phép chỉnh sửa
                const getOriginalSessionCount = (subject: string, originalCount: number) => {
                  return editSessionCounts[subject] !== undefined ? editSessionCounts[subject] : originalCount;
                };

                const totalBySubject = Object.entries(subjectGroups).map(([subject, data]) => {
                  const editedSessionCount = getOriginalSessionCount(subject, data.sessionCount);
                  return {
                    subject,
                    ...data,
                    sessionCount: editedSessionCount,
                    originalSessionCount: data.sessionCount,
                    total: (editSessionPrices[subject] || data.currentPrice || 0) * editedSessionCount,
                  };
                });

                // Tính tổng số buổi từ các môn học đã chỉnh sửa
                totalSessionsToSave = totalBySubject.reduce((sum, item) => {
                  return sum + item.sessionCount;
                }, 0);
              }

              // Lưu vào database với totalSessions đã chỉnh sửa
              await updateStudentInvoiceWithSessionPrices(
                editingInvoice.id,
                sessionBasedPrices,
                editDiscount,
                updatedSessions,
                editDebt,
                totalSessionsToSave // Truyền totalSessions đã chỉnh sửa
              );

              setEditInvoiceModalOpen(false);
              setEditingInvoice(null);
              setEditDiscount(0);
              setEditDebt(0);
              setEditSessionPrices({});
              setEditSessionCounts({});
            }}
          >
            Lưu
          </Button>,
        ]}
      >
        {editingInvoice && (() => {
          // Group sessions by subject (Môn học)
          const subjectGroups: Record<string, {
            subject: string;
            sessionCount: number;
            sessions: AttendanceSession[];
            currentPrice: number;
          }> = {};

          editingInvoice.sessions.forEach((session: AttendanceSession) => {
            const classId = session["Class ID"];
            const classData = classes.find(c => c.id === classId);
            const subject = classData?.["Môn học"] || session["Môn học"] || "Chưa xác định";

            if (!subjectGroups[subject]) {
              subjectGroups[subject] = {
                subject,
                sessionCount: 0,
                sessions: [],
                currentPrice: editSessionPrices[subject] || (getSafeField(session, "Giá/buổi") || 0),
              };
            }

            subjectGroups[subject].sessionCount++;
            subjectGroups[subject].sessions.push(session);
          });

          // Lấy số buổi gốc từ database và cho phép chỉnh sửa
          const getOriginalSessionCount = (subject: string, originalCount: number) => {
            // Nếu đã có chỉnh sửa, dùng giá trị đã chỉnh sửa, nếu không dùng giá trị gốc
            return editSessionCounts[subject] !== undefined ? editSessionCounts[subject] : originalCount;
          };

          const totalBySubject = Object.entries(subjectGroups).map(([subject, data]) => {
            const editedSessionCount = getOriginalSessionCount(subject, data.sessionCount);
            return {
              subject,
              ...data,
              sessionCount: editedSessionCount, // Dùng số buổi đã chỉnh sửa hoặc gốc
              originalSessionCount: data.sessionCount, // Lưu số buổi gốc để reset
              total: (editSessionPrices[subject] || data.currentPrice || 0) * editedSessionCount,
            };
          });

          return (
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Học sinh: </Text>
                  <Text>{editingInvoice.studentName}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Tháng: </Text>
                  <Text>{`${editingInvoice.month + 1}/${editingInvoice.year}`}</Text>
                </Col>
              </Row>

              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Chi tiết theo môn học ({Object.keys(subjectGroups).length} môn):
                </Text>
                <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid #d9d9d9", borderRadius: 6 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#fafafa", position: "sticky", top: 0 }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #d9d9d9", width: "30%" }}>Môn học</th>
                        <th style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #d9d9d9", width: "12%" }}>Số buổi</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", borderBottom: "1px solid #d9d9d9", width: "20%" }}>Giá/buổi (đ)</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", borderBottom: "1px solid #d9d9d9", width: "20%" }}>Tổng tiền (đ)</th>
                        <th style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #d9d9d9", width: "18%" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totalBySubject.map((item, index) => {
                        // Lấy giá gốc từ database cho môn học này
                        const getOriginalPrice = () => {
                          const firstSession = item.sessions[0];
                          if (!firstSession) return item.currentPrice;
                          
                          const classId = firstSession["Class ID"];
                          const classData = classes.find(c => c.id === classId);
                          const student = students.find(s => s.id === editingInvoice.studentId);
                          
                          if (classData && student) {
                            const hocPhiRieng = getHocPhiRieng(student, classId);
                            if (hocPhiRieng !== null) {
                              return hocPhiRieng;
                            }
                            // Lấy giá từ session hoặc class/course
                            const sessionPrice = getSafeField(firstSession, "Giá/buổi");
                            if (sessionPrice) return Number(sessionPrice);
                            
                            const course = courses.find((c) => {
                              if (c.Khối !== classData.Khối) return false;
                              const classSubject = classData["Môn học"];
                              const courseSubject = c["Môn học"];
                              if (classSubject === courseSubject) return true;
                              const subjectOption = subjectOptions.find(
                                (opt) => opt.label === classSubject || opt.value === classSubject
                              );
                              if (subjectOption) {
                                return courseSubject === subjectOption.label || courseSubject === subjectOption.value;
                              }
                              return false;
                            });
                            return classData?.["Học phí mỗi buổi"] || course?.Giá || 0;
                          }
                          return item.currentPrice;
                        };

                        const originalPrice = getOriginalPrice();
                        const hasCustomPrice = editSessionPrices[item.subject] !== undefined;
                        const isPriceChanged = hasCustomPrice && editSessionPrices[item.subject] !== originalPrice;

                        return (
                          <tr key={item.subject} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: "12px" }}>
                              <Text>{item.subject}</Text>
                            </td>
                            <td style={{ padding: "12px", textAlign: "center" }}>
                              <InputNumber
                                size="small"
                                min={0}
                                value={item.sessionCount}
                                onChange={(value) => {
                                  setEditSessionCounts((prev) => ({
                                    ...prev,
                                    [item.subject]: value || item.originalSessionCount,
                                  }));
                                }}
                                style={{ width: 100 }}
                              />
                            </td>
                            <td style={{ padding: "12px", textAlign: "right" }}>
                              <InputNumber
                                size="small"
                                min={0}
                                value={editSessionPrices[item.subject] ?? item.currentPrice}
                                onChange={(value) => {
                                  setEditSessionPrices((prev) => ({
                                    ...prev,
                                    [item.subject]: value || 0,
                                  }));
                                }}
                                formatter={(value) =>
                                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                                }
                                parser={(value) =>
                                  Number(value!.replace(/\$\s?|(,*)/g, ""))
                                }
                                style={{ width: 140 }}
                              />
                            </td>
                            <td style={{ padding: "12px", textAlign: "right" }}>
                              <Text strong style={{ color: "#1890ff" }}>
                                {((editSessionPrices[item.subject] ?? item.currentPrice) * item.sessionCount).toLocaleString("vi-VN")} đ
                              </Text>
                            </td>
                            <td style={{ padding: "12px", textAlign: "center" }}>
                              {(isPriceChanged || item.sessionCount !== item.originalSessionCount) && (
                                <Button
                                  size="small"
                                  danger
                                  icon={<RollbackOutlined />}
                                  onClick={() => {
                                    // Reset về giá gốc
                                    setEditSessionPrices((prev) => {
                                      const newPrices = { ...prev };
                                      if (originalPrice === item.currentPrice) {
                                        // Nếu giá hiện tại đã là giá gốc, xóa custom price
                                        delete newPrices[item.subject];
                                      } else {
                                        // Set về giá gốc
                                        newPrices[item.subject] = originalPrice;
                                      }
                                      return newPrices;
                                    });
                                    // Reset số buổi về giá trị gốc
                                    setEditSessionCounts((prev) => {
                                      const newCounts = { ...prev };
                                      delete newCounts[item.subject];
                                      return newCounts;
                                    });
                                    const resetMessage = [];
                                    if (isPriceChanged) {
                                      resetMessage.push(`giá về ${originalPrice.toLocaleString("vi-VN")} đ/buổi`);
                                    }
                                    if (item.sessionCount !== item.originalSessionCount) {
                                      resetMessage.push(`số buổi về ${item.originalSessionCount} buổi`);
                                    }
                                    message.success(`Đã reset ${item.subject}: ${resetMessage.join(", ")}`);
                                  }}
                                >
                                  Reset
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Tổng học phí: </Text>
                  <Text style={{ color: "#36797f", fontSize: 15 }}>
                    {totalBySubject
                      .reduce((sum, item) => sum + (item.total || 0), 0)
                      .toLocaleString("vi-VN")}{" "}
                    đ
                  </Text>
                </Col>
                <Col span={12}>
                  <Text strong>Tổng số buổi: </Text>
                  <Text>{totalBySubject.reduce((sum, item) => sum + item.sessionCount, 0)} buổi</Text>
                </Col>
              </Row>

              <div>
                <Text strong style={{ display: "block", marginBottom: 4 }}>
                  Miễn giảm học phí:
                </Text>
                <InputNumber
                  style={{ width: "100%" }}
                  value={editDiscount}
                  onChange={(value) => setEditDiscount(value || 0)}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ""))}
                  addonAfter="đ"
                  min={0}
                  max={totalBySubject.reduce((sum, item) => sum + (item.total || 0), 0)}
                  placeholder="Nhập số tiền miễn giảm"
                />
              </div>

              <div>
                <Text strong style={{ display: "block", marginBottom: 4 }}>
                  Nợ học phí:
                </Text>
                <InputNumber
                  style={{ width: "100%" }}
                  value={editDebt}
                  onChange={(value) => setEditDebt(value || 0)}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ""))}
                  addonAfter="đ"
                  min={0}
                  placeholder="Nhập số tiền nợ học phí"
                />
              </div>

              {(() => {
                // Tính Thành tiền từ totalBySubject (đã chỉnh sửa)
                const totalAmount = totalBySubject.reduce((sum, item) => sum + (item.total || 0), 0);
                const thanhTien = Math.max(0, totalAmount - editDiscount);
                // Tổng nợ lũy kế = Thành tiền + Nợ học phí
                const tongNoLuyKe = thanhTien + editDebt;
                
                return (
                  <>
                    <div style={{ backgroundColor: "#f6ffed", padding: "12px 16px", borderRadius: 6, border: "1px solid #b7eb8f", marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 16 }}>Phải thu (tháng này): </Text>
                      <Text strong style={{ color: "#52c41a", fontSize: 18 }}>
                        {thanhTien.toLocaleString("vi-VN")} đ
                      </Text>
                    </div>

                    <div style={{ backgroundColor: "#fff1f0", padding: "12px 16px", borderRadius: 6, border: "1px solid #ffccc7" }}>
                      <Text strong style={{ fontSize: 16 }}>Tổng nợ lũy kế: </Text>
                      <Text strong style={{ color: "#cf1322", fontSize: 18 }}>
                        {tongNoLuyKe.toLocaleString("vi-VN")} đ
                      </Text>
                      <Text style={{ display: "block", fontSize: 12, color: "#999", marginTop: 4 }}>
                        = Thành tiền ({thanhTien.toLocaleString("vi-VN")} đ) + Nợ học phí ({editDebt.toLocaleString("vi-VN")} đ)
                      </Text>
                    </div>
                  </>
                );
              })()}
            </Space>
          );
        })()}
      </Modal>

      {/* Debt Detail Modal - show breakdown when clicking Tổng nợ lũy kế */}
      <Modal
        title={
          debtDetailModal.studentName
            ? `Chi tiết nợ lũy kế - ${debtDetailModal.studentName}`
            : "Chi tiết nợ lũy kế"
        }
        open={debtDetailModal.visible}
        footer={null}
        onCancel={() =>
          setDebtDetailModal((prev) => ({
            ...prev,
            visible: false,
          }))
        }
      >
        {debtDetailModal.items.length === 0 ? (
          <Empty description="Không có nợ lũy kế" />
        ) : (
          <Table
            size="small"
            pagination={false}
            rowKey={(row) => `${row.year}-${row.month}`}
            dataSource={debtDetailModal.items}
            columns={[
              {
                title: "Tháng",
                dataIndex: "month",
                key: "month",
                render: (_: any, row: any) => `T${(row.month ?? 0) + 1}/${row.year}`,
              },
              {
                title: "Số tiền",
                dataIndex: "amount",
                key: "amount",
                align: "right" as const,
                render: (value: number) => `${value.toLocaleString("vi-VN")} đ`,
              },
            ]}
            footer={() => (
              <div style={{ textAlign: "right", fontWeight: 600 }}>
                Tổng nợ lũy kế:{" "}
                <span style={{ color: "#ff4d4f" }}>
                  {debtDetailModal.total.toLocaleString("vi-VN")} đ
                </span>
              </div>
            )}
          />
        )}
      </Modal>

      {/* Edit Teacher Salary Modal */}
      <Modal
        title="Chỉnh sửa phiếu lương giáo viên"
        open={editTeacherModalOpen}
        width={800}
        onCancel={() => {
          setEditTeacherModalOpen(false);
          setEditingTeacherSalary(null);
          setEditTeacherSessionSalaries({});
        }}
        onOk={async () => {
          if (!editingTeacherSalary) return;

          // Build updated sessions array where each session gets the salary defined by its class
          const sessionBasedSalaries: Record<string, number> = {};
          const updatedSessions: AttendanceSession[] = [];

          editingTeacherSalary.sessions.forEach((session: AttendanceSession) => {
            const classId = session["Class ID"];
            const classKey = `${classId}`; // Use classId as key

            const salaryForClass = editTeacherSessionSalaries[classKey];
            const salaryToUse = salaryForClass !== undefined ? salaryForClass : (getSafeField(session, "Lương/buổi") || 0);

            const updated = {
              ...session,
              [sanitizeKey("Lương/buổi")]: salaryToUse,
            } as AttendanceSession;
            updatedSessions.push(updated);
            sessionBasedSalaries[session.id] = salaryToUse;
          });

          await updateTeacherSalaryWithSessionSalaries(
            editingTeacherSalary.id,
            sessionBasedSalaries,
            updatedSessions
          );

          setEditTeacherModalOpen(false);
          setEditingTeacherSalary(null);
          setEditTeacherSessionSalaries({});
        }}
        okText="Lưu"
        cancelText="Hủy"
      >
        {editingTeacherSalary && (() => {
          // Group sessions by class (Lớp học)
          const classGroups: Record<string, {
            classId: string;
            className: string;
            classCode: string;
            subject: string;
            sessionCount: number;
            sessions: AttendanceSession[];
            currentSalary: number;
          }> = {};

          editingTeacherSalary.sessions.forEach((session: AttendanceSession) => {
            const classId = session["Class ID"];
            const classData = classes.find(c => c.id === classId);
            const className = session["Tên lớp"] || classData?.["Tên lớp"] || "Chưa xác định";
            const classCode = session["Mã lớp"] || classData?.["Mã lớp"] || "";
            const subject = classData?.["Môn học"] || session["Môn học"] || "Chưa xác định";
            const classKey = `${classId}`;

            if (!classGroups[classKey]) {
              classGroups[classKey] = {
                classId,
                className,
                classCode,
                subject,
                sessionCount: 0,
                sessions: [],
                currentSalary: editTeacherSessionSalaries[classKey] || (getSafeField(session, "Lương/buổi") || 0),
              };
            }

            classGroups[classKey].sessionCount++;
            classGroups[classKey].sessions.push(session);
          });

          const totalByClass = Object.entries(classGroups).map(([classKey, data]) => ({
            classKey,
            ...data,
            total: (editTeacherSessionSalaries[classKey] || data.currentSalary || 0) * data.sessionCount,
          }));

          const totalSalary = totalByClass.reduce((sum, item) => sum + (item.total || 0), 0);

          return (
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Giáo viên: </Text>
                  <Text>{editingTeacherSalary.teacherName}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Tháng: </Text>
                  <Text>{`${editingTeacherSalary.month + 1}/${editingTeacherSalary.year}`}</Text>
                </Col>
              </Row>

              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Chi tiết theo lớp học ({Object.keys(classGroups).length} lớp):
                </Text>
                <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid #d9d9d9", borderRadius: 6 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#fafafa", position: "sticky", top: 0 }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #d9d9d9", width: "25%" }}>Lớp học</th>
                        <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #d9d9d9", width: "20%" }}>Môn học</th>
                        <th style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #d9d9d9", width: "12%" }}>Số buổi</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", borderBottom: "1px solid #d9d9d9", width: "23%" }}>Lương/buổi (đ)</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", borderBottom: "1px solid #d9d9d9", width: "20%" }}>Tổng tiền (đ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totalByClass.map((item, index) => (
                        <tr key={item.classKey} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "12px" }}>
                            <Text strong>{item.className}</Text>
                            {item.classCode && (
                              <Text style={{ display: "block", fontSize: 12, color: "#999" }}>({item.classCode})</Text>
                            )}
                          </td>
                          <td style={{ padding: "12px" }}>
                            <Text>{item.subject}</Text>
                          </td>
                          <td style={{ padding: "12px", textAlign: "center" }}>
                            <Tag color="blue">{item.sessionCount} buổi</Tag>
                          </td>
                          <td style={{ padding: "12px", textAlign: "right" }}>
                            <InputNumber
                              size="small"
                              min={0}
                              value={editTeacherSessionSalaries[item.classKey] ?? item.currentSalary}
                              onChange={(value) => {
                                setEditTeacherSessionSalaries((prev) => ({
                                  ...prev,
                                  [item.classKey]: value || 0,
                                }));
                              }}
                              formatter={(value) =>
                                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                              }
                              parser={(value) =>
                                Number(value!.replace(/\$\s?|(,*)/g, ""))
                              }
                              style={{ width: 140 }}
                            />
                          </td>
                          <td style={{ padding: "12px", textAlign: "right" }}>
                            <Text strong style={{ color: "#1890ff" }}>
                              {((editTeacherSessionSalaries[item.classKey] ?? item.currentSalary) * item.sessionCount).toLocaleString("vi-VN")} đ
                            </Text>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Tổng lương: </Text>
                  <Text style={{ color: "#36797f", fontSize: 15 }}>
                    {totalSalary.toLocaleString("vi-VN")} đ
                  </Text>
                </Col>
                <Col span={12}>
                  <Text strong>Tổng số buổi: </Text>
                  <Text>{editingTeacherSalary.sessions.length} buổi</Text>
                </Col>
              </Row>

              <div style={{ backgroundColor: "#f6ffed", padding: "12px 16px", borderRadius: 6, border: "1px solid #b7eb8f" }}>
                <Text strong style={{ fontSize: 16 }}>Tổng thanh toán: </Text>
                <Text strong style={{ color: "#52c41a", fontSize: 18 }}>
                  {totalSalary.toLocaleString("vi-VN")} đ
                </Text>
              </div>
            </Space>
          );
        })()}
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        open={previewOpen}
        title="Xem ảnh hóa đơn"
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        width={800}
      >
        <Image alt="Invoice" style={{ width: "100%" }} src={previewImage} />
      </Modal>
    </WrapperContent>
  );
};

export default InvoicePage;

