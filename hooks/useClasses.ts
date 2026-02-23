import { useState, useEffect } from 'react';
import { Class } from '../types';
import { message } from 'antd';
import { 
  supabaseGetAll, 
  supabaseSet, 
  supabaseUpdate, 
  supabaseRemove,
  supabaseOnValue,
  convertToSupabaseFormat,
  convertFromSupabaseFormat
} from '../utils/supabaseHelpers';
import { supabaseAdmin } from '@/supabase';

export const useClasses = () => {
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load initial data
        const loadClasses = async () => {
            try {
                const data = await supabaseGetAll<Class>('datasheet/Lớp_học');
                if (data && typeof data === 'object') {
                    // Convert from Supabase format to Firebase format
                    const classList = Object.entries(data).map(([id, value]: [string, any]) => {
                        const converted = convertFromSupabaseFormat(value, "lop_hoc");
                        return {
                            id,
                            ...converted,
                        };
                    });
                    console.log("📚 Classes loaded from Supabase:", classList.length);
                    setClasses(classList);
                } else {
                    console.warn("⚠️ No classes data from Supabase");
                    setClasses([]);
                }
                setLoading(false);
            } catch (error) {
                console.error('Error fetching classes:', error);
                message.error('Không thể tải danh sách lớp học');
                setLoading(false);
            }
        };

        loadClasses();

        // Subscribe to real-time updates
        const unsubscribe = supabaseOnValue('datasheet/Lớp_học', (data) => {
            if (data && typeof data === 'object') {
                // Convert from Supabase format to Firebase format
                const classList = Object.entries(data).map(([id, value]: [string, any]) => {
                    const converted = convertFromSupabaseFormat(value, "lop_hoc");
                    return {
                        id,
                        ...converted,
                    };
                });
                setClasses(classList);
            } else {
                setClasses([]);
            }
            setLoading(false);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const addClass = async (classData: Omit<Class, 'id'>) => {
        try {
            // Generate a new ID (similar to Firebase push)
            const newId = `class_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const classWithId = {
                id: newId,
                ...classData,
            };

            await supabaseSet('datasheet/Lớp_học', classWithId, { upsert: true });
            message.success('Thêm lớp học thành công');
            return newId;
        } catch (error) {
            console.error('Error adding class:', error);
            message.error('Không thể thêm lớp học');
            throw error;
        }
    };

    const updateClass = async (classId: string, updates: Partial<Omit<Class, 'id'>>) => {
        try {
            await supabaseUpdate('datasheet/Lớp_học', classId, updates);
            message.success('Cập nhật lớp học thành công');
        } catch (error) {
            console.error('Error updating class:', error);
            message.error('Không thể cập nhật lớp học');
            throw error;
        }
    };

    const deleteClass = async (classId: string) => {
        try {
            await supabaseRemove('datasheet/Lớp_học', classId);
            message.success('Xóa lớp học thành công');
        } catch (error) {
            console.error('Error deleting class:', error);
            message.error('Không thể xóa lớp học');
            throw error;
        }
    };

    const addStudentToClass = async (classId: string, studentId: string, studentName: string, enrollmentDate?: string) => {
        try {
            // Get current class data
            const classData = await supabaseGetAll<Class>('datasheet/Lớp_học');
            if (!classData || !classData[classId]) {
                throw new Error('Class not found');
            }

            const currentClass = classData[classId];
            const updatedStudentIds = [...(currentClass['Student IDs'] || []), studentId];
            const updatedStudentNames = [...(currentClass['Học sinh'] || []), studentName];
            
            // Track enrollment date - use provided date or default to today
            const dateToUse = enrollmentDate || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const updatedEnrollments = { ...(currentClass['Student Enrollments'] || {}) };
            updatedEnrollments[studentId] = { enrollmentDate: dateToUse };

            // Update class in Supabase
            await supabaseUpdate('datasheet/Lớp_học', classId, {
                'Student IDs': updatedStudentIds,
                'Học sinh': updatedStudentNames,
                'Student Enrollments': updatedEnrollments
            });

            // Also add/update in lop_hoc_hoc_sinh table
            const enrollmentId = `${classId}-${studentId}`;
            const studentCode = ''; // Will be filled from student data if available
            await supabaseSet('datasheet/Lớp_học/Học_sinh', {
                id: enrollmentId,
                class_id: classId,
                student_id: studentId,
                student_name: studentName,
                student_code: studentCode,
                enrollment_date: dateToUse,
                status: 'active',
            }, { upsert: true });
        } catch (error) {
            console.error('Error adding student to class:', error);
            message.error('Không thể thêm học sinh vào lớp');
            throw error;
        }
    };

    const addMultipleStudentsToClass = async (
        classId: string,
        students: Array<{ id: string; name: string }>,
        enrollmentDate?: string
    ) => {
        try {
            // Get current class data
            const classData = await supabaseGetAll<Class>('datasheet/Lớp_học');
            if (!classData || !classData[classId]) {
                throw new Error('Class not found');
            }

            const currentClass = classData[classId];
            const currentStudentIds = currentClass['Student IDs'] || [];
            const currentStudentNames = currentClass['Học sinh'] || [];
            const currentEnrollments = currentClass['Student Enrollments'] || {};

            // Filter out students that are already in the class
            const newStudents = students.filter(s => !currentStudentIds.includes(s.id));

            if (newStudents.length === 0) {
                message.info('Tất cả học sinh đã có trong lớp');
                return;
            }

            // Add new students
            const updatedStudentIds = [...currentStudentIds, ...newStudents.map(s => s.id)];
            const updatedStudentNames = [...currentStudentNames, ...newStudents.map(s => s.name)];
            
            // Track enrollment date for new students - use provided date or default to today
            const dateToUse = enrollmentDate || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const updatedEnrollments = { ...currentEnrollments };
            newStudents.forEach(s => {
                updatedEnrollments[s.id] = { enrollmentDate: dateToUse };
            });

            // Update class in Supabase
            await supabaseUpdate('datasheet/Lớp_học', classId, {
                'Student IDs': updatedStudentIds,
                'Học sinh': updatedStudentNames,
                'Student Enrollments': updatedEnrollments
            });

            // Also add/update in lop_hoc_hoc_sinh table
            const enrollmentPromises = newStudents.map(async (student) => {
                const enrollmentId = `${classId}-${student.id}`;
                const studentCode = ''; // Will be filled from student data if available
                await supabaseSet('datasheet/Lớp_học/Học_sinh', {
                    id: enrollmentId,
                    class_id: classId,
                    student_id: student.id,
                    student_name: student.name,
                    student_code: studentCode,
                    enrollment_date: dateToUse,
                    status: 'active',
                }, { upsert: true });
            });
            await Promise.all(enrollmentPromises);

            message.success(`Đã thêm ${newStudents.length} học sinh vào lớp (từ ngày ${dateToUse})`);
        } catch (error) {
            console.error('Error adding students to class:', error);
            message.error('Không thể thêm học sinh vào lớp');
            throw error;
        }
    };

    const removeStudentFromClass = async (classId: string, studentId: string) => {
        try {
            // Get current class data
            const classData = await supabaseGetAll<Class>('datasheet/Lớp_học');
            if (!classData || !classData[classId]) {
                throw new Error('Class not found');
            }

            // Convert from Supabase format
            const currentClassRaw = classData[classId];
            const currentClass = convertFromSupabaseFormat(currentClassRaw, "lop_hoc");
            
            const updatedStudentIds = (currentClass['Student IDs'] || currentClass['student_ids'] || []).filter((id: string) => id !== studentId);
            const studentIndex = (currentClass['Student IDs'] || currentClass['student_ids'] || []).indexOf(studentId);
            const updatedStudentNames = (currentClass['Học sinh'] || currentClass['hoc_sinh'] || []).filter((_: string, index: number) => index !== studentIndex);
            
            // Also remove enrollment record for this student
            const currentEnrollments = currentClass['Student Enrollments'] || currentClass['student_enrollments'] || {};
            const { [studentId]: removed, ...remainingEnrollments } = currentEnrollments;

            // Convert to Supabase format before updating
            const updateData = convertToSupabaseFormat({
                'Student IDs': updatedStudentIds,
                'Học sinh': updatedStudentNames,
                'Student Enrollments': remainingEnrollments
            }, "lop_hoc");

            // Update class in Supabase
            await supabaseUpdate('datasheet/Lớp_học', classId, updateData);

            // Also update status in lop_hoc_hoc_sinh table to 'inactive'
            const enrollmentId = `${classId}-${studentId}`;
            await supabaseUpdate('datasheet/Lớp_học/Học_sinh', enrollmentId, {
                status: 'inactive',
            });
            
            message.success('Đã xóa học sinh khỏi lớp');
        } catch (error) {
            console.error('Error removing student from class:', error);
            message.error('Không thể xóa học sinh khỏi lớp');
            throw error;
        }
    };

    return {
        classes,
        loading,
        addClass,
        updateClass,
        deleteClass,
        addStudentToClass,
        addMultipleStudentsToClass,
        removeStudentFromClass
    };
};
