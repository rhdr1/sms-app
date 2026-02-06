"use client";

import { useState, useEffect } from "react";
import { Users, BookOpen, ClipboardList, TrendingUp, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

interface DashboardStats {
    totalSantri: number;
    halaqahAktif: number;
    nilaiMasuk: number;
    rataRataNilai: number;
}

interface RecentActivity {
    id: string;
    studentName: string;
    action: string;
    time: string;
    value?: number;
}

interface AttendanceStats {
    present: number;
    sick: number;
    permission: number;
    alpha: number;
    total: number;
}

export default function GuruDashboardPage() {
    const { profile } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        totalSantri: 0,
        halaqahAktif: 0,
        nilaiMasuk: 0,
        rataRataNilai: 0,
    });
    const [attendanceStats, setAttendanceStats] = useState<AttendanceStats>({
        present: 0,
        sick: 0,
        permission: 0,
        alpha: 0,
        total: 0
    });
    const [activities, setActivities] = useState<RecentActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile) {
            fetchDashboardData();
        }
    }, [profile]);

    async function fetchDashboardData() {
        setLoading(true);

        // First, get halaqah names that belong to this teacher
        let halaqahNames: string[] = [];
        let halaqahCount = 0;

        if (profile?.teacher_id) {
            const { data: teacherHalaqah } = await supabase
                .from("halaqah")
                .select("name")
                .eq("teacher_id", profile.teacher_id)
                .eq("status", "active");

            halaqahNames = teacherHalaqah?.map(h => h.name) || [];
            halaqahCount = halaqahNames.length;
        }

        // If no halaqah assigned, show empty state
        if (halaqahNames.length === 0) {
            setStats({
                totalSantri: 0,
                halaqahAktif: 0,
                nilaiMasuk: 0,
                rataRataNilai: 0,
            });
            setActivities([]);
            setLoading(false);
            return;
        }

        // Fetch students in teacher's halaqah
        const { data: myStudents } = await supabase
            .from("students")
            .select("id")
            .in("halaqah", halaqahNames);

        const studentIds = myStudents?.map(s => s.id) || [];
        const studentCount = studentIds.length;

        // --- Fetch Attendance Stats (Today) ---
        // 1. Get Kehadiran criteria ID
        const { data: criteriaData } = await supabase
            .from("criteria_ref")
            .select("id")
            .ilike("title", "%kehadiran%")
            .single();

        let attStats = { present: 0, sick: 0, permission: 0, alpha: 0, total: 0 };

        if (criteriaData && studentIds.length > 0) {
            const today = new Date().toISOString().split("T")[0];
            const { data: dailyAtt } = await supabase
                .from("daily_assessments")
                .select("student_id, is_compliant, absence_reason")
                .eq("date", today)
                .eq("criteria_id", criteriaData.id)
                .in("student_id", studentIds);

            if (dailyAtt && dailyAtt.length > 0) {
                // Group by student to handle multiple sessions
                const studentStatus: Record<string, string> = {};

                dailyAtt.forEach(rec => {
                    const currentStatus = studentStatus[rec.student_id];
                    let newStatus = 'hadir';

                    if (!rec.is_compliant) {
                        newStatus = rec.absence_reason || 'alpha'; // Default to alpha if reason missing
                    }

                    // Priority: alpha > sakit > izin > hadir
                    // Only update if new status is "worse" or if current is undefined
                    if (!currentStatus) {
                        studentStatus[rec.student_id] = newStatus;
                    } else {
                        if (newStatus === 'tanpa_keterangan' || newStatus === 'alpha') {
                            studentStatus[rec.student_id] = 'alpha';
                        } else if (newStatus === 'sakit' && currentStatus !== 'alpha') {
                            studentStatus[rec.student_id] = 'sakit';
                        } else if (newStatus === 'izin' && currentStatus !== 'alpha' && currentStatus !== 'sakit') {
                            studentStatus[rec.student_id] = 'izin';
                        }
                    }
                });

                // Count stats
                Object.values(studentStatus).forEach(status => {
                    if (status === 'hadir') attStats.present++;
                    else if (status === 'sakit') attStats.sick++;
                    else if (status === 'izin') attStats.permission++;
                    else attStats.alpha++;
                });

                attStats.total = Object.keys(studentStatus).length;
            }
        }
        setAttendanceStats(attStats);
        // --------------------------------------

        // Fetch total scores (last 7 days) for teacher's students
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let scoresCount = 0;
        let avgScore = 0;

        if (studentIds.length > 0) {
            const { count } = await supabase
                .from("daily_scores")
                .select("*", { count: "exact", head: true })
                .in("student_id", studentIds)
                .gte("created_at", sevenDaysAgo.toISOString());

            scoresCount = count || 0;

            // Fetch average setoran score
            const { data: scoresData } = await supabase
                .from("daily_scores")
                .select("setoran")
                .in("student_id", studentIds)
                .gte("created_at", sevenDaysAgo.toISOString());

            if (scoresData && scoresData.length > 0) {
                const totalAvg = scoresData.reduce((sum, score) => sum + score.setoran, 0);
                avgScore = totalAvg / scoresData.length;
            }
        }

        // Fetch recent activities for teacher's students
        let recentActivities: RecentActivity[] = [];
        if (studentIds.length > 0) {
            const { data: recentScores } = await supabase
                .from("daily_scores")
                .select(`
                    id,
                    setoran,
                    created_at,
                    student_id
                `)
                .in("student_id", studentIds)
                .order("created_at", { ascending: false })
                .limit(5);

            if (recentScores && recentScores.length > 0) {
                const scoreStudentIds = recentScores.map(s => s.student_id);
                const { data: students } = await supabase
                    .from("students")
                    .select("id, name")
                    .in("id", scoreStudentIds);

                recentActivities = recentScores.map(score => {
                    const student = students?.find(s => s.id === score.student_id);
                    const timeAgo = formatTimeAgo(new Date(score.created_at));

                    return {
                        id: score.id,
                        studentName: student?.name || "Unknown",
                        action: `mendapat nilai setoran ${score.setoran}`,
                        time: timeAgo,
                        value: score.setoran,
                    };
                });
            }
        }

        setStats({
            totalSantri: studentCount,
            halaqahAktif: halaqahCount,
            nilaiMasuk: scoresCount,
            rataRataNilai: Math.round(avgScore * 10) / 10,
        });
        setActivities(recentActivities);
        setLoading(false);
    }

    function formatTimeAgo(date: Date): string {
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return "Baru saja";
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit lalu`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam lalu`;
        return `${Math.floor(diffInSeconds / 86400)} hari lalu`;
    }

    const statsConfig = [
        {
            label: "Total Santri",
            value: stats.totalSantri.toString(),
            icon: Users,
            bgColor: "#ebf4ff",
            iconColor: "#3182ce"
        },
        {
            label: "Halaqah Aktif",
            value: stats.halaqahAktif.toString(),
            icon: BookOpen,
            bgColor: "#c6f6d5",
            iconColor: "#2f855a"
        },
        {
            label: "Nilai Masuk",
            value: stats.nilaiMasuk.toString(),
            icon: ClipboardList,
            bgColor: "#fefcbf",
            iconColor: "#d69e2e"
        },
        {
            label: "Rata-rata Nilai",
            value: stats.rataRataNilai.toString(),
            icon: TrendingUp,
            bgColor: "#e9d8fd",
            iconColor: "#805ad5"
        },
    ];

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#3182ce" }} />
                <span className="ml-3" style={{ color: "#718096" }}>Memuat data...</span>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 style={{ color: "#1a365d", fontSize: "1.5rem", fontWeight: 700 }}>
                    Dashboard Guru
                </h1>
                <p style={{ color: "#718096", marginTop: "0.25rem" }}>
                    Selamat datang kembali, {profile?.full_name || "Ustadz"}!
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statsConfig.map((stat) => (
                    <div key={stat.label} className="card p-6">
                        <div className="flex items-center gap-4">
                            <div
                                className="w-12 h-12 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: stat.bgColor }}
                            >
                                <stat.icon className="w-6 h-6" style={{ color: stat.iconColor }} />
                            </div>
                            <div>
                                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1a365d" }}>
                                    {stat.value}
                                </p>
                                <p style={{ fontSize: "0.875rem", color: "#a0aec0" }}>
                                    {stat.label}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Attendance Visual */}
            <div className="card p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1a365d" }}>
                        Statistik Kehadiran Hari Ini
                    </h2>
                    <span className="text-sm text-gray-500">
                        Total Santri: {attendanceStats.total}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex mb-4">
                    {attendanceStats.present > 0 && (
                        <div
                            style={{ width: `${(attendanceStats.present / attendanceStats.total) * 100}%` }}
                            className="h-full bg-green-500"
                            title={`Hadir: ${attendanceStats.present} (${Math.round((attendanceStats.present / attendanceStats.total) * 100)}%)`}
                        />
                    )}
                    {attendanceStats.sick > 0 && (
                        <div
                            style={{ width: `${(attendanceStats.sick / attendanceStats.total) * 100}%` }}
                            className="h-full bg-orange-400"
                            title={`Sakit: ${attendanceStats.sick} (${Math.round((attendanceStats.sick / attendanceStats.total) * 100)}%)`}
                        />
                    )}
                    {attendanceStats.permission > 0 && (
                        <div
                            style={{ width: `${(attendanceStats.permission / attendanceStats.total) * 100}%` }}
                            className="h-full bg-blue-400"
                            title={`Izin: ${attendanceStats.permission} (${Math.round((attendanceStats.permission / attendanceStats.total) * 100)}%)`}
                        />
                    )}
                    {attendanceStats.alpha > 0 && (
                        <div
                            style={{ width: `${(attendanceStats.alpha / attendanceStats.total) * 100}%` }}
                            className="h-full bg-red-500"
                            title={`Tanpa Keterangan: ${attendanceStats.alpha} (${Math.round((attendanceStats.alpha / attendanceStats.total) * 100)}%)`}
                        />
                    )}
                </div>

                {/* Legend / Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm text-gray-600">Hadir: <span className="font-semibold text-gray-900">{attendanceStats.total > 0 ? Math.round((attendanceStats.present / attendanceStats.total) * 100) : 0}%</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-400" />
                        <span className="text-sm text-gray-600">Sakit: <span className="font-semibold text-gray-900">{attendanceStats.total > 0 ? Math.round((attendanceStats.sick / attendanceStats.total) * 100) : 0}%</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-400" />
                        <span className="text-sm text-gray-600">Izin: <span className="font-semibold text-gray-900">{attendanceStats.total > 0 ? Math.round((attendanceStats.permission / attendanceStats.total) * 100) : 0}%</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-sm text-gray-600">Tanpa Ket: <span className="font-semibold text-gray-900">{attendanceStats.total > 0 ? Math.round((attendanceStats.alpha / attendanceStats.total) * 100) : 0}%</span></span>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="card p-6">
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1a365d", marginBottom: "1rem" }}>
                        Aktivitas Terbaru
                    </h2>
                    {activities.length === 0 ? (
                        <p style={{ color: "#a0aec0", textAlign: "center", padding: "2rem 0" }}>
                            Belum ada aktivitas
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {activities.map((activity) => (
                                <div
                                    key={activity.id}
                                    className="flex items-start gap-3 pb-3"
                                    style={{ borderBottom: "1px solid #f0f0f0" }}
                                >
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                                        style={{ backgroundColor: "#1a365d", color: "#ffffff" }}
                                    >
                                        {activity.studentName.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <p style={{ fontSize: "0.875rem", color: "#2d3748" }}>
                                            <span style={{ fontWeight: 600 }}>{activity.studentName}</span>{" "}
                                            {activity.action}
                                        </p>
                                        <p style={{ fontSize: "0.75rem", color: "#a0aec0", marginTop: "0.25rem" }}>
                                            {activity.time}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="card p-6">
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1a365d", marginBottom: "1rem" }}>
                        Aksi Cepat
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <Link
                            href="/dashboard/guru/nilai"
                            className="p-4 rounded-lg transition-colors text-center"
                            style={{ backgroundColor: "#fefcbf" }}
                        >
                            <ClipboardList className="w-8 h-8 mx-auto mb-2" style={{ color: "#1a365d" }} />
                            <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1a365d" }}>
                                Input Nilai
                            </p>
                        </Link>
                        <Link
                            href="/dashboard/guru/santri"
                            className="p-4 rounded-lg transition-colors text-center"
                            style={{ backgroundColor: "#ebf4ff" }}
                        >
                            <Users className="w-8 h-8 mx-auto mb-2" style={{ color: "#1a365d" }} />
                            <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1a365d" }}>
                                Lihat Santri
                            </p>
                        </Link>
                        <Link
                            href="/dashboard/guru/halaqah"
                            className="p-4 rounded-lg transition-colors text-center"
                            style={{ backgroundColor: "#c6f6d5" }}
                        >
                            <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ color: "#1a365d" }} />
                            <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1a365d" }}>
                                Halaqah Saya
                            </p>
                        </Link>


                        <Link
                            href="/dashboard/guru/penilaian-harian"
                            className="p-4 rounded-lg transition-colors text-center"
                            style={{ backgroundColor: "#e9d8fd" }}
                        >
                            <Calendar className="w-8 h-8 mx-auto mb-2" style={{ color: "#1a365d" }} />
                            <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1a365d" }}>
                                Penilaian Harian
                            </p>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
