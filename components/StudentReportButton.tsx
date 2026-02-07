import { useState, useEffect } from 'react';
import { Button } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';
import { AttendanceSession } from '../types';
import StudentReport from './StudentReport';
import dayjs from 'dayjs';

interface StudentReportButtonProps {
    student: {
        id: string;
        'Họ và tên': string;
        'Mã học sinh'?: string;
        'Ngày sinh'?: string;
        'Số điện thoại'?: string;
        'Email'?: string;
        'Địa chỉ'?: string;
        [key: string]: any;
    };
    type?: 'default' | 'primary' | 'link';
    size?: 'small' | 'middle' | 'large';
    initialMonth?: dayjs.Dayjs | null;
}

const StudentReportButton = ({ student, type = 'default', size = 'middle', initialMonth }: StudentReportButtonProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sessions, setSessions] = useState<AttendanceSession[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isModalOpen) return;

        setLoading(true);
        const sessionsRef = ref(database, 'datasheet/Điểm_danh_sessions');
        const unsubscribe = onValue(sessionsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const sessionsList = Object.entries(data).map(([id, value]) => ({
                    id,
                    ...(value as Omit<AttendanceSession, 'id'>)
                }));
                setSessions(sessionsList);
            } else {
                setSessions([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isModalOpen]);

    return (
        <>
            <Button
                type={type}
                size={size}
                icon={<FileTextOutlined />}
                onClick={() => setIsModalOpen(true)}
                loading={loading}
            >
                Báo cáo
            </Button>

            <StudentReport
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                student={student}
                sessions={sessions}
                initialMonth={initialMonth}
            />
        </>
    );
};

export default StudentReportButton;
