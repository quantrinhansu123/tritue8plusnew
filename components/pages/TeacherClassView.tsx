import { useState, useEffect, useMemo } from "react";
import {
  Card,
  Table,
  Tag,
  Tabs,
  Descriptions,
  Empty,
  Button,
  Modal,
  Space,
  Select,
  message,
  List,
  Popconfirm,
} from "antd";
import {
  UserAddOutlined,
  HistoryOutlined,
  FileTextOutlined,
  PlusOutlined,
  DeleteOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { useClasses } from "../../hooks/useClasses";
import { useAuth } from "../../contexts/AuthContext";
import { Class } from "../../types";
import { supabaseOnValue, supabaseUpdate, convertFromSupabaseFormat } from "../../utils/supabaseHelpers";
import { useNavigate } from "react-router-dom";
import AddStudentModal from "../AddStudentModal";
import ScoreDetailModal from "../ScoreDetailModal";
import WrapperContent from "@/components/WrapperContent";
import UploadDocumentModal from "../UploadDocumentModal";
import { getCloudinaryDownloadUrl } from "@/utils/cloudinaryStorage";

interface Student {
  id: string;
  "Họ và tên": string;
  "Mã học sinh": string;
  "Ngày sinh"?: string;
  "Số điện thoại"?: string;
  Email?: string;
}

const TeacherClassView = () => {
  const { userProfile } = useAuth();
  const { classes, loading } = useClasses();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [selectedClassForDoc, setSelectedClassForDoc] = useState<Class | null>(
    null
  );
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [loadingTeacher, setLoadingTeacher] = useState(true);

  const teacherId = userProfile?.teacherId || userProfile?.uid || "";

  // Load teacher data to get actual teacher ID from Giáo_viên table
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
          console.log("TeacherClassView - Found teacher:", { id, teacher });
          setTeacherData({ id, ...(teacher as any) });
        }
        setLoadingTeacher(false);
      } else {
        setLoadingTeacher(false);
      }
    });
    return () => unsubscribe();
  }, [userProfile?.email]);

  useEffect(() => {
    const unsubscribe = supabaseOnValue("datasheet/Danh_sách_học_sinh", (data) => {
      if (data) {
        const studentList = Object.entries(data).map(([id, value]: [string, any]) => {
          const converted = convertFromSupabaseFormat(value, "hoc_sinh");
          return {
            id,
            ...converted,
          };
        });
        setStudents(studentList);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load attendance sessions
  useEffect(() => {
    const unsubscribe = supabaseOnValue("datasheet/Điểm_danh_sessions", (data) => {
      if (data) {
        const sessionsList = Object.entries(data).map(([id, value]) => {
          const converted = convertFromSupabaseFormat(value, "diem_danh_sessions");
          return {
            id,
            ...converted,
          };
        });
        setAttendanceSessions(sessionsList);
      }
    });
    return () => unsubscribe();
  }, []);

  // Use teacherData.id if available, otherwise fallback to teacherId from profile
  const actualTeacherId = teacherData?.id || teacherId;
  const isGlobalLoading = loading || loadingTeacher;

  console.log("TeacherClassView - Filter info:", {
    userProfile,
    teacherId,
    teacherDataId: teacherData?.id,
    actualTeacherId,
    allClasses: classes.map((c) => ({
      id: c.id,
      name: c["Tên lớp"],
      teacherId: c["Teacher ID"],
    })),
  });

  // Compute unique rooms for filter dropdown
  const uniqueRooms = useMemo(() => {
    const rooms = new Set<string>();
    classes.forEach((c: any) => {
      const r = c["Địa điểm"] || c["Phòng học"] || "";
      if (r) rooms.add(r);
    });
    return Array.from(rooms).sort();
  }, [classes]);

  const myClasses = classes.filter((c) => {
    const match = c["Teacher ID"] === actualTeacherId;
    if (!match) return false;
    if (roomFilter && roomFilter !== "all") {
      const room = c["Địa điểm"] || c["Phòng học"] || "";
      return room === roomFilter;
    }
    return true;
  });

  const getClassStudents = (classData: Class) => {
    return students.filter((s) => classData["Student IDs"]?.includes(s.id));
  };

  // Add document to class
  const handleAddDocument = async (documentData: any) => {
    if (!selectedClassForDoc) return;

    try {
      const currentDocuments = selectedClassForDoc["Tài liệu"] || [];
      const updatedDocuments = [...currentDocuments, documentData];

      const success = await supabaseUpdate(
        "datasheet/Lớp_học",
        selectedClassForDoc.id,
        {
          "Tài liệu": updatedDocuments,
        }
      );

      if (success) {
        message.success("Đã thêm tài liệu vào lớp học!");
      }
    } catch (error) {
      console.error("Error adding document to class:", error);
      message.error("Lỗi khi lưu tài liệu vào lớp học");
    }
  };

  // Delete document from class
  const handleDeleteDocument = async (classData: Class, docIndex: number) => {
    try {
      const currentDocuments = classData["Tài liệu"] || [];
      const updatedDocuments = currentDocuments.filter(
        (_, index) => index !== docIndex
      );

      const success = await supabaseUpdate(
        "datasheet/Lớp_học",
        classData.id,
        {
          "Tài liệu": updatedDocuments,
        }
      );

      if (success) {
        message.success("Đã xóa tài liệu thành công!");
      } else {
        message.error("Không thể xóa tài liệu trên hệ thống mới");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      message.error("Lỗi khi xóa tài liệu");
    }
  };

  const handleOpenScoreModal = (student: Student, classData: Class) => {
    // Find the most recent session for this class
    const classSessions = attendanceSessions
      .filter((session) => session["Class ID"] === classData.id)
      .sort(
        (a, b) => new Date(b["Ngày"]).getTime() - new Date(a["Ngày"]).getTime()
      );

    if (classSessions.length > 0) {
      setSelectedSession(classSessions[0]);
      setSelectedStudent({ id: student.id, name: student["Họ và tên"] });
      setIsScoreModalOpen(true);
    } else {
      Modal.warning({
        title: "Chưa có buổi học",
        content:
          "Chưa có buổi học nào để thêm điểm. Vui lòng điểm danh buổi học trước.",
      });
    }
  };

  const studentColumns = (classData: Class) => [
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
    },
    {
      title: "Ngày sinh",
      dataIndex: "Ngày sinh",
      key: "dob",
      width: 120,
    },
    {
      title: "Số điện thoại",
      dataIndex: "Số điện thoại",
      key: "phone",
      width: 130,
    },
    {
      title: "Email",
      dataIndex: "Email",
      key: "email",
      width: 200,
    },
    // {
    //   title: "Bảng điểm",
    //   key: "scores",
    //   width: 120,
    //   align: "center" as const,
    //   render: (_: any, record: Student) => (
    //     <Button
    //       size="small"
    //       type="link"
    //       icon={<FileTextOutlined />}
    //       onClick={() => handleOpenScoreModal(record, classData)}
    //     >
    //       Nhập điểm
    //     </Button>
    //   ),
    // },
  ];

  if (myClasses.length === 0) {
    return (
      <WrapperContent title="Lớp học của tôi" isLoading={isGlobalLoading}>
        <div style={{ padding: "40px", textAlign: "center" }}>
          {!isGlobalLoading && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Bạn chưa được phân công lớp học nào hoặc dữ liệu đang được đồng bộ."
            />
          )}
        </div>
      </WrapperContent>
    );
  }

  return (
    <WrapperContent title="Lớp học của tôi" isLoading={isGlobalLoading}>
      <Card style={{ marginBottom: 12 }}>
        <Space>
          <span style={{ fontWeight: 600 }}>Lọc theo địa điểm:</span>
          <Select
            style={{ minWidth: 220 }}
            value={roomFilter}
            onChange={(val) => setRoomFilter(val)}
            options={[
              { label: "Tất cả địa điểm", value: "all" },
              ...uniqueRooms.map((r) => ({ label: r, value: r })),
            ]}
          />
        </Space>
      </Card>

      <Tabs
        items={myClasses.map((classData) => ({
          key: classData.id,
          label: classData["Tên lớp"],
          children: (
            <div>
              <Card
                title="Thông tin lớp học"
                extra={
                  <Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setSelectedClassForDoc(classData);
                        setIsDocumentModalOpen(true);
                      }}
                    >
                      Thêm tài liệu
                    </Button>
                    <Button
                      icon={<FileTextOutlined />}
                      onClick={() =>
                        navigate(`/workspace/classes/${classData.id}/grades`)
                      }
                    >
                      Bảng điểm
                    </Button>
                    <Button
                      icon={<HistoryOutlined />}
                      onClick={() =>
                        navigate(`/workspace/classes/${classData.id}/history`)
                      }
                    >
                      Lịch sử buổi học
                    </Button>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Descriptions column={2}>
                  <Descriptions.Item label="Mã lớp">
                    {classData["Mã lớp"]}
                  </Descriptions.Item>
                  <Descriptions.Item label="Môn học">
                    {classData["Môn học"]}
                  </Descriptions.Item>
                  <Descriptions.Item label="Địa điểm">
                    {classData["Địa điểm"] || classData["Phòng học"] || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Khối">
                    {classData["Khối"]}
                  </Descriptions.Item>
                  <Descriptions.Item label="Trạng thái">
                    <Tag
                      color={
                        classData["Trạng thái"] === "active" ? "green" : "red"
                      }
                    >
                      {classData["Trạng thái"] === "active"
                        ? "Hoạt động"
                        : "Ngừng"}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Số học sinh">
                    {classData["Student IDs"]?.length || 0}
                  </Descriptions.Item>
                </Descriptions>

                {classData["Lịch học"] && classData["Lịch học"].length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4>Lịch học trong tuần:</h4>
                    {classData["Lịch học"].map((schedule, index) => (
                      <div key={index} style={{ marginBottom: 8 }}>
                        <Tag color="blue">Thứ {schedule["Thứ"]}</Tag>
                        {schedule["Giờ bắt đầu"]} - {schedule["Giờ kết thúc"]}
                        {schedule["Địa điểm"] && ` - ${schedule["Địa điểm"]}`}
                      </div>
                    ))}
                  </div>
                )}

                {classData["Ghi chú"] && (
                  <div style={{ marginTop: 16 }}>
                    <strong>Ghi chú:</strong> {classData["Ghi chú"]}
                  </div>
                )}
              </Card>

              <Card
                title="Danh sách học sinh"
                extra={
                  <Space>
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={() => {
                        setSelectedClass(classData);
                        setIsStudentModalOpen(true);
                      }}
                    >
                      Thêm học sinh
                    </Button>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Table
                  columns={studentColumns(classData)}
                  dataSource={getClassStudents(classData)}
                  rowKey="id"
                  pagination={false}
                  scroll={{ x: 1000 }}
                />
              </Card>

              <Card
                title="Tài liệu học tập"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setSelectedClassForDoc(classData);
                      setIsDocumentModalOpen(true);
                    }}
                  >
                    Thêm tài liệu
                  </Button>
                }
              >
                {classData["Tài liệu"] && classData["Tài liệu"].length > 0 ? (
                  <List
                    dataSource={classData["Tài liệu"]}
                    renderItem={(doc: any, index: number) => (
                      <List.Item
                        actions={[
                          <Button
                            type="link"
                            icon={<LinkOutlined />}
                            href={doc.type === "file" ? getCloudinaryDownloadUrl(doc.url) : doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {doc.type === "file" ? "Tải xuống" : "Mở"}
                          </Button>,
                          <Popconfirm
                            title="Xóa tài liệu"
                            description="Bạn có chắc chắn muốn xóa tài liệu này?"
                            onConfirm={() =>
                              handleDeleteDocument(classData, index)
                            }
                            okText="Xóa"
                            cancelText="Hủy"
                          >
                            <Button
                              type="link"
                              danger
                              icon={<DeleteOutlined />}
                            >
                              Xóa
                            </Button>
                          </Popconfirm>,
                        ]}
                      >
                        <List.Item.Meta
                          avatar={
                            <FileTextOutlined
                              style={{ fontSize: 24, color: "#1890ff" }}
                            />
                          }
                          title={
                            <Space>
                              {doc.name}
                              {doc.type === "file" && (
                                <Tag color="green">File tải lên</Tag>
                              )}
                              {doc.type === "link" && (
                                <Tag color="blue">Link</Tag>
                              )}
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size="small">
                              {doc.description && <div>{doc.description}</div>}
                              {doc.fileName && (
                                <div style={{ fontSize: 12, color: "#666" }}>
                                  📎 {doc.fileName}
                                </div>
                              )}
                              <div style={{ fontSize: 12, color: "#999" }}>
                                Đăng tải:{" "}
                                {new Date(doc.uploadedAt).toLocaleString(
                                  "vi-VN"
                                )}{" "}
                                bởi {doc.uploadedBy}
                              </div>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="Chưa có tài liệu nào" />
                )}
              </Card>
            </div>
          ),
        }))}
      />

      <AddStudentModal
        open={isStudentModalOpen}
        onClose={() => {
          setIsStudentModalOpen(false);
          setSelectedClass(null);
        }}
        classData={selectedClass}
      />

      {/* Upload Document Modal */}
      <UploadDocumentModal
        open={isDocumentModalOpen}
        onClose={() => {
          setIsDocumentModalOpen(false);
          setSelectedClassForDoc(null);
        }}
        onSuccess={handleAddDocument}
        classId={selectedClassForDoc?.id || ""}
        className={selectedClassForDoc?.["Tên lớp"] || ""}
        uploaderName={
          teacherData?.["Họ và tên"] || userProfile?.displayName || "Giáo viên"
        }
      />

      {/* Score Detail Modal */}
      {selectedStudent && (
        <ScoreDetailModal
          visible={isScoreModalOpen}
          onClose={() => {
            setIsScoreModalOpen(false);
            setSelectedSession(null);
            setSelectedStudent(null);
          }}
          session={selectedSession}
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
        />
      )}
    </WrapperContent>
  );
};

export default TeacherClassView;
