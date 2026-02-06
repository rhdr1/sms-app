"use client";

import { useState, useEffect } from "react";
import { Calendar, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useWaliAuth } from "@/contexts/WaliAuthContext";

interface AttendanceRecord {
    date: string;
    studentName: string;
    studentId: string;
    sessions: {
        name: string;
        isPresent: boolean;
    }[];
}

export default function WaliKehadiranPage() {
    const { children } = useWaliAuth();
    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChild, setSelectedChild] = useState<string | "all">("all");

    useEffect(() => {
        fetchAttendance();
    }, [children, selectedChild]);

    async function fetchAttendance() {
        if (children.length === 0) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Get dates for last 14 days
            const dates: string[] = [];
            for (let i = 0; i < 14; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                dates.push(date.toISOString().split("T")[0]);
            }

            // Filter children based on selection
            const childIds = selectedChild === "all"
                ? children.map(c => c.id)
                : [selectedChild];

            // Fetch sessions ref
            const { data: sessions } = await supabase
                .from("sessions_ref")
                .select("id, name")
                .eq("is_active", true)
                .order("sort_order");

            // Fetch attendance criteria (kehadiran)
            const { data: criteria } = await supabase
                .from("criteria_ref")
                .select("id")
                .eq("title", "Kehadiran")
                .single();

            if (!criteria) {
                setAttendanceData([]);
                setLoading(false);
                return;
            }

            // Fetch assessments
            const { data: assessments } = await supabase
                .from("daily_assessments")
                .select("date, student_id, session_id, is_compliant")
                .in("student_id", childIds)
                .eq("criteria_id", criteria.id)
                .in("date", dates);

            // Group by date and student
            const attendanceMap = new Map<string, AttendanceRecord>();

            for (const child of children) {
                if (selectedChild !== "all" && child.id !== selectedChild) continue;

                for (const date of dates) {
                    const key = `${date}-${child.id}`;
                    const record: AttendanceRecord = {
                        date,
                        studentName: child.name,
                        studentId: child.id,
                        sessions: (sessions || []).map(s => {
                            const assessment = assessments?.find(
                                a => a.date === date &&
                                    a.student_id === child.id &&
                                    a.session_id === s.id
                            );
                            return {
                                name: s.name,
                                isPresent: assessment?.is_compliant ?? false,
                            };
                        }),
                    };
                    attendanceMap.set(key, record);
                }
            }

            // Sort by date descending
            const sortedData = Array.from(attendanceMap.values()).sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            setAttendanceData(sortedData);
        } catch (error) {
            console.error("Error fetching attendance:", error);
        } finally {
            setLoading(false);
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }

    // Group by date for display
    const groupedByDate = attendanceData.reduce((acc, record) => {
        if (!acc[record.date]) {
            acc[record.date] = [];
        }
        acc[record.date].push(record);
        return acc;
    }, {} as Record<string, AttendanceRecord[]>);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-brand-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-6 h-6 text-brand-blue-500" />
                    <h1 className="text-2xl font-bold text-brand-blue-900">
                        Kehadiran Anak
                    </h1>
                </div>
                <p className="text-gray-500">
                    Pantau kehadiran putra/putri Anda dalam 14 hari terakhir.
                </p>
            </div>

            {/* Filter */}
            {children.length > 1 && (
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-gray-400" />
                        <select
                            value={selectedChild}
                            onChange={(e) => setSelectedChild(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-blue-500"
                        >
                            <option value="all">Semua Anak</option>
                            {children.map((child) => (
                                <option key={child.id} value={child.id}>
                                    {child.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Attendance List */}
            {Object.keys(groupedByDate).length === 0 ? (
                <div className="card p-8 text-center">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                        Belum ada data kehadiran untuk ditampilkan.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(groupedByDate).map(([date, records]) => (
                        <div key={date} className="card overflow-hidden">
                            <div className="bg-brand-blue-50 px-4 py-3 border-b border-brand-blue-100">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-brand-blue-500" />
                                    <span className="font-medium text-brand-blue-900">
                                        {formatDate(date)}
                                    </span>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {records.map((record) => (
                                    <div key={record.studentId} className="p-4">
                                        {children.length > 1 && (
                                            <p className="font-medium text-brand-blue-900 mb-3">
                                                {record.studentName}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {record.sessions.map((session, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${session.isPresent
                                                            ? "bg-green-50 text-green-700"
                                                            : "bg-red-50 text-red-700"
                                                        }`}
                                                >
                                                    {session.isPresent ? (
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4" />
                                                    )}
                                                    <span>{session.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
