import { useState, useEffect } from "react";
import {
  Button,
  Table,
  Modal,
  Form,
  Select,
  InputNumber,
  Space,
  Popconfirm,
  message,
  Tag,
  Input,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { subjectOptions, gradeOptions } from "../../utils/selectOptions";
import WrapperContent from "@/components/WrapperContent";
import {
  supabaseOnValue,
  convertFromSupabaseFormat,
  supabaseSet,
  supabaseUpdate,
  supabaseRemove,
  generateFirebaseId,
} from "@/utils/supabaseHelpers";

interface Course {
  id: string;
  Khối: number;
  "Môn học": string;
  Giá: number;
  "Lương GV Part-time": number;
  "Lương GV Full-time": number;
  "Lịch học"?: string;
  "Giáo viên phụ trách"?: string;
  "Teacher ID"?: string;
  "Ngày tạo": string;
  "Ngày cập nhật"?: string;
}

interface Teacher {
  id: string;
  "Họ và tên": string;
  "Mã giáo viên": string;
}

interface Student {
  id: string;
  "Họ và tên": string;
  "Khối": number;
  "Môn học đăng ký"?: string[];
}

const CourseManagement = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form] = Form.useForm();

  // Fetch courses from Supabase
  useEffect(() => {
    setLoading(true);
    const unsubscribe = supabaseOnValue(
      "datasheet/Khóa_học",
      (data) => {
        console.log("🔥 Supabase courses data updated:", data);
        if (data && typeof data === "object") {
          const coursesList = Object.entries(data).map(
            ([key, value]: [string, any]) => {
              const converted = convertFromSupabaseFormat(value, "khoa_hoc");
              return {
                id: key,
                ...converted,
              };
            }
          );
          console.log("📚 Courses list:", coursesList);
          setCourses(coursesList);
        } else {
          setCourses([]);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch teachers from Supabase
  useEffect(() => {
    const unsubscribe = supabaseOnValue(
      "datasheet/Giáo_viên",
      (data) => {
        if (data && typeof data === "object") {
          const teacherList = Object.entries(data).map(([id, value]) => {
            const converted = convertFromSupabaseFormat(value, "giao_vien");
            return {
              id,
              ...(converted as Omit<Teacher, "id">),
            };
          });
          setTeachers(teacherList);
        } else {
          setTeachers([]);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch students from Supabase
  useEffect(() => {
    const unsubscribe = supabaseOnValue(
      "datasheet/Học_sinh",
      (data) => {
        if (data && typeof data === "object") {
          const studentList = Object.entries(data).map(([id, value]) => {
            const converted = convertFromSupabaseFormat(value, "hoc_sinh");
            return {
              id,
              ...(converted as Omit<Student, "id">),
            };
          });
          setStudents(studentList);
        } else {
          setStudents([]);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // Calculate student count for each course
  const getStudentCount = (course: Course) => {
    return students.filter((student) => {
      const matchGrade = student["Khối"] === course["Khối"];
      const matchSubject = student["Môn học đăng ký"]?.includes(course["Môn học"]);
      return matchGrade && matchSubject;
    }).length;
  };

  const handleAdd = () => {
    setEditingCourse(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: Course) => {
    setEditingCourse(record);
    form.setFieldsValue({
      Khối: record["Khối"],
      "Môn học": record["Môn học"],
      Giá: record["Giá"],
      "Lương GV Part-time": record["Lương GV Part-time"],
      "Lương GV Full-time": record["Lương GV Full-time"],
      "Lịch học": record["Lịch học"],
      "Teacher ID": record["Teacher ID"],
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (courseId: string) => {
    try {
      await supabaseRemove("datasheet/Khóa_học", courseId);
      message.success("Xóa khóa học thành công");
    } catch (error) {
      console.error("Error deleting course:", error);
      message.error("Lỗi khi xóa khóa học");
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const timestamp = new Date().toISOString();

      // Validate trùng lặp: kiểm tra xem đã có khóa học với cùng khối và môn học chưa
      const existingCourse = courses.find(
        (course) =>
          course["Khối"] === values["Khối"] &&
          course["Môn học"] === values["Môn học"] &&
          course.id !== (editingCourse?.id || "")
      );

      if (existingCourse) {
        const gradeLabel =
          gradeOptions.find((opt) => opt.value === values["Khối"])?.label ||
          `Lớp ${values["Khối"]}`;
        const subjectLabel =
          subjectOptions.find((opt) => opt.value === values["Môn học"])
            ?.label || values["Môn học"];
        message.error(`Đã tồn tại khóa học ${subjectLabel} cho ${gradeLabel}!`);
        return;
      }

      const selectedTeacher = values["Teacher ID"]
        ? teachers.find((t) => t.id === values["Teacher ID"])
        : null;

      if (editingCourse) {
        // Update existing course using Supabase
        const updates = {
          Khối: values["Khối"],
          "Môn học": values["Môn học"],
          Giá: values["Giá"],
          "Lương GV Part-time": values["Lương GV Part-time"],
          "Lương GV Full-time": values["Lương GV Full-time"],
          "Lịch học": values["Lịch học"] || "",
          "Giáo viên phụ trách": selectedTeacher?.["Họ và tên"] || "",
          "Teacher ID": values["Teacher ID"] || "",
          "Ngày cập nhật": timestamp,
        };
        await supabaseUpdate("datasheet/Khóa_học", editingCourse.id, updates);
        message.success("Cập nhật khóa học thành công");
      } else {
        // Add new course
        const courseData = {
          Khối: values["Khối"],
          "Môn học": values["Môn học"],
          Giá: values["Giá"],
          "Lương GV Part-time": values["Lương GV Part-time"],
          "Lương GV Full-time": values["Lương GV Full-time"],
          "Lịch học": values["Lịch học"] || "",
          "Giáo viên phụ trách": selectedTeacher?.["Họ và tên"] || "",
          "Teacher ID": values["Teacher ID"] || "",
          "Ngày tạo": timestamp,
        };
        console.log("➕ Adding new course:", courseData);
        const newCourseId = generateFirebaseId();
        await supabaseSet("datasheet/Khóa_học", { ...courseData, id: newCourseId });
        console.log("✅ Course added with ID:", newCourseId);
        message.success("Thêm khóa học thành công");
      }

      setIsModalOpen(false);
      form.resetFields();
      setEditingCourse(null);
    } catch (error) {
      console.error("Error saving course:", error);
      message.error("Lỗi khi lưu khóa học");
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
    setEditingCourse(null);
  };

  const columns = [
    {
      title: "Khối",
      dataIndex: "Khối",
      key: "grade",
      width: 120,
      sorter: (a: Course, b: Course) => a["Khối"] - b["Khối"],
      render: (grade: number) => {
        const gradeOption = gradeOptions.find((opt) => opt.value === grade);
        return gradeOption ? gradeOption.label : `Lớp ${grade}`;
      },
    },
    {
      title: "Môn học",
      dataIndex: "Môn học",
      key: "subject",
      width: 200,
      filters: subjectOptions.map((opt) => ({
        text: opt.label,
        value: opt.value,
      })),
      onFilter: (value: any, record: Course) => record["Môn học"] === value,
      render: (subject: string) => {
        const subjectOption = subjectOptions.find(
          (opt) => opt.value === subject
        );
        return subjectOption ? subjectOption.label : subject;
      },
    },
    {
      title: "Giá/buổi",
      dataIndex: "Giá",
      key: "price",
      width: 150,
      sorter: (a: Course, b: Course) => a["Giá"] - b["Giá"],
      render: (price: number) => (
        <Tag color="blue">{price?.toLocaleString("vi-VN")} đ</Tag>
      ),
    },
    {
      title: "Lương giáo viên",
      dataIndex: "Lương GV Part-time",
      key: "salaryPartTime",
      width: 150,
      sorter: (a: Course, b: Course) =>
        a["Lương GV Part-time"] - b["Lương GV Part-time"],
      render: (salary: number) => (
        <Tag color="green">{salary?.toLocaleString("vi-VN")} đ</Tag>
      ),
    },
    {
      title: "Lương trợ giảng",
      dataIndex: "Lương GV Full-time",
      key: "salaryFullTime",
      width: 150,
      sorter: (a: Course, b: Course) =>
        a["Lương GV Full-time"] - b["Lương GV Full-time"],
      render: (salary: number) => (
        <Tag color="orange">{salary?.toLocaleString("vi-VN")} đ</Tag>
      ),
    },
    {
      title: "Lịch học",
      dataIndex: "Lịch học",
      key: "schedule",
      width: 200,
      render: (schedule?: string) => schedule || "-",
    },
    {
      title: "Giáo viên phụ trách",
      dataIndex: "Giáo viên phụ trách",
      key: "teacher",
      width: 180,
      render: (teacher?: string) => teacher || "-",
    },
    {
      title: "Số học sinh",
      key: "studentCount",
      width: 120,
      align: "center" as const,
      render: (_: any, record: Course) => (
        <Tag color="purple">{getStudentCount(record)} học sinh</Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 150,
      fixed: "right" as const,
      render: (_: any, record: Course) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xóa khóa học"
            description="Bạn có chắc chắn muốn xóa khóa học này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <WrapperContent
      title="Quản lý khóa học"
      toolbar={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Thêm khóa học
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={courses}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1000 }}
        pagination={{
          showSizeChanger: false,
          showTotal: (total) => `Tổng số: ${total} khóa học`,
        }}
      />

      <Modal
        title={editingCourse ? "Sửa khóa học" : "Thêm khóa học mới"}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={handleCancel}
        okText={editingCourse ? "Cập nhật" : "Thêm"}
        cancelText="Hủy"
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: "24px" }}>
          <Form.Item
            label="Khối"
            name="Khối"
            rules={[{ required: true, message: "Vui lòng chọn khối!" }]}
          >
            <Select
              placeholder="Chọn khối"
              options={gradeOptions}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="Môn học"
            name="Môn học"
            rules={[{ required: true, message: "Vui lòng chọn môn học!" }]}
          >
            <Select
              placeholder="Chọn môn học"
              options={subjectOptions}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="Giá/buổi"
            name="Giá"
            rules={[
              { required: true, message: "Vui lòng nhập giá!" },
              {
                type: "number",
                min: 0,
                message: "Giá phải lớn hơn hoặc bằng 0!",
              },
            ]}
          >
            <InputNumber<number>
              placeholder="Nhập giá khóa học"
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) =>
                Number((value ?? "").replace(/\$\s?|(,*)/g, ""))
              }
              min={0}
              step={10000}
            />
          </Form.Item>

          <Form.Item
            label="Lương GV Part-time/buổi (VNĐ)"
            name="Lương GV Part-time"
            rules={[
              {
                required: true,
                message: "Vui lòng nhập lương GV Part-time!",
              },
              {
                type: "number",
                min: 0,
                message: "Lương phải lớn hơn hoặc bằng 0!",
              },
            ]}
          >
            <InputNumber<number>
              placeholder="Nhập lương giáo viên Part-time"
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) =>
                Number((value ?? "").replace(/\$\s?|(,*)/g, ""))
              }
              min={0}
              step={10000}
            />
          </Form.Item>

          <Form.Item
            label="Lương GV Full-time/buổi (VNĐ)"
            name="Lương GV Full-time"
            rules={[
              {
                required: true,
                message: "Vui lòng nhập lương GV Full-time!",
              },
              {
                type: "number",
                min: 0,
                message: "Lương phải lớn hơn hoặc bằng 0!",
              },
            ]}
          >
            <InputNumber<number>
              placeholder="Nhập lương giáo viên Full-time"
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) =>
                Number((value ?? "").replace(/\$\s?|(,*)/g, ""))
              }
              min={0}
              step={10000}
            />
          </Form.Item>

          <Form.Item
            label="Lịch học"
            name="Lịch học"
          >
            <Input.TextArea
              placeholder="VD: Thứ 2, 4, 6 - 18:00-20:00"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            label="Giáo viên phụ trách"
            name="Teacher ID"
          >
            <Select
              placeholder="Chọn giáo viên"
              showSearch
              allowClear
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={teachers.map((t) => ({
                value: t.id,
                label: `${t["Họ và tên"]} (${t["Mã giáo viên"]})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </WrapperContent>
  );
};

export default CourseManagement;
