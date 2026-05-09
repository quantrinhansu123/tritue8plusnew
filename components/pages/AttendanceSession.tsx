import { useState, useEffect, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Checkbox,
  Input,
  InputNumber,
  Form,
  Space,
  App,
  Steps,
  Modal,
  Tag,
  Popconfirm,
  Empty,
  Upload,
  List,
  TimePicker,
  Row,
  Col,
} from "antd";
import { SaveOutlined, CheckOutlined, GiftOutlined, HistoryOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined, LoginOutlined, LogoutOutlined, UploadOutlined, PaperClipOutlined, FileOutlined, DownloadOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
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
import { useAuth } from "../../contexts/AuthContext";
import { Class, AttendanceSession, AttendanceRecord } from "../../types";
import { subjectOptions } from "@/utils/selectOptions";
import dayjs from "dayjs";
import WrapperContent from "@/components/WrapperContent";
import { uploadToCloudinary, generateFolderPath } from "@/utils/cloudinaryStorage";

interface Student {
  id: string;
  "Họ và tên": string;
  "Mã học sinh": string;
  "SĐT phụ huynh"?: string;
  "Số điện thoại phụ huynh"?: string;
  "SĐT phụ huynh 1"?: string;
  "SDT phụ huynh"?: string;
  "Parent phone"?: string;
}

interface TimetableEntry {
  id: string;
  "Class ID": string;
  "Ngày": string;
  "Thứ": number;
  "Giờ bắt đầu": string;
  "Giờ kết thúc": string;
  "Giờ kết thúc": string;
  "Phòng học"?: string;
}

// Helper to parse attendance data safely
const parseAttendance = (attendance: any): any[] => {
  if (!attendance) return [];
  if (Array.isArray(attendance)) return attendance;
  if (typeof attendance === 'string') {
    try {
      return JSON.parse(attendance);
    } catch (e) {
      return [];
    }
  }
  if (typeof attendance === 'object') {
    return Object.values(attendance);
  }
  return [];
};

const AttendanceSessionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { message } = App.useApp();

  const classData: Class = location.state?.classData;
  const sessionDate: string =
    location.state?.date || dayjs().format("YYYY-MM-DD");

  const [currentStep, setCurrentStep] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [homeworkDescription, setHomeworkDescription] = useState("");
  const [totalExercises, setTotalExercises] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [existingSession, setExistingSession] =
    useState<AttendanceSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [commonTestName, setCommonTestName] = useState<string>("");
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [selectedStudentForRedeem, setSelectedStudentForRedeem] = useState<Student | null>(null);
  const [currentAvailableBonus, setCurrentAvailableBonus] = useState<number>(0);
  const [redeemForm] = Form.useForm();
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);
  const [redeemHistory, setRedeemHistory] = useState<any[]>([]);
  const [isEditRedeemModalOpen, setIsEditRedeemModalOpen] = useState(false);
  const [editingRedeem, setEditingRedeem] = useState<any | null>(null);
  const [editRedeemForm] = Form.useForm();
  const [customSchedule, setCustomSchedule] = useState<TimetableEntry | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false); // Chế độ sửa điểm danh sau khi hoàn thành

  // State lưu báo cáo tháng đã submitted/approved của các học sinh trong session này
  const [monthlyReportsForSession, setMonthlyReportsForSession] = useState<any[]>([]);

  // Bug 8: State cho tài liệu đính kèm bài tập
  const [homeworkAttachments, setHomeworkAttachments] = useState<Array<{
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
  }>>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // State cho nội dung buổi học
  const [lessonContent, setLessonContent] = useState<string>("");
  // State cho tài liệu đính kèm nội dung buổi học
  const [lessonAttachments, setLessonAttachments] = useState<Array<{
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
  }>>([]);
  const [uploadingLessonAttachment, setUploadingLessonAttachment] = useState(false);

  // Bug 9: State cho bài tập buổi trước
  const [previousHomework, setPreviousHomework] = useState<{
    description: string;
    totalExercises: number;
    attachments?: any[];
    date: string;
  } | null>(null);

  // Bug 13: State cho editing check-in/out time
  const [editingCheckTime, setEditingCheckTime] = useState<{
    studentId: string;
    field: "Giờ check-in" | "Giờ check-out";
  } | null>(null);

  // State cho TimePicker Modal
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [selectedTimeData, setSelectedTimeData] = useState<{
    studentId: string;
    field: "Giờ check-in" | "Giờ check-out";
    currentTime: string;
  } | null>(null);
  const [tempTime, setTempTime] = useState<any>(null);

  // Calculate debt from previous unpaid invoices for a student
  const calculateDebtFromPreviousInvoices = (
    studentId: string,
    currentMonth: number,
    currentYear: number,
    existingInvoices: Record<string, any>
  ): number => {
    let totalDebt = 0;

    Object.entries(existingInvoices).forEach(([key, invoice]) => {
      if (!invoice || typeof invoice !== "object") return;

      // Only consider invoices for the current student
      if (invoice.studentId !== studentId) return;

      const invoiceMonth = invoice.month ?? null;
      const invoiceYear = invoice.year ?? null;
      if (invoiceMonth === null || invoiceYear === null) return;

      // Only consider months strictly before the current month/year
      // currentMonth is 0-indexed (0=Jan, 11=Dec)
      const isBeforeCurrentMonth = invoiceYear < currentYear ||
        (invoiceYear === currentYear && invoiceMonth < currentMonth);

      if (isBeforeCurrentMonth) {
        const status = invoice.status || "unpaid";
        // Only count unpaid invoices
        if (status !== "paid") {
          const amount = invoice.finalAmount ?? invoice.totalAmount ?? 0;
          totalDebt += amount;
        }
      }
    });

    return totalDebt;
  };

  // Sync invoices ONLY for students in the current class session being saved
  // This prevents creating invoices for students in other classes
  const syncInvoicesForCurrentSession = async (
    targetMonth: number,
    targetYear: number,
    currentClassId: string,
    currentAttendanceRecords: AttendanceRecord[]
  ) => {
    try {
      const [studentsData, classesData, invoicesData, tuitionData] = await Promise.all([
        supabaseGetAll("datasheet/Học_sinh"),
        supabaseGetAll("datasheet/Lớp_học"),
        supabaseGetAll("datasheet/Phiếu_thu_học_phí_chi_tiết"),
        supabaseGetAll("datasheet/Lớp_học/Học_sinh"), // Load hoc_phi_rieng
      ]);
      // Bảng khoa_hoc chưa tồn tại trong Supabase - bỏ qua để tránh lỗi 404
      const coursesData = null;

      const studentsList = studentsData && typeof studentsData === 'object'
        ? Object.entries(studentsData).map(([id, value]: [string, any]) => {
          const converted = convertFromSupabaseFormat(value, "hoc_sinh");
          return { id, ...converted };
        })
        : [];
      const classesList = classesData && typeof classesData === 'object'
        ? Object.entries(classesData).map(([id, value]: [string, any]) => {
          const converted = convertFromSupabaseFormat(value, "lop_hoc");
          return { id, ...converted };
        })
        : [];
      const coursesList = coursesData
        ? Object.entries(coursesData).map(([id, value]: [string, any]) => ({ id, ...(value as any) }))
        : [];
      const existingInvoices: Record<string, any> = invoicesData || {};

      const studentsMap = Object.fromEntries(studentsList.map((s) => [s.id, s]));
      const classesMap = Object.fromEntries(classesList.map((c) => [c.id, c]));

      // Tạo map để lookup hoc_phi_rieng: key = "student_id-class_id", value = hoc_phi_rieng
      const hocPhiRiengMap = new Map<string, number>();
      if (tuitionData && typeof tuitionData === "object") {
        Object.values(tuitionData).forEach((item: any) => {
          const studentId = item.studentId || item.student_id || "";
          const classId = item.classId || item.class_id || "";
          const rawHocPhiRieng = item.hocPhiRieng ?? item.hoc_phi_rieng;
          const hocPhiRieng = rawHocPhiRieng !== null && rawHocPhiRieng !== undefined
            ? Number(rawHocPhiRieng)
            : null;

          if (studentId && classId && hocPhiRieng !== null && !Number.isNaN(hocPhiRieng)) {
            const key = `${studentId}-${classId}`;
            hocPhiRiengMap.set(key, hocPhiRieng);
          }
        });
      }

      const findCourse = (classInfo: any) => {
        if (!classInfo) return undefined;
        const classSubject = classInfo["Môn học"];
        const classGrade = classInfo["Khối"];
        return coursesList.find((c) => {
          if (c["Khối"] !== classGrade) return false;
          const courseSubject = c["Môn học"];
          if (courseSubject === classSubject) return true;
          const subjectOption = subjectOptions.find(
            (opt) => opt.label === classSubject || opt.value === classSubject
          );
          if (subjectOption) {
            return courseSubject === subjectOption.label || courseSubject === subjectOption.value;
          }
          return false;
        });
      };

      // Get class info and default price for current class
      const classInfo = classesMap[currentClassId];
      const course = findCourse(classInfo);
      const defaultPricePerSession = course?.Giá || classInfo?.["Học phí mỗi buổi"] || 0;

      // Helper function to get price for a specific student and class
      // Priority: hoc_phi_rieng > course?.Giá > classInfo?.["Học phí mỗi buổi"]
      const getPricePerSession = (studentId: string, classId: string): number => {
        // Priority 1: Lấy từ hoc_phi_rieng
        const mapKey = `${studentId}-${classId}`;
        const hocPhiRieng = hocPhiRiengMap.get(mapKey);
        if (hocPhiRieng !== undefined && hocPhiRieng !== null && hocPhiRieng > 0) {
          return hocPhiRieng;
        }
        // Priority 2: Fallback về default price
        return defaultPricePerSession;
      };

      if (defaultPricePerSession === 0 && hocPhiRiengMap.size === 0) {
        console.log("[InvoiceSync] Skipped - no price available for class", currentClassId);
        return;
      }

      const upsertPromises: Promise<void>[] = [];

      // Process ALL students in the attendance records (including absent students)
      currentAttendanceRecords.forEach((record) => {
        const studentId = record["Student ID"];
        const isPresent = record["Có mặt"] === true;
        const isExcused = record["Vắng có phép"] === true;
        const shouldHaveInvoice = isPresent || isExcused;

        if (!studentId) return;

        const student = studentsMap[studentId];
        // Key bao gồm classId để tách riêng hóa đơn cho từng lớp
        const key = `${studentId}-${currentClassId}-${targetMonth + 1}-${targetYear}`;
        const existing = existingInvoices[key];
        const existingStatus = typeof existing === "object" && existing !== null ? existing.status : existing;
        const isPaid = existingStatus === "paid";

        const sessionInfo = {
          Ngày: sessionDate,
          "Tên lớp": classInfo?.["Tên lớp"] || "",
          "Mã lớp": classInfo?.["Mã lớp"] || "",
          "Class ID": currentClassId,
        };

        if (shouldHaveInvoice) {
          // Học sinh có mặt hoặc vắng có phép → thêm vào invoice
          if (existing && typeof existing === "object") {
            // Nếu invoice đã paid, kiểm tra xem buổi này đã có trong invoice chưa
            const existingSessions = Array.isArray(existing.sessions) ? existing.sessions : [];
            const sessionExistsInPaidInvoice = existingSessions.some(
              (s: any) => s["Ngày"] === sessionDate
            );

            if (isPaid) {
              // Invoice đã paid - chỉ tạo invoice bổ sung nếu buổi này chưa được tính
              if (!sessionExistsInPaidInvoice) {
                // Tạo invoice bổ sung với key mới: thêm "-extra" hoặc tìm invoice unpaid cho buổi mới
                const extraKey = `${studentId}-${currentClassId}-${targetMonth + 1}-${targetYear}-extra`;
                const existingExtra = existingInvoices[extraKey];

                if (existingExtra && typeof existingExtra === "object" && existingExtra.status !== "paid") {
                  // Đã có invoice bổ sung, thêm buổi vào
                  const extraSessions = Array.isArray(existingExtra.sessions) ? existingExtra.sessions : [];
                  const sessionExistsInExtra = extraSessions.some((s: any) => s["Ngày"] === sessionDate);
                  if (!sessionExistsInExtra) {
                    // Lấy giá từ hoc_phi_rieng hoặc giữ nguyên giá cũ nếu có
                    const currentPrice = existingExtra.pricePerSession || getPricePerSession(studentId, currentClassId);
                    const updatedInvoice = {
                      id: extraKey,
                      studentId: existingExtra.studentId || studentId,
                      studentName: existingExtra.studentName || student?.["Họ và tên"] || record["Tên học sinh"] || "",
                      studentCode: existingExtra.studentCode || student?.["Mã học sinh"] || "",
                      classId: existingExtra.classId || currentClassId,
                      className: existingExtra.className || classData["Tên lớp"],
                      classCode: existingExtra.classCode || classData["Mã lớp"],
                      subject: existingExtra.subject || classInfo?.["Môn học"] || "",
                      month: existingExtra.month || targetMonth + 1,
                      year: existingExtra.year || targetYear,
                      totalSessions: (existingExtra.totalSessions || 0) + 1,
                      pricePerSession: currentPrice,
                      totalAmount: (existingExtra.totalAmount || 0) + currentPrice,
                      discount: existingExtra.discount || 0,
                      finalAmount: Math.max(0, (existingExtra.totalAmount || 0) + currentPrice - (existingExtra.discount || 0)),
                      status: existingExtra.status || "unpaid",
                      sessions: [...extraSessions, sessionInfo],
                      isExtra: true,
                      parentInvoiceId: key,
                      debt: existingExtra.debt || 0,
                    };
                    upsertPromises.push(supabaseSet("datasheet/Phiếu_thu_học_phí_chi_tiết", updatedInvoice).then(() => { }));
                  }
                } else if (!existingExtra) {
                  // Tạo invoice bổ sung mới
                  // Calculate debt from previous unpaid invoices
                  const debt = calculateDebtFromPreviousInvoices(
                    studentId,
                    targetMonth,
                    targetYear,
                    existingInvoices
                  );

                  // Lấy giá từ hoc_phi_rieng ngay từ đầu
                  const pricePerSessionForStudent = getPricePerSession(studentId, currentClassId);
                  const newExtraInvoice = {
                    id: extraKey,
                    studentId,
                    studentName: student?.["Họ và tên"] || record["Tên học sinh"] || "",
                    studentCode: student?.["Mã học sinh"] || "",
                    classId: currentClassId,
                    className: classInfo?.["Tên lớp"] || "",
                    classCode: classInfo?.["Mã lớp"] || "",
                    subject: classInfo?.["Môn học"] || "",
                    month: targetMonth + 1,
                    year: targetYear,
                    totalSessions: 1,
                    pricePerSession: pricePerSessionForStudent,
                    totalAmount: pricePerSessionForStudent,
                    discount: 0,
                    finalAmount: pricePerSessionForStudent,
                    status: "unpaid",
                    sessions: [sessionInfo],
                    isExtra: true, // Đánh dấu là invoice bổ sung
                    parentInvoiceId: key, // Liên kết với invoice gốc đã paid
                    debt: debt, // Lưu công nợ từ các tháng trước
                  };
                  upsertPromises.push(supabaseSet("datasheet/Phiếu_thu_học_phí_chi_tiết", { id: extraKey, ...newExtraInvoice }).then(() => { }));
                }
              }
              // Không sửa invoice đã paid
              return;
            }

            // Invoice chưa paid - thêm buổi bình thường
            const sessionExists = existingSessions.some(
              (s: any) => s["Ngày"] === sessionDate
            );

            if (!sessionExists) {
              // Lấy giá từ hoc_phi_rieng hoặc giữ nguyên giá cũ nếu có
              const currentPrice = existing.pricePerSession || getPricePerSession(studentId, currentClassId);
              // Tăng total_sessions lên 1 và cập nhật total_amount
              const updatedInvoice = {
                id: key,
                studentId: existing.studentId || studentId,
                studentName: existing.studentName || student?.["Họ và tên"] || record["Tên học sinh"] || "",
                studentCode: existing.studentCode || student?.["Mã học sinh"] || "",
                classId: existing.classId || currentClassId,
                className: existing.className || classInfo?.["Tên lớp"] || "",
                classCode: existing.classCode || classInfo?.["Mã lớp"] || "",
                subject: existing.subject || classInfo?.["Môn học"] || "",
                month: existing.month || targetMonth + 1,
                year: existing.year || targetYear,
                totalSessions: (existing.totalSessions || 0) + 1, // Tăng lên 1
                pricePerSession: currentPrice,
                totalAmount: (existing.totalAmount || 0) + currentPrice, // Cập nhật total_amount
                discount: existing.discount || 0,
                finalAmount: Math.max(0, (existing.totalAmount || 0) + currentPrice - (existing.discount || 0)),
                status: existing.status || "unpaid",
                sessions: [...existingSessions, sessionInfo], // Thêm session mới vào JSONB array
                debt: existing.debt || 0,
              };
              upsertPromises.push(supabaseSet("datasheet/Phiếu_thu_học_phí_chi_tiết", updatedInvoice).then(() => { }));
            }
          } else {
            // Create new invoice
            // Calculate debt from previous unpaid invoices
            const debt = calculateDebtFromPreviousInvoices(
              studentId,
              targetMonth,
              targetYear,
              existingInvoices
            );

            // Lấy giá từ hoc_phi_rieng ngay từ đầu
            const pricePerSessionForStudent = getPricePerSession(studentId, currentClassId);
            const newInvoice = {
              id: key,
              studentId,
              studentName: student?.["Họ và tên"] || record["Tên học sinh"] || "",
              studentCode: student?.["Mã học sinh"] || "",
              classId: currentClassId,
              className: classInfo?.["Tên lớp"] || "",
              classCode: classInfo?.["Mã lớp"] || "",
              subject: classInfo?.["Môn học"] || "",
              month: targetMonth + 1,
              year: targetYear,
              totalSessions: 1,
              pricePerSession: pricePerSessionForStudent,
              totalAmount: pricePerSessionForStudent,
              discount: 0,
              finalAmount: pricePerSessionForStudent,
              status: "unpaid",
              sessions: [sessionInfo],
              debt: debt, // Lưu công nợ từ các tháng trước
            };
            upsertPromises.push(supabaseSet("datasheet/Phiếu_thu_học_phí_chi_tiết", { id: key, ...newInvoice }).then(() => { }));
          }
        } else {
          // Học sinh vắng không phép → xóa session này khỏi invoice nếu có
          // Không xử lý invoice đã paid
          if (isPaid) return;

          if (existing && typeof existing === "object") {
            const existingSessions = Array.isArray(existing.sessions) ? existing.sessions : [];
            const filteredSessions = existingSessions.filter(
              (s: any) => s["Ngày"] !== sessionDate
            );

            if (filteredSessions.length !== existingSessions.length) {
              // Session đã bị xóa
              if (filteredSessions.length === 0) {
                // Xóa invoice hoàn toàn nếu không còn session nào
                upsertPromises.push(supabaseRemove("datasheet/Phiếu_thu_học_phí_chi_tiết", key).then(() => { }));
              } else {
                // Lấy giá từ hoc_phi_rieng hoặc giữ nguyên giá cũ nếu có
                const currentPrice = existing.pricePerSession || getPricePerSession(studentId, currentClassId);
                // Cập nhật invoice với số buổi mới (giảm total_sessions và total_amount)
                const newTotalAmount = currentPrice * filteredSessions.length;
                const updatedInvoice = {
                  id: key,
                  studentId: existing.studentId || studentId,
                  studentName: existing.studentName || student?.["Họ và tên"] || record["Tên học sinh"] || "",
                  studentCode: existing.studentCode || student?.["Mã học sinh"] || "",
                  classId: existing.classId || currentClassId,
                  className: existing.className || classInfo?.["Tên lớp"] || "",
                  classCode: existing.classCode || classInfo?.["Mã lớp"] || "",
                  subject: existing.subject || classInfo?.["Môn học"] || "",
                  month: existing.month || targetMonth + 1,
                  year: existing.year || targetYear,
                  totalSessions: filteredSessions.length, // Giảm số buổi
                  pricePerSession: currentPrice,
                  totalAmount: newTotalAmount, // Cập nhật total_amount
                  discount: existing.discount || 0,
                  finalAmount: Math.max(0, newTotalAmount - (existing.discount || 0)),
                  status: existing.status || "unpaid",
                  sessions: filteredSessions, // Cập nhật sessions array (đã xóa session)
                  debt: existing.debt || 0,
                };
                upsertPromises.push(supabaseSet("datasheet/Phiếu_thu_học_phí_chi_tiết", updatedInvoice).then(() => { }));
              }
            }
          }
        }
      });

      await Promise.all(upsertPromises);
      console.log("[InvoiceSync] Synced invoices for current session", {
        classId: currentClassId,
        month: targetMonth + 1,
        year: targetYear,
        studentsProcessed: currentAttendanceRecords.filter(r => r["Có mặt"] === true).length,
        invoicesCreatedOrUpdated: upsertPromises.length,
      });

      // Auto-update prices from hoc_phi_rieng after syncing invoices
      await updateInvoicePricesFromHocPhiRieng(targetMonth + 1, targetYear);
    } catch (error) {
      console.error("[InvoiceSync] Failed to sync invoices", error);
    }
  };

  // Update invoice prices from hoc_phi_rieng for a specific month/year
  const updateInvoicePricesFromHocPhiRieng = async (targetMonth: number, targetYear: number) => {
    try {
      console.log("[UpdatePrice] Starting to update prices from hoc_phi_rieng", { targetMonth, targetYear });

      // Step 1: Load hoc_phi_rieng từ bảng lop_hoc_hoc_sinh
      const tuitionData = await supabaseGetAll("datasheet/Lớp_học/Học_sinh");

      // Tạo map để lookup nhanh: key = "student_id-class_id", value = hoc_phi_rieng
      const hocPhiRiengMap = new Map<string, number>();
      if (tuitionData && typeof tuitionData === "object") {
        Object.values(tuitionData).forEach((item: any) => {
          const studentId = item.studentId || item.student_id || "";
          const classId = item.classId || item.class_id || "";
          const rawHocPhiRieng = item.hocPhiRieng ?? item.hoc_phi_rieng;
          const hocPhiRieng = rawHocPhiRieng !== null && rawHocPhiRieng !== undefined
            ? Number(rawHocPhiRieng)
            : null;

          if (studentId && classId && hocPhiRieng !== null && !Number.isNaN(hocPhiRieng)) {
            const key = `${studentId}-${classId}`;
            hocPhiRiengMap.set(key, hocPhiRieng);
          }
        });
      }

      // Step 2: Load tất cả invoice details của tháng này
      const allInvoiceDetails = await supabaseGetAll("datasheet/Phiếu_thu_học_phí_chi_tiết") || {};

      const updatePromises: Promise<void>[] = [];
      let updatedCount = 0;
      let checkedCount = 0;

      // Step 3: Cập nhật price_per_session trong phieu_thu_hoc_phi_chi_tiet từ hoc_phi_rieng
      Object.entries(allInvoiceDetails).forEach(([detailId, detailData]: [string, any]) => {
        if (!detailData || typeof detailData !== "object") return;

        // Chỉ xử lý invoices của tháng/năm này
        const invoiceMonth = detailData.month ?? 0;
        const invoiceYear = detailData.year ?? 0;

        if (invoiceMonth !== targetMonth || invoiceYear !== targetYear) {
          return;
        }

        checkedCount++;

        // Lấy student_id và class_id từ detailData
        const studentId = detailData.studentId || detailData.student_id || "";
        const classId = detailData.classId || detailData.class_id || "";

        if (!studentId || !classId) {
          return;
        }

        // Tìm hoc_phi_rieng từ map
        const mapKey = `${studentId}-${classId}`;
        const hocPhiRieng = hocPhiRiengMap.get(mapKey);

        if (hocPhiRieng === undefined || hocPhiRieng === null) {
          // Không có hoc_phi_rieng, giữ nguyên giá hiện tại
          return;
        }

        // Lấy số buổi và discount từ detailData
        const totalSessions = detailData.totalSessions || detailData.total_sessions || 0;
        const discount = detailData.discount || 0;

        // Tính lại totalAmount và finalAmount
        const newTotalAmount = totalSessions * hocPhiRieng;
        const newFinalAmount = Math.max(0, newTotalAmount - discount);

        // Chỉ cập nhật nếu giá thay đổi
        const currentPricePerSession = detailData.pricePerSession || detailData.price_per_session || 0;
        if (currentPricePerSession === hocPhiRieng) {
          return; // Giá không đổi, không cần update
        }

        // Cập nhật price_per_session trong phieu_thu_hoc_phi_chi_tiet
        updatePromises.push(
          supabaseUpdate("datasheet/Phiếu_thu_học_phí_chi_tiết", detailId, {
            pricePerSession: hocPhiRieng,
            totalAmount: newTotalAmount,
            finalAmount: newFinalAmount,
          }).then(() => {
            updatedCount++;
            console.log(`[UpdatePrice] ✅ Updated invoice ${detailId}: price_per_session = ${hocPhiRieng}`);
          }).catch((err) => {
            console.warn(`[UpdatePrice] Failed to update invoice ${detailId}:`, err);
          })
        );
      });

      await Promise.all(updatePromises);
      console.log(`[UpdatePrice] ✅ Updated ${updatedCount}/${checkedCount} invoice details for month ${targetMonth}/${targetYear}`);
    } catch (error) {
      console.error("[UpdatePrice] Failed to update prices from hoc_phi_rieng", error);
    }
  };

  // Sync monthly reports when attendance changes
  // This updates the stats in Nhận_xét_tháng for affected students
  const syncMonthlyReportsForSession = async (
    targetMonth: number, // 0-based
    targetYear: number,
    classId: string,
    className: string,
    affectedStudentIds: string[]
  ) => {
    if (affectedStudentIds.length === 0) return;

    try {
      const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;

      // Get all monthly reports for this month
      const reportsSnapshot = await new Promise<any>((resolve) => {
        const reportsRef = "datasheet/Nhận_xét_tháng";
        supabaseGetAll(reportsRef).then((data) => resolve(data));
      });

      if (!reportsSnapshot) return;

      // Get all attendance sessions for recalculation
      const sessionsSnapshot = await new Promise<any>((resolve) => {
        const sessionsRef = "datasheet/Điểm_danh_sessions";
        supabaseGetAll(sessionsRef).then((data) => resolve(data));
      });

      const allSessions = sessionsSnapshot ? Object.entries(sessionsSnapshot).map(([id, value]: [string, any]) => ({
        id,
        ...value,
      })) : [];

      // Filter sessions for this month and class
      const monthSessions = allSessions.filter((s: any) => {
        const sessionDate = dayjs(s["Ngày"]);
        return sessionDate.month() === targetMonth &&
          sessionDate.year() === targetYear &&
          s["Class ID"] === classId;
      });

      const updatePromises: Promise<void>[] = [];

      // Find and update reports for affected students
      Object.entries(reportsSnapshot).forEach(([reportId, report]: [string, any]) => {
        if (report.month !== monthStr) return;
        if (!affectedStudentIds.includes(report.studentId)) return;
        if (report.status === "approved") return; // Don't modify approved reports

        // Check if this report includes this class
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

        // Find and update the classStats for this class
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

        // Recalculate total stats
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

        updatePromises.push(supabaseUpdate("datasheet/Nhận_xét_tháng", reportId, {
          stats: updatedStats,
          updatedAt: new Date().toISOString(),
        }).then(() => { }));
      });

      await Promise.all(updatePromises);
      console.log("[ReportSync] Synced monthly reports", {
        classId,
        month: monthStr,
        affectedStudents: affectedStudentIds.length,
        reportsUpdated: updatePromises.length,
      });
    } catch (error) {
      console.error("[ReportSync] Failed to sync monthly reports", error);
    }
  };

  // Load custom schedule from Thời_khoá_biểu
  useEffect(() => {
    if (!classData?.id || !sessionDate) return;

    const timetableRef = "datasheet/Thời_khoá_biểu";
    const unsubscribe = supabaseOnValue(timetableRef, (data) => {
      if (data) {
        const entry = Object.entries(data).find(([, value]: [string, any]) =>
          value["Class ID"] === classData.id && value["Ngày"] === sessionDate
        );
        if (entry) {
          setCustomSchedule({ id: entry[0], ...(entry[1] as Omit<TimetableEntry, "id">) });
        } else {
          setCustomSchedule(null);
        }
      }
    });
    return () => unsubscribe();
  }, [classData?.id, sessionDate]);

  // Fetch báo cáo tháng để kiểm tra xem có báo cáo submitted/approved cho tháng của session này không
  useEffect(() => {
    if (!sessionDate || !classData?.id) return;

    const sessionMonth = dayjs(sessionDate).format("YYYY-MM");
    const reportsRef = "datasheet/Nhận_xét_tháng";

    const unsubscribe = supabaseOnValue(reportsRef, (data) => {
      if (data) {
        // Lọc các báo cáo của tháng này, cho lớp này, có status submitted hoặc approved
        const relevantReports = Object.entries(data)
          .filter(([, report]: [string, any]) => {
            return report.month === sessionMonth &&
              report.classIds?.includes(classData.id) &&
              (report.status === "submitted" || report.status === "approved");
          })
          .map(([id, report]: [string, any]) => ({ id, ...report }));

        setMonthlyReportsForSession(relevantReports);
      } else {
        setMonthlyReportsForSession([]);
      }
    });

    return () => unsubscribe();
  }, [sessionDate, classData?.id]);

  useEffect(() => {
    if (!classData) {
      message.error("Không tìm thấy thông tin lớp học");
      navigate("/workspace/attendance");
      return;
    }

    // Check if session already exists for this class and date (only completed sessions)
    // Load một lần khi component mount
    const loadExistingSession = async () => {
      try {
        const sessionsRef = "datasheet/Điểm_danh_sessions";
        const data = await supabaseGetAll(sessionsRef);

        if (data) {
          const sessions = Object.entries(data).map(([id, value]: [string, any]) => {
            const converted = convertFromSupabaseFormat(value, "diem_danh_sessions");
            return {
              id,
              ...converted,
            };
          });

          // Only load completed sessions
          const existing = sessions.find(
            (s) =>
              s["Class ID"] === classData.id &&
              s["Ngày"] === sessionDate
          );

          if (existing) {
            // Chỉ update nếu chưa có existingSession hoặc sessionId khác
            // Tránh ghi đè khi đang edit
            if (!existingSession || existingSession.id !== existing.id) {
              setExistingSession(existing);
              setSessionId(existing.id);

              // Filter attendance records theo enrollment date - chỉ hiển thị học sinh đã đăng ký trước hoặc trong ngày session
              const enrollments = classData["Student Enrollments"] || {};
              const rawAttendance = existing["Điểm danh"] || (existing as any).diem_danh;
              const attendanceList = parseAttendance(rawAttendance);
              const filteredAttendanceRecords = attendanceList.filter((record: AttendanceRecord) => {
                const studentId = record["Student ID"] || (record as any).student_id;
                // Nếu không có enrollment date (backward compatibility), hiển thị học sinh
                if (!enrollments[studentId]) return true;

                // Hiển thị nếu học sinh đã đăng ký trước hoặc trong ngày session (đăng ký ngày 27 thì điểm danh được ngày 27)
                const enrollmentDate = enrollments[studentId].enrollmentDate;
                return enrollmentDate <= sessionDate;
              });

              setAttendanceRecords(filteredAttendanceRecords);
              setLessonContent(existing["Nội dung buổi học"] || "");
              // Load tài liệu đính kèm nội dung buổi học
              setLessonAttachments(existing["Tài liệu nội dung"] || []);
              setHomeworkDescription(existing["Bài tập"]?.["Mô tả"] || "");
              setTotalExercises(existing["Bài tập"]?.["Tổng số bài"] || 0);
              // Bug 8: Load tài liệu đính kèm từ session hiện tại
              setHomeworkAttachments(existing["Bài tập"]?.["Tài liệu đính kèm"] || []);
              if (existing["Trạng thái"] === "completed") {
                setCurrentStep(1); // Go to step 2 to view/edit
              } else {
                setCurrentStep(0); // Stay at step 1 to take attendance
              }
            }
          }
        }
      } catch (error) {
        console.error("Error loading existing session:", error);
      } finally {
        setLoadingSession(false);
      }
    };

    loadExistingSession();
  }, [classData, navigate, sessionDate]); // Bỏ existingSession khỏi dependency

  // Load students - tách riêng để có thể dùng existingSession state
  useEffect(() => {
    if (!classData) return;

    const loadStudents = async () => {
      try {
        const studentsRef = "datasheet/Học_sinh";
        const data = await supabaseGetAll(studentsRef);

        if (data) {
          const allStudents = Object.entries(data).map(([id, value]: [string, any]) => {
            const converted = convertFromSupabaseFormat(value, "hoc_sinh");
            return {
              id,
              ...converted,
            };
          });

          console.log("[AttendanceSession] Loading students for class:", classData.id, {
            sessionDate,
            enrollmentCount: classData["Student IDs"]?.length || 0,
            hasExistingSession: !!existingSession,
            totalStudentsFromDB: allStudents.length
          });

          // Filter students by enrollment date
          const enrollments = classData["Student Enrollments"] || {};
          const studentIdsInClass = Array.isArray(classData["Student IDs"]) ? classData["Student IDs"] : [];
          
          const classStudents = allStudents
            .filter((s) => {
              const studentIdFromDb = s.id;
              const studentCodeFromDb = s["Mã học sinh"];
              
              // Check if student is in class by ID or Code
              const isEnrolled = studentIdsInClass.includes(studentIdFromDb) || 
                                (studentCodeFromDb && studentIdsInClass.includes(studentCodeFromDb));
              
              const rawExistingAttendance = existingSession ? (existingSession["Điểm danh"] || (existingSession as any).diem_danh) : null;
              const existingAttendanceList = parseAttendance(rawExistingAttendance);
              const isMakeupStudent = existingAttendanceList.some((r: any) => {
                const rId = r["Student ID"] || r["Mã học sinh"] || (r as any).student_id;
                return rId === studentIdFromDb || (studentCodeFromDb && rId === studentCodeFromDb);
              });

              if (!isEnrolled && !isMakeupStudent) return false;

              // Nếu đang xem/sửa session cũ, hiển thị TẤT CẢ học sinh đã từng có trong session hoặc đang có trong lớp
              if (existingSession) return true;

              // Nếu tạo mới session, kiểm tra enrollment date
              // Check both ID and Code in enrollments map
              const enrollmentInfo = enrollments[studentIdFromDb] || (studentCodeFromDb ? enrollments[studentCodeFromDb] : null);
              
              if (!enrollmentInfo || !enrollmentInfo.enrollmentDate) {
                // Nếu không có thông tin đăng ký, mặc định cho phép hiển thị để tránh lỗi mất học sinh
                return true;
              }

              const enrollmentDate = enrollmentInfo.enrollmentDate;
              const isEligible = enrollmentDate <= sessionDate;
              
              if (!isEligible) {
                console.log(`[AttendanceSession] Student ${s["Họ và tên"]} (${studentIdFromDb}) filtered out. Enrollment: ${enrollmentDate}, Session: ${sessionDate}`);
              }
              
              return isEligible;
            })
            .map((s) => ({
              ...s,
              id: s.id || s["Mã học sinh"], // Ensure id is set correctly
              "SĐT phụ huynh":
                s["SĐT phụ huynh"] ||
                s["Số điện thoại phụ huynh"] ||
                s["SĐT phụ huynh 1"] ||
                s["SDT phụ huynh"] ||
                s["Parent phone"] ||
                "",
            }));

          console.log("[AttendanceSession] Final students list:", classStudents.length, classStudents.map(s => s["Họ và tên"]));
          setStudents(classStudents);
        }
      } catch (error) {
        console.error("Error loading students:", error);
      }
    };

    loadStudents();
  }, [classData, sessionDate, existingSession]); // Thêm existingSession để reload students khi có session

  // Bug 9: Load bài tập buổi trước
  useEffect(() => {
    if (!classData?.id) return;

    const loadPreviousHomework = async () => {
      try {
        const sessionsRef = "datasheet/Điểm_danh_sessions";
        const data = await supabaseGetAll(sessionsRef);

        if (data) {
          // Lấy tất cả sessions của lớp này
          const classSessions = Object.entries(data)
            .map(([id, value]: [string, any]) => {
              const converted = convertFromSupabaseFormat(value, "diem_danh_sessions");
              return {
                id,
                ...converted,
              };
            })
            .filter((s) =>
              s["Class ID"] === classData.id &&
              s["Trạng thái"] === "completed" &&
              s["Ngày"] < sessionDate // Chỉ lấy buổi trước
            )
            .sort((a, b) => b["Ngày"].localeCompare(a["Ngày"])); // Sắp xếp giảm dần

          if (classSessions.length > 0) {
            const lastSession = classSessions[0];
            if (lastSession["Bài tập"]) {
              setPreviousHomework({
                description: lastSession["Bài tập"]["Mô tả"] || "",
                totalExercises: lastSession["Bài tập"]["Tổng số bài"] || 0,
                attachments: lastSession["Bài tập"]["Tài liệu đính kèm"] || [],
                date: lastSession["Ngày"],
              });
            }
          } else {
            setPreviousHomework(null);
          }
        } else {
          setPreviousHomework(null);
        }
      } catch (error) {
        console.error("Error loading previous homework:", error);
      }
    };

    loadPreviousHomework();
  }, [classData?.id, sessionDate]);

  // Bug 8: Handle upload attachment
  const handleUploadAttachment = async (file: File) => {
    setUploadingAttachment(true);
    try {
      const folderPath = generateFolderPath(classData?.id || "unknown");
      const result = await uploadToCloudinary(file, folderPath);

      if (result.success && result.url) {
        const newAttachment = {
          name: file.name,
          url: result.url,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        };
        setHomeworkAttachments(prev => [...prev, newAttachment]);
        message.success(`Đã tải lên: ${file.name}`);
      } else {
        message.error(result.error || "Lỗi khi tải file");
      }
    } catch (error: any) {
      message.error(`Lỗi upload: ${error.message}`);
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Bug 8: Remove attachment
  const handleRemoveAttachment = (index: number) => {
    setHomeworkAttachments(prev => prev.filter((_, i) => i !== index));
    message.info("Đã xóa tài liệu");
  };

  // Handle upload lesson attachment
  const handleUploadLessonAttachment = async (file: File) => {
    setUploadingLessonAttachment(true);
    try {
      const folderPath = generateFolderPath(classData?.id || "unknown");
      const result = await uploadToCloudinary(file, folderPath);

      if (result.success && result.url) {
        const newAttachment = {
          name: file.name,
          url: result.url,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        };
        setLessonAttachments(prev => [...prev, newAttachment]);
        message.success(`Đã tải lên: ${file.name}`);
      } else {
        message.error(result.error || "Lỗi khi tải file");
      }
    } catch (error: any) {
      message.error(`Lỗi upload: ${error.message}`);
    } finally {
      setUploadingLessonAttachment(false);
    }
  };

  // Remove lesson attachment
  const handleRemoveLessonAttachment = (index: number) => {
    setLessonAttachments(prev => prev.filter((_, i) => i !== index));
    message.info("Đã xóa tài liệu");
  };

  // Handle open time picker modal
  const handleOpenTimeModal = (studentId: string, field: "Giờ check-in" | "Giờ check-out", currentTime: string) => {
    setSelectedTimeData({ studentId, field, currentTime });
    setTempTime(currentTime ? dayjs(currentTime, "HH:mm:ss") : null);
    setTimeModalOpen(true);
  };

  // Handle close time picker modal
  const handleCloseTimeModal = () => {
    setTimeModalOpen(false);
    setSelectedTimeData(null);
    setTempTime(null);
  };

  // Handle confirm time selection
  const handleConfirmTime = () => {
    if (!selectedTimeData) return;

    const newTime = tempTime ? tempTime.format("HH:mm:ss") : "";
    handleUpdateCheckTime(selectedTimeData.studentId, selectedTimeData.field, newTime);
    handleCloseTimeModal();
  };

  // Bug 13: Handle update check time
  const handleUpdateCheckTime = async (
    studentId: string,
    field: "Giờ check-in" | "Giờ check-out",
    newTime: string
  ) => {
    const updatedRecords = attendanceRecords.map((record) => {
      if (record["Student ID"] === studentId) {
        return { ...record, [field]: newTime };
      }
      return record;
    });

    setAttendanceRecords(updatedRecords);
    setEditingCheckTime(null);

    // Lưu ngay vào Firebase nếu đã có session
    if (sessionId) {
      try {
        const sessionRef = "datasheet/Điểm_danh_sessions/${sessionId}/Điểm danh";
        await supabaseSet(sessionRef, updatedRecords);
        message.success(`Đã cập nhật ${field}`);
      } catch (error) {
        console.error("Error updating check time:", error);
        message.error("Lỗi cập nhật thời gian");
      }
    }
  };

  // Initialize attendance records khi students được load và chưa có existing session
  useEffect(() => {
    if (students.length > 0 && !existingSession && attendanceRecords.length === 0) {
      setAttendanceRecords(
        students.map((s) => ({
          "Student ID": s.id,
          "Tên học sinh": s["Họ và tên"],
          "Có mặt": false,
          "Ghi chú": "",
        }))
      );
    }
  }, [students, existingSession, attendanceRecords.length]);

  // Merge học sinh mới vào attendanceRecords khi có existingSession và students thay đổi
  // Đảm bảo học sinh mới thêm vào lớp sau khi điểm danh vẫn xuất hiện trong danh sách
  useEffect(() => {
    if (students.length > 0 && existingSession) {
      setAttendanceRecords(prev => {
        // Nếu chưa có records, không làm gì (sẽ được khởi tạo từ existingSession)
        if (prev.length === 0) return prev;

        const existingStudentIds = new Set(prev.map(r => r["Student ID"]));
        const newStudents = students.filter(s => !existingStudentIds.has(s.id));

        if (newStudents.length > 0) {
          console.log(`🆕 Adding ${newStudents.length} new students to attendance:`, newStudents.map(s => s["Họ và tên"]));
          const newRecords = newStudents.map((s) => ({
            "Student ID": s.id,
            "Tên học sinh": s["Họ và tên"],
            "Có mặt": false,
            "Ghi chú": "",
          }));

          return [...prev, ...newRecords];
        }

        return prev;
      });
    }
  }, [students, existingSession]); // Theo dõi students array

  // Kiểm tra xem đã quá deadline sửa điểm danh chưa
  // Deadline MỚI: Khi đã có báo cáo tháng (submitted/approved) cho lớp này trong tháng của buổi điểm danh
  const isPassedEditDeadline = useMemo(() => {
    // Nếu có bất kỳ báo cáo tháng nào đã submitted hoặc approved cho lớp này trong tháng của session
    // thì không cho phép sửa điểm danh nữa
    return monthlyReportsForSession.length > 0;
  }, [monthlyReportsForSession]);

  // Chế độ chỉ đọc: session đã hoàn thành và (chưa bật chế độ sửa HOẶC đã có báo cáo tháng submitted/approved)
  const isReadOnly = !!(existingSession && existingSession["Trạng thái"] === "completed" && (!isEditingMode || isPassedEditDeadline));

  const handleAttendanceChange = (studentId: string, present: boolean) => {
    setAttendanceRecords((prev) =>
      prev.map((record) =>
        record["Student ID"] === studentId
          ? {
            ...record,
            "Có mặt": present,
            // Tự động ghi giờ check-in khi tick "Có mặt"
            "Giờ check-in": present && !record["Giờ check-in"]
              ? dayjs().format("HH:mm:ss")
              : record["Giờ check-in"]
          }
          : record
      )
    );
  };

  const handleSelectAll = (present: boolean) => {
    const currentTime = dayjs().format("HH:mm:ss");
    setAttendanceRecords((prev) =>
      prev.map((record) => ({
        ...record,
        "Có mặt": present,
        // Tự động ghi giờ check-in khi chọn tất cả "Có mặt"
        "Giờ check-in": present && !record["Giờ check-in"]
          ? currentTime
          : record["Giờ check-in"]
      }))
    );
  };

  const handleLateChange = (studentId: string, late: boolean) => {
    setAttendanceRecords((prev) =>
      prev.map((record) => {
        if (record["Student ID"] === studentId) {
          const updated = { ...record };
          if (late) {
            updated["Đi muộn"] = true;
          } else {
            delete updated["Đi muộn"];
          }
          return updated;
        }
        return record;
      })
    );
  };

  const handleAbsentWithPermissionChange = (
    studentId: string,
    withPermission: boolean
  ) => {
    setAttendanceRecords((prev) =>
      prev.map((record) => {
        if (record["Student ID"] === studentId) {
          const updated = { ...record };
          if (withPermission) {
            updated["Vắng có phép"] = true;
            delete updated["Vắng không phép"]; // Remove unexcused if excused is checked
          } else {
            delete updated["Vắng có phép"];
          }
          return updated;
        }
        return record;
      })
    );
  };

  const handleAbsentWithoutPermissionChange = (
    studentId: string,
    withoutPermission: boolean
  ) => {
    setAttendanceRecords((prev) =>
      prev.map((record) => {
        if (record["Student ID"] === studentId) {
          const updated = { ...record };
          if (withoutPermission) {
            updated["Vắng không phép"] = true;
            delete updated["Vắng có phép"]; // Remove excused if unexcused is checked
          } else {
            delete updated["Vắng không phép"];
          }
          return updated;
        }
        return record;
      })
    );
  };

  // Handle check-out - ghi giờ check-out
  const handleCheckOut = async (studentId: string) => {
    const checkOutTime = dayjs().format("HH:mm:ss");

    setAttendanceRecords((prev) =>
      prev.map((record) =>
        record["Student ID"] === studentId
          ? { ...record, "Giờ check-out": checkOutTime }
          : record
      )
    );

    // Auto-save to Supabase if session exists
    if (sessionId && existingSession) {
      try {
        const updatedAttendance = attendanceRecords.map((record) =>
          record["Student ID"] === studentId
            ? { ...record, "Giờ check-out": checkOutTime }
            : record
        );
        await supabaseUpdate("datasheet/Điểm_danh_sessions", sessionId, {
          "Điểm danh": updatedAttendance,
        });
        message.success("Đã ghi nhận giờ check-out");
      } catch (error) {
        console.error("Error saving check-out time:", error);
        message.error("Không thể lưu giờ check-out");
      }
    }
  };

  // Handle exercises completed change - auto-save to Firebase if session exists
  const handleExercisesCompletedChange = async (
    studentId: string,
    count: number | null
  ) => {
    // Update local state first
    const updatedRecords = attendanceRecords.map((record) => {
      if (record["Student ID"] === studentId) {
        const updated = { ...record };
        if (count !== null && count !== undefined) {
          updated["Bài tập hoàn thành"] = count;
          // Calculate percentage
          const total = totalExercises || 0;
          if (total > 0) {
            updated["% Hoàn thành BTVN"] = Math.round((count / total) * 100);
          }
        } else {
          delete updated["Bài tập hoàn thành"];
          delete updated["% Hoàn thành BTVN"];
        }
        return updated;
      }
      return record;
    });

    setAttendanceRecords(updatedRecords);

    // Auto-save to Firebase if session already exists
    if (sessionId && existingSession) {
      try {
        await supabaseUpdate("datasheet/Điểm_danh_sessions", sessionId, {
          "Điểm danh": updatedRecords,
        });
        message.success("Đã cập nhật bài tập", 1);
      } catch (error) {
        console.error("Error updating exercises:", error);
        message.error("Lỗi khi cập nhật bài tập");
      }
    }
  };

  const handleRemoveMakeupStudent = async (studentId: string) => {
    try {
      const attendanceRecord = attendanceRecords.find(r => r["Student ID"] === studentId);
      if (!attendanceRecord || attendanceRecord["Loại"] !== "Học bù") return;

      const originalSessionId = attendanceRecord["OriginalSessionID"];
      
      // 1. Remove from local state
      const updatedLocalRecords = attendanceRecords.filter(r => r["Student ID"] !== studentId);
      setAttendanceRecords(updatedLocalRecords);

      // 2. Update current session in DB
      if (sessionId && existingSession) {
        await supabaseUpdate("datasheet/Điểm_danh_sessions", sessionId, {
          "Điểm danh": updatedLocalRecords
        });
      }

      // 3. Reset original session flag in DB
      if (originalSessionId) {
        try {
          const originalSessionData = await supabaseGetById("datasheet/Điểm_danh_sessions", originalSessionId);
          if (originalSessionData) {
            const originalAttendance = Array.isArray(originalSessionData["Điểm danh"]) 
              ? originalSessionData["Điểm danh"] 
              : Object.values(originalSessionData["Điểm danh"] || {});
              
            const updatedOriginalAttendance = originalAttendance.map((r: any) => {
              const rId = r["Student ID"] || r["Mã học sinh"];
              if (rId === studentId) {
                const { "Đã xếp lịch bù": _, ...rest } = r;
                return rest;
              }
              return r;
            });
            await supabaseUpdate("datasheet/Điểm_danh_sessions", originalSessionId, {
              "Điểm danh": updatedOriginalAttendance
            });
          }
        } catch (err) {
          console.error("Error resetting original session makeup flag:", err);
        }
      }

      message.success("Đã xóa học sinh học bù và khôi phục trạng thái vắng ở lớp gốc.");
    } catch (error) {
      console.error("Error removing makeup student:", error);
      message.error("Lỗi khi xóa học sinh học bù");
    }
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setAttendanceRecords((prev) =>
      prev.map((record) =>
        record["Student ID"] === studentId
          ? { ...record, "Ghi chú": note }
          : record
      )
    );
  };

  const handleScoreChange = (studentId: string, score: number | null) => {
    setAttendanceRecords((prev) =>
      prev.map((record) => {
        if (record["Student ID"] === studentId) {
          const updated = { ...record };
          if (score !== null && score !== undefined) {
            updated["Điểm"] = score;
          } else {
            delete updated["Điểm"];
          }
          return updated;
        }
        return record;
      })
    );
  };

  // Apply common test name to all students
  const handleApplyCommonTestName = (testName: string) => {
    setCommonTestName(testName);
    setAttendanceRecords((prev) =>
      prev.map((record) => ({
        ...record,
        "Bài kiểm tra": testName,
      }))
    );
  };

  // Handle test score change - auto-save to Firebase if session exists
  const handleTestScoreChange = async (studentId: string, score: number | null) => {
    console.log("🔄 handleTestScoreChange called:", { studentId, score, sessionId, hasExistingSession: !!existingSession });

    // Update local state first
    const updatedRecords = attendanceRecords.map((record) => {
      if (record["Student ID"] === studentId) {
        const updated = { ...record };
        if (score !== null && score !== undefined) {
          updated["Điểm kiểm tra"] = score;
        } else {
          delete updated["Điểm kiểm tra"];
        }
        return updated;
      }
      return record;
    });

    setAttendanceRecords(updatedRecords);

    // Auto-save to Firebase if session already exists
    if (sessionId && existingSession) {
      try {
        console.log("💾 Saving to Firebase:", { sessionId, updatedRecords });
        await supabaseUpdate("datasheet/Điểm_danh_sessions", sessionId, {
          "Điểm danh": updatedRecords,
        });
        console.log("✅ Successfully saved to Firebase");
        message.success("Đã cập nhật điểm", 1);
      } catch (error) {
        console.error("❌ Error updating score:", error);
        message.error("Lỗi khi cập nhật điểm");
      }
    } else {
      console.log("⚠️ Not saving - sessionId:", sessionId, "existingSession:", existingSession);
    }
  };

  // Handle bonus points change - auto-save to Firebase if session exists
  const handleBonusPointsChange = async (studentId: string, points: number | null) => {
    // Update local state first
    const updatedRecords = attendanceRecords.map((record) => {
      if (record["Student ID"] === studentId) {
        const updated = { ...record };
        if (points !== null && points !== undefined) {
          updated["Điểm thưởng"] = points;
        } else {
          delete updated["Điểm thưởng"];
        }
        return updated;
      }
      return record;
    });

    setAttendanceRecords(updatedRecords);

    // Auto-save to Firebase if session already exists
    if (sessionId && existingSession) {
      try {
        await supabaseUpdate("datasheet/Điểm_danh_sessions", sessionId, {
          "Điểm danh": updatedRecords,
        });
        message.success("Đã cập nhật điểm thưởng", 1);
      } catch (error) {
        console.error("Error updating bonus points:", error);
        message.error("Lỗi khi cập nhật điểm thưởng");
      }
    }
  };

  // Helper function to remove undefined values
  const cleanData = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map((item) => cleanData(item));
    }
    if (obj !== null && typeof obj === "object") {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = cleanData(value);
        }
        return acc;
      }, {} as any);
    }
    return obj;
  };

  // Load redeem history for a student
  useEffect(() => {
    if (!isHistoryModalOpen || !selectedStudentForHistory) {
      setRedeemHistory([]);
      return;
    }

    const historyRef = "datasheet/Đổi_thưởng";
    const unsubscribe = supabaseOnValue("history", (data) => {
      if (data) {
        const historyList = Object.entries(data)
          .map(([id, value]) => ({
            id,
            ...(value as any),
          }))
          .filter((item) => item["Student ID"] === selectedStudentForHistory.id)
          .sort((a, b) => {
            const dateA = dayjs(a["Ngày đổi"] || a["Timestamp"]);
            const dateB = dayjs(b["Ngày đổi"] || b["Timestamp"]);
            return dateB.isBefore(dateA) ? -1 : dateB.isAfter(dateA) ? 1 : 0;
          });
        setRedeemHistory(historyList);
      } else {
        setRedeemHistory([]);
      }
    });
    return () => unsubscribe();
  }, [isHistoryModalOpen, selectedStudentForHistory]);

  // ✅ Calculate available bonus points when opening redeem modal
  useEffect(() => {
    if (!isRedeemModalOpen || !selectedStudentForRedeem) {
      setCurrentAvailableBonus(0);
      return;
    }

    const calculateBonus = async () => {
      try {
        // Tính tổng điểm thưởng từ tất cả buổi học
        const sessionsRef = "datasheet/Điểm_danh_sessions";
        const sessionsSnapshot = await new Promise<any>((resolve) => {
          supabaseGetAll(sessionsRef).then((snapshot) => {
            resolve(snapshot.val());
          });
        });

        let calculatedTotalBonus = 0;
        if (sessionsSnapshot) {
          Object.values(sessionsSnapshot).forEach((session: any) => {
            const records = session["Điểm danh"] || [];
            records.forEach((record: any) => {
              if (record["Student ID"] === selectedStudentForRedeem.id) {
                const bonusPoints = Number(record["Điểm thưởng"] || 0);
                calculatedTotalBonus += bonusPoints;
              }
            });
          });
        }

        // Trừ đi tổng điểm đã đổi
        const redeemHistoryRef = "datasheet/Đổi_thưởng";
        const redeemSnapshot = await new Promise<any>((resolve) => {
          supabaseGetAll(redeemHistoryRef).then((snapshot) => {
            resolve(snapshot.val());
          });
        });

        let totalRedeemed = 0;
        if (redeemSnapshot) {
          Object.values(redeemSnapshot).forEach((redeem: any) => {
            if (redeem["Student ID"] === selectedStudentForRedeem.id) {
              totalRedeemed += Number(redeem["Điểm đổi"] || 0);
            }
          });
        }

        const availableBonus = calculatedTotalBonus - totalRedeemed;
        setCurrentAvailableBonus(availableBonus);
      } catch (error) {
        console.error("Error calculating bonus:", error);
        setCurrentAvailableBonus(0);
      }
    };

    calculateBonus();
  }, [isRedeemModalOpen, selectedStudentForRedeem]);

  // Handle redeem points
  const handleRedeemPoints = async () => {
    if (!selectedStudentForRedeem) return;

    try {
      const values = await redeemForm.validateFields();
      const pointsToRedeem = Number(values.points) || 0;
      const note = values.note || "";

      if (pointsToRedeem <= 0) {
        message.error("Điểm đổi thưởng phải lớn hơn 0");
        return;
      }

      // ✅ FIX: Tính tổng điểm thưởng từ tất cả buổi học
      const sessionsRef = "datasheet/Điểm_danh_sessions";
      const sessionsSnapshot = await new Promise<any>((resolve) => {
        supabaseGetAll(sessionsRef).then((snapshot) => {
          resolve(snapshot.val());
        });
      });

      let calculatedTotalBonus = 0;
      if (sessionsSnapshot) {
        Object.values(sessionsSnapshot).forEach((session: any) => {
          const records = session["Điểm danh"] || [];
          records.forEach((record: any) => {
            if (record["Student ID"] === selectedStudentForRedeem.id) {
              const bonusPoints = Number(record["Điểm thưởng"] || 0);
              calculatedTotalBonus += bonusPoints;
            }
          });
        });
      }

      // ✅ FIX: Trừ đi tổng điểm đã đổi trước đó
      const redeemHistoryRef = "datasheet/Đổi_thưởng";
      const redeemSnapshot = await new Promise<any>((resolve) => {
        supabaseGetAll(redeemHistoryRef).then((snapshot) => {
          resolve(snapshot.val());
        });
      });

      let totalRedeemed = 0;
      if (redeemSnapshot) {
        Object.values(redeemSnapshot).forEach((redeem: any) => {
          if (redeem["Student ID"] === selectedStudentForRedeem.id) {
            totalRedeemed += Number(redeem["Điểm đổi"] || 0);
          }
        });
      }

      // ✅ FIX: Tính điểm thưởng còn lại
      const currentTotalBonus = calculatedTotalBonus - totalRedeemed;

      if (pointsToRedeem > currentTotalBonus) {
        message.error(`Không đủ điểm thưởng. Hiện có: ${currentTotalBonus.toFixed(1)} điểm (Tích lũy: ${calculatedTotalBonus.toFixed(1)}, Đã đổi: ${totalRedeemed.toFixed(1)})`);
        return;
      }

      const newTotalBonus = currentTotalBonus - pointsToRedeem;
      const redeemTime = new Date().toISOString();
      const redeemer = userProfile?.displayName || userProfile?.email || "";

      // Save redeem history
      const redeemData = {
        "Student ID": selectedStudentForRedeem.id,
        "Tên học sinh": selectedStudentForRedeem["Họ và tên"],
        "Mã học sinh": selectedStudentForRedeem["Mã học sinh"] || "",
        "Điểm đổi": pointsToRedeem,
        "Ghi chú": note,
        "Ngày đổi": dayjs().format("YYYY-MM-DD"),
        "Thời gian đổi": redeemTime,
        "Người đổi": redeemer,
        "Tổng điểm tích lũy": calculatedTotalBonus,
        "Tổng điểm đã đổi trước đó": totalRedeemed,
        "Tổng điểm trước khi đổi": currentTotalBonus,
        "Tổng điểm sau khi đổi": newTotalBonus,
        Timestamp: redeemTime,
      };

      const newRedeemId = crypto.randomUUID();
      const redeemDataWithId = { ...redeemData, id: newRedeemId };
      await supabaseSet("datasheet/Đổi_thưởng", redeemDataWithId);

      message.success(`Đã đổi ${pointsToRedeem} điểm thưởng. Còn lại: ${newTotalBonus.toFixed(1)} điểm`);
      setIsRedeemModalOpen(false);
      setSelectedStudentForRedeem(null);
      redeemForm.resetFields();
    } catch (error) {
      console.error("Error redeeming points:", error);
      message.error("Có lỗi xảy ra khi đổi thưởng");
    }
  };

  // Handle edit redeem
  const handleEditRedeem = (redeemRecord: any) => {
    setEditingRedeem(redeemRecord);
    editRedeemForm.setFieldsValue({
      points: redeemRecord["Điểm đổi"],
      note: redeemRecord["Ghi chú"],
    });
    setIsEditRedeemModalOpen(true);
  };

  // Handle save edit redeem
  const handleSaveEditRedeem = async () => {
    if (!editingRedeem || !selectedStudentForHistory) return;

    try {
      const values = await editRedeemForm.validateFields();
      const newPoints = Number(values.points) || 0;
      const newNote = values.note || "";
      const oldPoints = Number(editingRedeem["Điểm đổi"] || 0);

      if (newPoints <= 0) {
        message.error("Điểm đổi thưởng phải lớn hơn 0");
        return;
      }

      // Get current student data
      const studentRef = "datasheet/Danh_sách_học_sinh/${selectedStudentForHistory.id}";
      const studentSnapshot = await new Promise<any>((resolve) => {
        supabaseGetAll(studentRef).then((snapshot) => {
          resolve(snapshot.val());
        });
      });

      const currentTotalBonus = Number(studentSnapshot?.["Tổng điểm thưởng"] || 0);

      // Calculate the difference
      // Current total = old total after redeem
      // If we change from 10 to 15: need to subtract 5 more (current - 5)
      // If we change from 10 to 5: need to add 5 back (current + 5)
      const pointsDifference = newPoints - oldPoints;
      const newTotalBonus = currentTotalBonus - pointsDifference;

      if (newTotalBonus < 0) {
        message.error(`Không đủ điểm thưởng. Hiện có: ${currentTotalBonus} điểm, cần thêm: ${Math.abs(newTotalBonus)} điểm`);
        return;
      }

      // Calculate what the total was before the original redeem
      const oldTotalBeforeRedeem = Number(editingRedeem["Tổng điểm trước khi đổi"] || 0);

      // Update redeem record
      const updateTime = new Date().toISOString();
      await supabaseUpdate("datasheet/Đổi_thưởng", editingRedeem.id, {
        "Điểm đổi": newPoints,
        "Ghi chú": newNote,
        "Tổng điểm trước khi đổi": oldTotalBeforeRedeem,
        "Tổng điểm sau khi đổi": newTotalBonus,
        "Thời gian cập nhật": updateTime,
        "Người cập nhật": userProfile?.displayName || userProfile?.email || "",
      });

      // Update student's total bonus points
      await supabaseUpdate("datasheet/Danh_sách_học_sinh", selectedStudentForHistory.id, {
        "Tổng điểm thưởng": newTotalBonus,
      });

      message.success("Đã cập nhật thông tin đổi thưởng");
      setIsEditRedeemModalOpen(false);
      setEditingRedeem(null);
      editRedeemForm.resetFields();
    } catch (error) {
      console.error("Error editing redeem:", error);
      message.error("Có lỗi xảy ra khi cập nhật");
    }
  };

  // Handle delete redeem
  const handleDeleteRedeem = async (redeemRecord: any) => {
    if (!selectedStudentForHistory) return;

    try {
      // Get current student data
      const studentRef = "datasheet/Danh_sách_học_sinh/${selectedStudentForHistory.id}";
      const studentSnapshot = await new Promise<any>((resolve) => {
        supabaseGetAll(studentRef).then((snapshot) => {
          resolve(snapshot.val());
        });
      });

      const currentTotalBonus = Number(studentSnapshot?.["Tổng điểm thưởng"] || 0);
      const pointsToRestore = Number(redeemRecord["Điểm đổi"] || 0);
      const newTotalBonus = currentTotalBonus + pointsToRestore;

      // Delete redeem record
      await supabaseRemove("datasheet/Đổi_thưởng", redeemRecord.id);

      // Restore student's total bonus points
      await supabaseUpdate("datasheet/Danh_sách_học_sinh", selectedStudentForHistory.id, {
        "Tổng điểm thưởng": newTotalBonus,
      });

      message.success(`Đã xóa lần đổi thưởng. Đã hoàn lại ${pointsToRestore} điểm. Tổng điểm hiện tại: ${newTotalBonus}`);
    } catch (error) {
      console.error("Error deleting redeem:", error);
      message.error("Có lỗi xảy ra khi xóa");
    }
  };

  const handleSaveAttendance = () => {
    // Save attendance time info to state (will be saved to Firebase on complete)
    const attendanceTime = new Date().toISOString();
    const attendancePerson =
      userProfile?.displayName || userProfile?.email || "";

    // Store in a way that can be used later
    (window as any).__attendanceInfo = {
      time: attendanceTime,
      person: attendancePerson,
    };

    message.success("Đã lưu điểm danh tạm thời");
    setCurrentStep(1);
  };

  const handleCompleteSession = async () => {
    setSaving(true);
    try {
      // Get schedule info - prioritize custom schedule from Thời_khoá_biểu
      let scheduleStartTime = "";
      let scheduleEndTime = "";

      if (customSchedule) {
        // Use custom schedule from Thời_khoá_biểu
        scheduleStartTime = customSchedule["Giờ bắt đầu"] || "";
        scheduleEndTime = customSchedule["Giờ kết thúc"] || "";
      } else {
        // Fallback to default schedule from class
        const sessionDayjs = dayjs(sessionDate);
        const sessionDayOfWeek = sessionDayjs.day() === 0 ? 8 : sessionDayjs.day() + 1;
        const defaultSchedule = classData["Lịch học"]?.find((s) => s["Thứ"] === sessionDayOfWeek);
        scheduleStartTime = defaultSchedule?.["Giờ bắt đầu"] || "";
        scheduleEndTime = defaultSchedule?.["Giờ kết thúc"] || "";
      }

      const completionTime = new Date().toISOString();
      const completionPerson =
        userProfile?.displayName || userProfile?.email || "";

      // Get attendance info from step 1
      const attendanceInfo = (window as any).__attendanceInfo || {
        time: completionTime,
        person: completionPerson,
      };

      if (sessionId && existingSession) {
        // Update existing session
        console.log("✅ Updating existing attendance session:", {
          sessionId: sessionId,
          "Class ID": existingSession["Class ID"],
          "Tên lớp": existingSession["Tên lớp"],
          "Teacher ID": existingSession["Teacher ID"],
          "Giáo viên": existingSession["Giáo viên"],
          "Ngày": existingSession["Ngày"],
          "Old Trạng thái": existingSession["Trạng thái"],
          "New Trạng thái": "completed"
        });

        const updateData = {
          "Trạng thái": "completed",
          "Điểm danh": attendanceRecords,
          "Thời gian hoàn thành": completionTime,
          "Người hoàn thành": completionPerson,
          "Nội dung buổi học": lessonContent || "",
          "Tài liệu nội dung": lessonAttachments.length > 0 ? lessonAttachments : undefined,
          "Bài tập":
            homeworkDescription || totalExercises || homeworkAttachments.length > 0
              ? {
                "Mô tả": homeworkDescription,
                "Tổng số bài": totalExercises,
                "Người giao": completionPerson,
                "Thời gian giao": completionTime,
                "Tài liệu đính kèm": homeworkAttachments.length > 0 ? homeworkAttachments : undefined,
              }
              : undefined,
        };

        const cleanedData = cleanData(updateData);
        await supabaseUpdate("datasheet/Điểm_danh_sessions", sessionId, cleanedData);
      } else {
        // Create new session (only when completing)
        // ✅ Lấy Teacher ID từ classData (đúng giáo viên của lớp), fallback sang userProfile nếu thiếu
        const teacherId =
          classData["Teacher ID"] ||
          classData["Giáo viên ID"] ||
          userProfile?.teacherId ||
          userProfile?.uid ||
          "";
        const teacherName =
          classData["Giáo viên"] ||
          classData["Tên giáo viên"] ||
          userProfile?.displayName ||
          userProfile?.email ||
          "";

        console.log("✅ Creating new attendance session:", {
          "Class ID": classData.id,
          "Tên lớp": classData["Tên lớp"],
          "Teacher ID (from class)": teacherId,
          "Giáo viên (from class)": teacherName,
          "Ngày": sessionDate,
          "Trạng thái": "completed",
          "👤 Person completing": userProfile?.displayName || userProfile?.email,
        });

        const sessionData: Omit<AttendanceSession, "id"> = {
          "Mã lớp": classData["Mã lớp"],
          "Tên lớp": classData["Tên lớp"],
          "Class ID": classData.id,
          Ngày: sessionDate,
          "Giờ bắt đầu": scheduleStartTime,
          "Giờ kết thúc": scheduleEndTime,
          "Giáo viên": teacherName,
          "Teacher ID": teacherId,
          "Trạng thái": "completed",
          "Điểm danh": attendanceRecords,
          "Thời gian điểm danh": attendanceInfo.time,
          "Người điểm danh": attendanceInfo.person,
          "Thời gian hoàn thành": completionTime,
          "Người hoàn thành": completionPerson,
          "Nội dung buổi học": lessonContent || "",
          "Tài liệu nội dung": lessonAttachments.length > 0 ? lessonAttachments : undefined,
          "Bài tập":
            homeworkDescription || totalExercises || homeworkAttachments.length > 0
              ? {
                "Mô tả": homeworkDescription,
                "Tổng số bài": totalExercises,
                "Người giao": completionPerson,
                "Thời gian giao": completionTime,
                "Tài liệu đính kèm": homeworkAttachments.length > 0 ? homeworkAttachments : undefined,
              }
              : undefined,
          Timestamp: completionTime,
        };

        const cleanedData = cleanData(sessionData);
        // Generate new session ID
        const newSessionId = crypto.randomUUID();
        cleanedData.id = newSessionId;
        await supabaseSet("datasheet/Điểm_danh_sessions", cleanedData);
        setSessionId(newSessionId);
      }

      // After saving attendance, sync invoices ONLY for students in this class session
      const sessionDateObj = new Date(sessionDate);
      if (!isNaN(sessionDateObj.getTime())) {
        // Only sync invoices for students in current attendance records
        await syncInvoicesForCurrentSession(
          sessionDateObj.getMonth(),
          sessionDateObj.getFullYear(),
          classData.id,
          attendanceRecords
        );

        // Sync monthly reports for affected students
        const affectedStudentIds = attendanceRecords.map(r => r["Student ID"]).filter(Boolean) as string[];
        await syncMonthlyReportsForSession(
          sessionDateObj.getMonth(),
          sessionDateObj.getFullYear(),
          classData.id,
          classData["Tên lớp"],
          affectedStudentIds
        );

        // ✅ Xử lý học bù: Cập nhật trạng thái ở buổi học gốc (Lớp chính)
        const makeupStudents = attendanceRecords.filter(r => r["Loại"] === "Học bù" && r["Có mặt"] === true && r["OriginalSessionID"]);
        if (makeupStudents.length > 0) {
          console.log(`🔄 Đang xử lý hoàn thành học bù cho ${makeupStudents.length} học sinh...`);
          for (const studentRecord of makeupStudents) {
            const originalSessionId = studentRecord["OriginalSessionID"];
            const studentId = studentRecord["Student ID"];

            try {
              const originalSessionData = await supabaseGetById("datasheet/Điểm_danh_sessions", originalSessionId);
              if (originalSessionData) {
                // supabaseGetById already converts the data, so we don't need to call convertFromSupabaseFormat again
                const convertedOriginal = originalSessionData;
                const originalAttendance = Array.isArray(convertedOriginal["Điểm danh"])
                  ? convertedOriginal["Điểm danh"]
                  : Object.values(convertedOriginal["Điểm danh"] || {});

                console.log(`🔍 Original attendance records count: ${originalAttendance.length}`);

                let foundStudent = false;
                const updatedOriginalAttendance = originalAttendance.map((r: any) => {
                  const rId = r["Student ID"] || r["Mã học sinh"];
                  if (rId === studentId) {
                    foundStudent = true;
                    return {
                      ...r,
                      "Có mặt": true, // Tích có mặt cho lớp chính như yêu cầu
                      "Vắng có phép": false,
                      "Đã hoàn thành bù": true,
                      "Ghi chú": `${r["Ghi chú"] || ""}\n(Đã học bù tại lớp ${classData["Tên lớp"]} ngày ${dayjs(sessionDate).format("DD/MM/YYYY")})`.trim()
                    };
                  }
                  return r;
                });

                if (foundStudent) {
                  await supabaseUpdate("datasheet/Điểm_danh_sessions", originalSessionId, {
                    "Điểm danh": updatedOriginalAttendance
                  });
                  console.log(`✅ Đã đồng bộ trạng thái về buổi học gốc ${originalSessionId}`);
                  message.info(`Đã đồng bộ điểm danh bù cho ${studentRecord["Tên học sinh"] || studentId}`);
                } else {
                  console.warn(`⚠️ Không tìm thấy học sinh ${studentId} trong buổi học gốc ${originalSessionId}`);
                }
              }
            } catch (err) {
              console.error(`❌ Lỗi đồng bộ bù:`, err);
            }
          }
        }
      } else {
        console.warn("[InvoiceSync] sessionDate is invalid, skipped invoice sync", sessionDate);
      }

      // Clear attendance info
      delete (window as any).__attendanceInfo;

      message.success("Đã hoàn thành buổi học");

      Modal.success({
        title: "Hoàn thành điểm danh",
        content: "Buổi học và dữ liệu đồng bộ đã được lưu thành công!",
        onOk: () => navigate("/workspace/attendance"),
      });
    } catch (error) {
      console.error("Error completing session:", error);
      message.error("Không thể hoàn thành buổi học");
    } finally {
      setSaving(false);
    }
  };

  const attendanceColumns = [
    {
      title: "STT",
      key: "index",
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "Mã học sinh",
      dataIndex: "Mã học sinh",
      key: "code",
      width: 120,
      render: (_: any, record: Student) => record["Mã học sinh"],
    },
    {
      title: "Họ và tên",
      dataIndex: "Họ và tên",
      key: "name",
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(r => r["Student ID"] === record.id);
        const isMakeup = attendanceRecord?.["Loại"] === "Học bù";
        return (
          <div>
            <Space>
              <span style={{ fontWeight: isMakeup ? 600 : 400 }}>{record["Họ và tên"]}</span>
              {isMakeup && (
                <Space size={4}>
                  <Tag color="volcano">Học bù</Tag>
                  {attendanceRecord?.["OriginalClassName"] && (
                    <Tag color="orange" style={{ fontSize: "10px" }}>
                      Lớp: {attendanceRecord["OriginalClassName"]}
                    </Tag>
                  )}
                </Space>
              )}
            </Space>
            {(record["SĐT phụ huynh"] || record["Số điện thoại phụ huynh"] || record["SĐT phụ huynh 1"] || record["SDT phụ huynh"] || record["Parent phone"]) && (
              <div style={{ fontSize: "11px", color: "#666" }}>
                📞 {record["SĐT phụ huynh"] || record["Số điện thoại phụ huynh"] || record["SĐT phụ huynh 1"] || record["SDT phụ huynh"] || record["Parent phone"]}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Có mặt",
      key: "present",
      width: 100,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        return (
          <Checkbox
            checked={attendanceRecord?.["Có mặt"]}
            onChange={(e) =>
              handleAttendanceChange(record.id, e.target.checked)
            }
            disabled={currentStep !== 0}
          />
        );
      },
    },
    {
      title: "Giờ check-in",
      key: "checkin",
      width: 140,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        if (!attendanceRecord?.["Có mặt"]) return "-";

        // When in edit mode, show clickable tag to open modal
        if (isEditingMode && !isReadOnly) {
          return (
            <Button
              type="text"
              size="small"
              onClick={() => handleOpenTimeModal(record.id, "Giờ check-in", attendanceRecord["Giờ check-in"] || "")}
              style={{ padding: 0 }}
            >
              {attendanceRecord?.["Giờ check-in"] ? (
                <Tag icon={<LoginOutlined />} color="success" style={{ cursor: "pointer" }}>
                  {attendanceRecord["Giờ check-in"]}
                </Tag>
              ) : (
                <Tag color="default" style={{ cursor: "pointer" }}>Chưa check-in</Tag>
              )}
            </Button>
          );
        }

        return attendanceRecord?.["Giờ check-in"] ? (
          <Tag
            icon={<LoginOutlined />}
            color="success"
            style={{ cursor: isReadOnly ? "default" : "pointer" }}
            onClick={() => !isReadOnly && handleOpenTimeModal(record.id, "Giờ check-in", attendanceRecord["Giờ check-in"] || "")}
          >
            {attendanceRecord["Giờ check-in"]}
          </Tag>
        ) : (
          <Tag color="default">Chưa check-in</Tag>
        );
      },
    },
    {
      title: "Check-out",
      key: "checkout",
      width: 160,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        if (!attendanceRecord?.["Có mặt"] || !attendanceRecord?.["Giờ check-in"]) return "-";

        // When in edit mode, show clickable tag to open modal
        if (isEditingMode && !isReadOnly) {
          return (
            <span
              onClick={() => handleOpenTimeModal(record.id, "Giờ check-out", attendanceRecord["Giờ check-out"] || "")}
              style={{ cursor: "pointer", display: "inline-block" }}
            >
              {attendanceRecord?.["Giờ check-out"] ? (
                <Tag icon={<LogoutOutlined />} color="warning" style={{ cursor: "pointer" }}>
                  {attendanceRecord["Giờ check-out"]}
                </Tag>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  icon={<LogoutOutlined />}
                >
                  Check-out
                </Button>
              )}
            </span>
          );
        }

        if (attendanceRecord?.["Giờ check-out"]) {
          return (
            <Tag
              icon={<LogoutOutlined />}
              color="warning"
              style={{ cursor: isReadOnly ? "default" : "pointer" }}
              onClick={() => !isReadOnly && handleOpenTimeModal(record.id, "Giờ check-out", attendanceRecord["Giờ check-out"] || "")}
            >
              {attendanceRecord["Giờ check-out"]}
            </Tag>
          );
        }

        return (
          <Button
            size="small"
            type="primary"
            icon={<LogoutOutlined />}
            onClick={() => handleCheckOut(record.id)}
            disabled={isReadOnly}
          >
            Check-out
          </Button>
        );
      },
    },
    {
      title: "Ghi chú",
      key: "note",
      width: 200,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        return (
          <Input
            placeholder="Ghi chú"
            value={attendanceRecord?.["Ghi chú"]}
            onChange={(e) => handleNoteChange(record.id, e.target.value)}
            disabled={currentStep !== 0}
          />
        );
      },
    },
    {
      title: "Thao tác",
      key: "action",
      width: 100,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(r => r["Student ID"] === record.id);
        const isMakeup = attendanceRecord?.["Loại"] === "Học bù";
        
        if (isMakeup && !isReadOnly) {
          return (
            <Popconfirm
              title="Xóa học sinh bù"
              description="Bạn có muốn xóa học sinh này khỏi buổi học bù không? Trạng thái vắng ở lớp cũ sẽ được khôi phục."
              onConfirm={() => handleRemoveMakeupStudent(record.id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small">Xóa</Button>
            </Popconfirm>
          );
        }
        return null;
      }
    },
  ];

  const homeworkColumns = [
    ...attendanceColumns.slice(0, 3),
    {
      title: "Có mặt",
      key: "present",
      width: 80,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        return (
          <Checkbox
            checked={attendanceRecord?.["Có mặt"] || false}
            onChange={(e) => handleAttendanceChange(record.id, e.target.checked)}
            disabled={isReadOnly}
          />
        );
      },
    },
    {
      title: "Đi muộn",
      key: "late",
      width: 90,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        if (!attendanceRecord?.["Có mặt"]) return "-";
        return (
          <Checkbox
            checked={attendanceRecord?.["Đi muộn"] || false}
            onChange={(e) => handleLateChange(record.id, e.target.checked)}
            disabled={isReadOnly}
          />
        );
      },
    },
    {
      title: "Giờ check-in",
      key: "checkin",
      width: 110,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        if (!attendanceRecord?.["Có mặt"]) return "-";

        // When in edit mode, show clickable tag to open modal
        if (isEditingMode && !isReadOnly) {
          return (
            <Button
              type="text"
              size="small"
              onClick={() => handleOpenTimeModal(record.id, "Giờ check-in", attendanceRecord["Giờ check-in"] || "")}
              style={{ padding: 0 }}
            >
              {attendanceRecord?.["Giờ check-in"] ? (
                <Tag icon={<LoginOutlined />} color="success" style={{ fontSize: "11px", cursor: "pointer" }}>
                  {attendanceRecord["Giờ check-in"]}
                </Tag>
              ) : (
                <Tag color="default" style={{ fontSize: "11px", cursor: "pointer" }}>Chưa check-in</Tag>
              )}
            </Button>
          );
        }

        return attendanceRecord?.["Giờ check-in"] ? (
          <Tag icon={<LoginOutlined />} color="success" style={{ fontSize: "11px" }}>
            {attendanceRecord["Giờ check-in"]}
          </Tag>
        ) : (
          <Tag color="default" style={{ fontSize: "11px" }}>Chưa check-in</Tag>
        );
      },
    },
    {
      title: "Check-out",
      key: "checkout",
      width: 120,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        if (!attendanceRecord?.["Có mặt"] || !attendanceRecord?.["Giờ check-in"]) return "-";

        // When in edit mode, show clickable tag to open modal
        if (isEditingMode && !isReadOnly) {
          return (
            <span
              onClick={() => handleOpenTimeModal(record.id, "Giờ check-out", attendanceRecord["Giờ check-out"] || "")}
              style={{ cursor: "pointer", display: "inline-block" }}
            >
              {attendanceRecord?.["Giờ check-out"] ? (
                <Tag icon={<LogoutOutlined />} color="warning" style={{ fontSize: "11px", cursor: "pointer" }}>
                  {attendanceRecord["Giờ check-out"]}
                </Tag>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  icon={<LogoutOutlined />}
                  style={{ fontSize: "11px", padding: "0 8px", height: "24px" }}
                >
                  Check-out
                </Button>
              )}
            </span>
          );
        }

        if (attendanceRecord?.["Giờ check-out"]) {
          return (
            <Tag icon={<LogoutOutlined />} color="warning" style={{ fontSize: "11px" }}>
              {attendanceRecord["Giờ check-out"]}
            </Tag>
          );
        }

        return (
          <Button
            size="small"
            type="primary"
            icon={<LogoutOutlined />}
            onClick={() => handleCheckOut(record.id)}
            disabled={isReadOnly}
            style={{ fontSize: "11px", padding: "0 8px", height: "24px" }}
          >
            Check-out
          </Button>
        );
      },
    },
    {
      title: "Vắng có phép",
      key: "permission",
      width: 110,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        if (attendanceRecord?.["Có mặt"]) return "-";
        return (
          <Checkbox
            checked={attendanceRecord?.["Vắng có phép"] || false}
            onChange={(e) =>
              handleAbsentWithPermissionChange(record.id, e.target.checked)
            }
            disabled={isReadOnly}
          />
        );
      },
    },
    {
      title: "Vắng không phép",
      key: "no-permission",
      width: 130,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        if (attendanceRecord?.["Có mặt"]) return "-";
        return (
          <Checkbox
            checked={attendanceRecord?.["Vắng không phép"] || false}
            onChange={(e) =>
              handleAbsentWithoutPermissionChange(record.id, e.target.checked)
            }
            disabled={isReadOnly}
          />
        );
      },
    },
    {
      title: (
        <Space direction="vertical" size={0}>
          <span>Bài tập hoàn thành</span>
          {previousHomework && (
            <span style={{ fontSize: 11, color: "#888", fontWeight: "normal" }}>
              (Buổi {dayjs(previousHomework.date).format("DD/MM")})
            </span>
          )}
        </Space>
      ),
      key: "exercises",
      width: 160,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        if (!attendanceRecord?.["Có mặt"]) return "-";

        const completed = attendanceRecord?.["Bài tập hoàn thành"] ?? 0;
        // Bug 9: Sử dụng tổng số bài từ buổi trước thay vì buổi hiện tại
        const total = previousHomework?.totalExercises || totalExercises || 0;

        return (
          <Space.Compact style={{ width: "100%" }}>
            <InputNumber
              min={0}
              max={total || 100}
              placeholder="0"
              value={completed || null}
              onChange={(value) =>
                handleExercisesCompletedChange(record.id, value)
              }
              onBlur={() => {
                // Ensure save on blur
                const currentRecord = attendanceRecords.find(
                  (r) => r["Student ID"] === record.id
                );
                if (currentRecord && sessionId && existingSession) {
                  handleExercisesCompletedChange(record.id, currentRecord["Bài tập hoàn thành"] ?? null);
                }
              }}
              style={{ width: "50%" }}
              disabled={isReadOnly}
            />
            <Input
              value={`/ ${total}`}
              disabled
              style={{
                width: "50%",
                textAlign: "center",
                backgroundColor: "#f5f5f5",
                color: "#000"
              }}
            />
          </Space.Compact>
        );
      },
    },
    {
      title: "Bài kiểm tra",
      key: "test_name",
      width: 150,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        return (
          <span style={{ color: attendanceRecord?.["Bài kiểm tra"] ? "#000" : "#ccc" }}>
            {attendanceRecord?.["Bài kiểm tra"] || "(Chưa có)"}
          </span>
        );
      },
    },
    {
      title: "Điểm kiểm tra",
      key: "test_score",
      width: 120,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        // Allow input even for absent students
        return (
          <InputNumber
            min={0}
            max={10}
            step={0.5}
            placeholder="Điểm"
            value={attendanceRecord?.["Điểm kiểm tra"] ?? null}
            // Parser: Chuyển đổi dấu phẩy thành dấu chấm để hỗ trợ nhập số thập phân kiểu Việt Nam (8,5 -> 8.5)
            parser={(value) => {
              if (!value) return null as any;
              // Thay thế dấu phẩy bằng dấu chấm
              const parsed = parseFloat(value.replace(',', '.'));
              return isNaN(parsed) ? null as any : parsed;
            }}
            // Formatter: Hiển thị số với dấu chấm (chuẩn)
            formatter={(value) => {
              if (value === null || value === undefined) return '';
              return String(value);
            }}
            onChange={(value) => handleTestScoreChange(record.id, value)}
            onBlur={() => {
              // Ensure save on blur
              const currentRecord = attendanceRecords.find(
                (r) => r["Student ID"] === record.id
              );
              if (currentRecord && sessionId && existingSession) {
                handleTestScoreChange(record.id, currentRecord["Điểm kiểm tra"] ?? null);
              }
            }}
            style={{ width: "100%" }}
          />
        );
      },
    },
    {
      title: "Điểm thưởng",
      key: "bonus_points",
      width: 110,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        // Allow input even for absent students
        return (
          <InputNumber
            min={0}
            step={1}
            placeholder="Điểm"
            value={attendanceRecord?.["Điểm thưởng"] ?? null}
            onChange={(value) => handleBonusPointsChange(record.id, value)}
            style={{ width: "100%" }}
            disabled={isReadOnly}
          />
        );
      },
    },
    {
      title: "Ghi chú",
      key: "note",
      width: 150,
      render: (_: any, record: Student) => {
        const attendanceRecord = attendanceRecords.find(
          (r) => r["Student ID"] === record.id
        );
        return (
          <Input
            placeholder="Ghi chú"
            value={attendanceRecord?.["Ghi chú"]}
            onChange={(e) => handleNoteChange(record.id, e.target.value)}
            disabled={isReadOnly}
          />
        );
      },
    },
    {
      title: "Đổi thưởng",
      key: "redeem",
      width: 150,
      render: (_: any, record: Student) => {
        return (
          <Space>
            <Button
              size="small"
              icon={<GiftOutlined />}
              onClick={() => {
                setSelectedStudentForRedeem(record);
                redeemForm.resetFields();
                setIsRedeemModalOpen(true);
              }}
            >
              Đổi thưởng
            </Button>
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => {
                setSelectedStudentForHistory(record);
                setIsHistoryModalOpen(true);
              }}
            >
              Lịch sử
            </Button>
          </Space>
        );
      },
    },
  ];

  if (!classData) {
    return null;
  }

  const presentCount = attendanceRecords.filter((r) => r["Có mặt"]).length;
  const absentCount = attendanceRecords.length - presentCount;

  return (
    <WrapperContent title="Điểm danh" isLoading={loadingSession}>
      {/* Thông báo đã khóa sửa điểm danh do có báo cáo tháng đã gửi/duyệt */}
      {existingSession && isPassedEditDeadline && (
        <Card
          style={{
            marginBottom: 16,
            backgroundColor: "#fff1f0",
            borderColor: "#ffa39e",
          }}
          size="small"
        >
          <p style={{ margin: 0, color: "#cf1322" }}>
            🔒 <strong>Đã khóa sửa điểm danh!</strong> Tháng {dayjs(sessionDate).format("MM/YYYY")} đã có báo cáo được gửi hoặc duyệt ({monthlyReportsForSession.length} báo cáo).
            Để sửa điểm danh, cần xóa duyệt hoặc hủy gửi báo cáo tháng trước.
          </p>
        </Card>
      )}

      {/* Thông báo còn có thể sửa điểm danh */}
      {existingSession && existingSession["Trạng thái"] === "completed" && !isEditingMode && !isPassedEditDeadline && (
        <Card
          style={{
            marginBottom: 16,
            backgroundColor: "#f6ffed",
            borderColor: "#b7eb8f",
          }}
          size="small"
        >
          <p style={{ margin: 0 }}>
            ✅ Buổi học này đã hoàn thành điểm danh. Có thể chỉnh sửa cho đến khi báo cáo tháng được gửi hoặc duyệt.
          </p>
        </Card>
      )}

      {existingSession && isEditingMode && (
        <Card
          style={{
            marginBottom: 16,
            backgroundColor: "#fff7e6",
            borderColor: "#ffd591",
          }}
          size="small"
        >
          <p style={{ margin: 0 }}>
            ✏️ Đang chỉnh sửa điểm danh. Nhấn "Cập nhật điểm danh" khi hoàn tất.
          </p>
        </Card>
      )}

      <Card
        title={
          <div>
            <h2 style={{ margin: 0 }}>{classData["Tên lớp"]}</h2>
            <p style={{ margin: "8px 0 0 0", color: "#666", fontSize: "14px" }}>
              {dayjs(sessionDate).format("dddd, DD/MM/YYYY")}
            </p>
          </div>
        }
      >
        <Steps
          current={currentStep}
          items={[
            {
              title: "Điểm danh",
              description: "Ghi nhận học sinh có mặt",
            },
            {
              title: "Giao bài tập",
              description: "Chấm điểm và giao bài tập",
            },
          ]}
          style={{ marginBottom: 32 }}
        />

        {currentStep === 0 && (
          <div>
            <div
              style={{
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Space>
                <span>Tổng: {students.length}</span>
                <span style={{ color: "green" }}>Có mặt: {presentCount}</span>
                <span style={{ color: "red" }}>Vắng: {absentCount}</span>
              </Space>
              <Space>
                <Button
                  size="small"
                  onClick={() => handleSelectAll(true)}
                  icon={<CheckOutlined />}
                >
                  Chọn tất cả
                </Button>
                <Button size="small" onClick={() => handleSelectAll(false)}>
                  Bỏ chọn tất cả
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveAttendance}
                >
                  Tiếp tục
                </Button>
              </Space>
            </div>

            <Table
              columns={attendanceColumns}
              dataSource={students}
              rowKey="id"
              pagination={false}
            />
          </div>
        )}

        {currentStep === 1 && (
          <div>
            {/* Bug 9: Hiển thị bài tập buổi trước */}
            {previousHomework && (
              <Card
                title={
                  <Space>
                    <FileOutlined />
                    <span>Bài tập buổi trước ({dayjs(previousHomework.date).format("DD/MM/YYYY")})</span>
                  </Space>
                }
                size="small"
                style={{ marginBottom: 16, background: "#fff7e6", borderColor: "#ffd591" }}
              >
                <p><strong>Mô tả:</strong> {previousHomework.description || "Không có mô tả"}</p>
                <p><strong>Tổng số bài:</strong> {previousHomework.totalExercises} bài</p>
                {previousHomework.attachments && previousHomework.attachments.length > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <strong>Tài liệu:</strong>
                      {previousHomework.attachments.length > 1 && (
                        <Button
                          type="link"
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={() => {
                            previousHomework.attachments.forEach((item: any) => {
                              const link = document.createElement('a');
                              link.href = item.url;
                              link.download = item.name;
                              link.target = '_blank';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              setTimeout(() => { }, 200);
                            });
                          }}
                        >
                          Tải tất cả
                        </Button>
                      )}
                    </div>
                    <List
                      size="small"
                      dataSource={previousHomework.attachments}
                      renderItem={(item: any) => {
                        const getShortFileName = (fileName: string) => {
                          const parts = fileName.split('/');
                          let name = parts[parts.length - 1];
                          if (name.length > 30) {
                            const ext = name.substring(name.lastIndexOf('.'));
                            const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
                            return nameWithoutExt.substring(0, 25) + '...' + ext;
                          }
                          return name;
                        };
                        const shortName = getShortFileName(item.name);

                        return (
                          <List.Item>
                            <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.name} download={item.name}>
                              <PaperClipOutlined /> {shortName}
                            </a>
                          </List.Item>
                        );
                      }}
                    />
                  </div>
                )}
              </Card>
            )}

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col xs={24} md={12}>
                <Card title="Nội dung buổi học" style={{ height: "100%" }}>
                  <Form layout="vertical">
                    <Form.Item label="Nội dung đã dạy">
                      <Input.TextArea
                        rows={4}
                        placeholder="Nhập nội dung buổi học (ví dụ: Bài 1 - Phương trình bậc nhất, Bài tập 1-5 trang 20)..."
                        value={lessonContent}
                        onChange={(e) => setLessonContent(e.target.value)}
                        disabled={isReadOnly}
                      />
                    </Form.Item>
                    <Form.Item label="Tài liệu nội dung">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Upload
                          beforeUpload={(file) => {
                            handleUploadLessonAttachment(file);
                            return false; // Prevent default upload
                          }}
                          showUploadList={false}
                          disabled={isReadOnly || uploadingLessonAttachment}
                        >
                          <Button
                            icon={<UploadOutlined />}
                            loading={uploadingLessonAttachment}
                            disabled={isReadOnly}
                            block
                          >
                            {uploadingLessonAttachment ? "Đang tải lên..." : "Tải lên tài liệu"}
                          </Button>
                        </Upload>

                        {lessonAttachments.length > 0 && (
                          <>
                            {lessonAttachments.length > 1 && (
                              <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                block
                                onClick={() => {
                                  lessonAttachments.forEach((item) => {
                                    const link = document.createElement('a');
                                    link.href = item.url;
                                    link.download = item.name;
                                    link.target = '_blank';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    setTimeout(() => { }, 200);
                                  });
                                }}
                                style={{ marginBottom: 8 }}
                              >
                                Tải tất cả ({lessonAttachments.length} file)
                              </Button>
                            )}
                            <List
                              size="small"
                              bordered
                              dataSource={lessonAttachments}
                              renderItem={(item, index) => {
                                const getShortFileName = (fileName: string) => {
                                  const parts = fileName.split('/');
                                  let name = parts[parts.length - 1];
                                  if (name.length > 30) {
                                    const ext = name.substring(name.lastIndexOf('.'));
                                    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
                                    return nameWithoutExt.substring(0, 25) + '...' + ext;
                                  }
                                  return name;
                                };
                                const shortName = getShortFileName(item.name);

                                return (
                                  <List.Item
                                    actions={!isReadOnly ? [
                                      <Button
                                        type="link"
                                        danger
                                        size="small"
                                        onClick={() => handleRemoveLessonAttachment(index)}
                                      >
                                        Xóa
                                      </Button>
                                    ] : []}
                                  >
                                    <Space>
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={item.name}
                                        title={item.name}
                                      >
                                        <PaperClipOutlined /> {shortName}
                                      </a>
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        href={item.url}
                                        download={item.name}
                                      >
                                        Tải
                                      </Button>
                                    </Space>
                                  </List.Item>
                                );
                              }}
                            />
                          </>
                        )}
                      </Space>
                    </Form.Item>
                  </Form>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Bài tập về nhà" style={{ height: "100%" }}>
                  <Form layout="vertical">
                    <Form.Item label="Mô tả bài tập">
                      <Input.TextArea
                        rows={3}
                        placeholder="Nhập mô tả bài tập..."
                        value={homeworkDescription}
                        onChange={(e) => setHomeworkDescription(e.target.value)}
                        disabled={isReadOnly}
                      />
                    </Form.Item>
                    <Form.Item label="Tổng số bài tập">
                      <InputNumber
                        min={0}
                        placeholder="Số lượng bài tập"
                        value={totalExercises}
                        onChange={(value) => setTotalExercises(value || 0)}
                        style={{ width: "100%" }}
                        disabled={isReadOnly}
                      />
                    </Form.Item>
                    <Form.Item label="Tài liệu BTVN">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Upload
                          beforeUpload={(file) => {
                            handleUploadAttachment(file);
                            return false; // Prevent default upload
                          }}
                          showUploadList={false}
                          disabled={isReadOnly || uploadingAttachment}
                        >
                          <Button
                            icon={<UploadOutlined />}
                            loading={uploadingAttachment}
                            disabled={isReadOnly}
                            block
                          >
                            {uploadingAttachment ? "Đang tải lên..." : "Tải lên tài liệu BTVN"}
                          </Button>
                        </Upload>

                        {homeworkAttachments.length > 0 && (
                          <>
                            {homeworkAttachments.length > 1 && (
                              <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                block
                                onClick={() => {
                                  homeworkAttachments.forEach((item) => {
                                    const link = document.createElement('a');
                                    link.href = item.url;
                                    link.download = item.name;
                                    link.target = '_blank';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    // Delay để tránh browser block multiple downloads
                                    setTimeout(() => { }, 200);
                                  });
                                }}
                                style={{ marginBottom: 8 }}
                              >
                                Tải tất cả ({homeworkAttachments.length} file)
                              </Button>
                            )}
                            <List
                              size="small"
                              bordered
                              dataSource={homeworkAttachments}
                              renderItem={(item, index) => {
                                // Rút gọn tên file: chỉ lấy tên file, bỏ đường dẫn dài
                                const getShortFileName = (fileName: string) => {
                                  // Nếu có đường dẫn, chỉ lấy tên file
                                  const parts = fileName.split('/');
                                  let name = parts[parts.length - 1];
                                  // Nếu tên file quá dài (>30 ký tự), rút gọn
                                  if (name.length > 30) {
                                    const ext = name.substring(name.lastIndexOf('.'));
                                    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
                                    return nameWithoutExt.substring(0, 25) + '...' + ext;
                                  }
                                  return name;
                                };
                                const shortName = getShortFileName(item.name);

                                return (
                                  <List.Item
                                    actions={!isReadOnly ? [
                                      <Button
                                        type="link"
                                        danger
                                        size="small"
                                        onClick={() => handleRemoveAttachment(index)}
                                      >
                                        Xóa
                                      </Button>
                                    ] : []}
                                  >
                                    <Space>
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={item.name}
                                        title={item.name}
                                      >
                                        <PaperClipOutlined /> {shortName}
                                      </a>
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        href={item.url}
                                        download={item.name}
                                      >
                                        Tải
                                      </Button>
                                    </Space>
                                  </List.Item>
                                );
                              }}
                            />
                          </>
                        )}
                      </Space>
                    </Form.Item>
                  </Form>
                </Card>
              </Col>
            </Row>

            <Card
              title="Bài kiểm tra chung"
              size="small"
              style={{ marginBottom: 16, background: "#f0f5ff" }}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <div style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>
                  💡 Nhập tên bài kiểm tra một lần, áp dụng cho tất cả học sinh
                </div>
                <Space>
                  <label style={{ fontWeight: 500 }}>Tên bài kiểm tra:</label>
                  <Input
                    placeholder="Ví dụ: Kiểm tra 15 phút, Giữa kỳ, Cuối kỳ..."
                    value={commonTestName}
                    onChange={(e) => handleApplyCommonTestName(e.target.value)}
                    style={{ width: 400 }}
                    disabled={isReadOnly}
                  />
                  {commonTestName && (
                    <Tag color="green">✓ Đã áp dụng cho {students.length} học sinh</Tag>
                  )}
                </Space>
              </Space>
            </Card>

            <Card title="Chấm điểm học sinh">
              <Table
                columns={homeworkColumns}
                dataSource={students}
                rowKey="id"
                pagination={false}
                scroll={{ x: 1500 }}
              />
            </Card>

            <div style={{ marginTop: 16, textAlign: "right" }}>
              <Space>
                <Button onClick={() => {
                  if (isEditingMode) {
                    setIsEditingMode(false);
                  }
                  setCurrentStep(0);
                }}>Quay lại</Button>
                {existingSession && existingSession["Trạng thái"] === "completed" && !isEditingMode && !isPassedEditDeadline && (
                  <Button
                    type="default"
                    icon={<EditOutlined />}
                    onClick={() => setIsEditingMode(true)}
                  >
                    Sửa điểm danh
                  </Button>
                )}
                {existingSession && isEditingMode && !isPassedEditDeadline ? (
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleCompleteSession}
                    loading={saving}
                  >
                    Cập nhật điểm danh
                  </Button>
                ) : (!existingSession || existingSession["Trạng thái"] === "not_started") ? (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={handleCompleteSession}
                    loading={saving}
                  >
                    Hoàn thành buổi học
                  </Button>
                ) : null}
              </Space>
            </div>
          </div>
        )}
      </Card>

      {/* Redeem Points Modal */}
      <Modal
        title={`Đổi thưởng - ${selectedStudentForRedeem?.["Họ và tên"] || ""}`}
        open={isRedeemModalOpen}
        onOk={handleRedeemPoints}
        onCancel={() => {
          setIsRedeemModalOpen(false);
          setSelectedStudentForRedeem(null);
          setCurrentAvailableBonus(0);
          redeemForm.resetFields();
        }}
        okText="Xác nhận đổi"
        cancelText="Hủy"
        width={600}
      >
        {selectedStudentForRedeem && (
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 4 }}>
            <div><strong>Học sinh:</strong> {selectedStudentForRedeem["Họ và tên"]}</div>
            <div><strong>Mã học sinh:</strong> {selectedStudentForRedeem["Mã học sinh"] || "-"}</div>
            <div style={{ marginTop: 12, padding: 8, backgroundColor: "#e6f7ff", borderRadius: 4, border: "1px solid #1890ff" }}>
              <div style={{ color: "#1890ff", fontSize: 14 }}>💰 Tổng điểm thưởng hiện có:</div>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#52c41a" }}>
                {currentAvailableBonus.toFixed(1)} điểm
              </div>
            </div>
          </div>
        )}
        <Form form={redeemForm} layout="vertical">
          <Form.Item
            label="Điểm cần đổi"
            name="points"
            rules={[
              { required: true, message: "Nhập số điểm cần đổi" },
              { type: "number", min: 1, message: "Điểm phải lớn hơn 0" },
            ]}
          >
            <InputNumber
              min={1}
              step={1}
              placeholder="Nhập số điểm"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item
            label="Ghi chú"
            name="note"
            rules={[{ required: true, message: "Nhập ghi chú" }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Nhập ghi chú về việc đổi thưởng"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Redeem History Modal */}
      <Modal
        title={`Lịch sử đổi thưởng - ${selectedStudentForHistory?.["Họ và tên"] || ""}`}
        open={isHistoryModalOpen}
        onCancel={() => {
          setIsHistoryModalOpen(false);
          setSelectedStudentForHistory(null);
          setRedeemHistory([]);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setIsHistoryModalOpen(false);
            setSelectedStudentForHistory(null);
            setRedeemHistory([]);
          }}>
            Đóng
          </Button>,
        ]}
        width={800}
      >
        <Table
          columns={[
            {
              title: "Ngày đổi",
              dataIndex: "Ngày đổi",
              key: "date",
              width: 120,
              render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
            },
            {
              title: "Thời gian",
              key: "time",
              width: 150,
              render: (_: any, record: any) =>
                dayjs(record["Thời gian đổi"] || record["Timestamp"]).format("HH:mm:ss"),
            },
            {
              title: "Điểm đổi",
              dataIndex: "Điểm đổi",
              key: "points",
              width: 100,
              align: "center" as const,
              render: (points: number) => (
                <Tag color="red" style={{ fontSize: "14px", fontWeight: "bold" }}>
                  -{points}
                </Tag>
              ),
            },
            {
              title: "Tổng điểm trước",
              dataIndex: "Tổng điểm trước khi đổi",
              key: "before",
              width: 120,
              align: "center" as const,
            },
            {
              title: "Tổng điểm sau",
              dataIndex: "Tổng điểm sau khi đổi",
              key: "after",
              width: 120,
              align: "center" as const,
            },
            {
              title: "Ghi chú",
              dataIndex: "Ghi chú",
              key: "note",
              render: (note: string) => note || "-",
            },
            {
              title: "Người đổi",
              dataIndex: "Người đổi",
              key: "redeemer",
              width: 150,
            },
            {
              title: "Thao tác",
              key: "actions",
              width: 120,
              fixed: "right" as const,
              render: (_: any, record: any) => (
                <Space size="small">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEditRedeem(record)}
                  >
                    Sửa
                  </Button>
                  <Popconfirm
                    title="Xóa lần đổi thưởng"
                    description="Bạn có chắc chắn muốn xóa? Điểm thưởng sẽ được hoàn lại cho học sinh."
                    onConfirm={() => handleDeleteRedeem(record)}
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
          ]}
          dataSource={redeemHistory}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Tổng ${total} lần đổi thưởng`,
          }}
          locale={{
            emptyText: <Empty description="Chưa có lịch sử đổi thưởng" />,
          }}
          scroll={{ x: 1000 }}
        />
      </Modal>

      {/* Edit Redeem Modal */}
      <Modal
        title={`Chỉnh sửa đổi thưởng - ${selectedStudentForHistory?.["Họ và tên"] || ""}`}
        open={isEditRedeemModalOpen}
        onOk={handleSaveEditRedeem}
        onCancel={() => {
          setIsEditRedeemModalOpen(false);
          setEditingRedeem(null);
          editRedeemForm.resetFields();
        }}
        okText="Lưu"
        cancelText="Hủy"
        width={600}
      >
        {editingRedeem && (
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 4 }}>
            <div><strong>Ngày đổi:</strong> {dayjs(editingRedeem["Ngày đổi"]).format("DD/MM/YYYY")}</div>
            <div><strong>Điểm đổi hiện tại:</strong> {editingRedeem["Điểm đổi"]}</div>
            <div><strong>Tổng điểm trước khi đổi:</strong> {editingRedeem["Tổng điểm trước khi đổi"]}</div>
            <div><strong>Tổng điểm sau khi đổi:</strong> {editingRedeem["Tổng điểm sau khi đổi"]}</div>
          </div>
        )}
        <Form form={editRedeemForm} layout="vertical">
          <Form.Item
            label="Điểm cần đổi"
            name="points"
            rules={[
              { required: true, message: "Nhập số điểm cần đổi" },
              { type: "number", min: 1, message: "Điểm phải lớn hơn 0" },
            ]}
          >
            <InputNumber
              min={1}
              step={1}
              placeholder="Nhập số điểm"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item
            label="Ghi chú"
            name="note"
            rules={[{ required: true, message: "Nhập ghi chú" }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Nhập ghi chú về việc đổi thưởng"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        title={`Chọn ${selectedTimeData?.field === "Giờ check-in" ? "giờ check-in" : "giờ check-out"}`}
        open={timeModalOpen}
        onOk={handleConfirmTime}
        onCancel={handleCloseTimeModal}
        okText="Xác nhận"
        cancelText="Hủy"
        width={400}
      >
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <TimePicker
            format="HH:mm:ss"
            value={tempTime}
            onChange={(time) => setTempTime(time)}
            size="large"
            style={{ width: "100%" }}
            placeholder="Chọn giờ"
          />
        </div>
        {tempTime && (
          <div style={{ marginTop: 16, textAlign: "center", color: "#1890ff", fontSize: 16, fontWeight: "bold" }}>
            Giờ được chọn: {tempTime.format("HH:mm:ss")}
          </div>
        )}
      </Modal>
    </WrapperContent>
  );
};

export default AttendanceSessionPage;
