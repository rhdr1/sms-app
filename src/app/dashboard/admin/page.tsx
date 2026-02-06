"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Users, BookOpen, UserCog, TrendingUp, Loader2, Phone, AlertTriangle, CalendarClock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardStats {
    totalSantri: number;
    totalGuru: number;
    totalHalaqah: number;
    avgScore: number;
    santriMutqin: number;
    santriMutawassith: number;
    santriDhaif: number;
}

interface MissingReport {
    teacherId: string;
    teacherName: string;
    phone: string;
    sessionId: number;
    sessionName: string;
    sessionTime: string;
}

export default function AdminDashboardPage() {
    const { isSuperAdmin, assignedGuruIds } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        totalSantri: 0,
        totalGuru: 0,
        totalHalaqah: 0,
        avgScore: 0,
        santriMutqin: 0,
        santriMutawassith: 0,
        santriDhaif: 0,
    });
    const [attendanceStats, setAttendanceStats] = useState({
        present: 0,
        sick: 0,
        permission: 0,
        alpha: 0,
        total: 0
    });
    const [missingReports, setMissingReports] = useState<MissingReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardStats();
    }, [isSuperAdmin, assignedGuruIds]);

    async function fetchDashboardStats() {
        setLoading(true);

        // For regular admin: get halaqah names from assigned teachers
        let allowedHalaqahNames: string[] = [];

        if (!isSuperAdmin && assignedGuruIds.length > 0) {
            // Get halaqahs managed by assigned teachers
            const { data: teacherHalaqahs } = await supabase
                .from("halaqah")
                .select("name")
                .in("teacher_id", assignedGuruIds);

            allowedHalaqahNames = teacherHalaqahs?.map(h => h.name) || [];
        }

        // Fetch students - filtered for regular admin
        let studentsQuery = supabase
            .from("students")
            .select("id, halaqah, status, average_score");

        // Regular admin: only show students from assigned teachers' halaqahs
        if (!isSuperAdmin && allowedHalaqahNames.length > 0) {
            studentsQuery = studentsQuery.in("halaqah", allowedHalaqahNames);
        } else if (!isSuperAdmin && assignedGuruIds.length === 0) {
            // Regular admin with no assignments - show nothing
            setStats({
                totalSantri: 0,
                totalGuru: 0,
                totalHalaqah: 0,
                avgScore: 0,
                santriMutqin: 0,
                santriMutawassith: 0,
                santriDhaif: 0,
            });
            setAttendanceStats({ present: 0, sick: 0, permission: 0, alpha: 0, total: 0 });
            setMissingReports([]);
            setLoading(false);
            return;
        }

        const { data: students } = await studentsQuery;

        // Fetch teachers - filtered for regular admin
        let teacherCount = 0;
        if (isSuperAdmin) {
            const { data: teachers } = await supabase
                .from("teachers")
                .select("id");
            teacherCount = teachers?.length || 0;
        } else {
            teacherCount = assignedGuruIds.length;
        }

        // Calculate Attendance Stats
        let attStats = { present: 0, sick: 0, permission: 0, alpha: 0, total: 0 };

        // 1. Get Kehadiran criteria ID
        const { data: criteriaData } = await supabase
            .from("criteria_ref")
            .select("id")
            .ilike("title", "%kehadiran%")
            .single();

        if (criteriaData && students) {
            const today = new Date().toISOString().split("T")[0];
            const studentIds = students.map(s => s.id);

            // Only fetch if there are students
            if (studentIds.length > 0) {
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
                            newStatus = rec.absence_reason || 'alpha';
                        }

                        // Priority: alpha > sakit > izin > hadir
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
        }
        setAttendanceStats(attStats);

        if (students) {
            // Calculate unique halaqah
            const uniqueHalaqah = new Set(students.map((s) => s.halaqah));

            // Calculate status counts
            const mutqin = students.filter((s) => s.status === "Mutqin").length;
            const mutawassith = students.filter((s) => s.status === "Mutawassith").length;
            const dhaif = students.filter((s) => s.status === "Dhaif").length;

            // Calculate average score
            const scores = students.map((s) => s.average_score || 0);
            const avgScore = scores.length > 0
                ? scores.reduce((a, b) => a + b, 0) / scores.length
                : 0;

            setStats({
                totalSantri: students.length,
                totalGuru: teacherCount,
                totalHalaqah: uniqueHalaqah.size,
                avgScore: avgScore,
                santriMutqin: mutqin,
                santriMutawassith: mutawassith,
                santriDhaif: dhaif,
            });
        }

        // --- Fetch Missing Reports (Teachers who haven't submitted for sessions) ---
        const today = new Date().toISOString().split("T")[0];

        // Get all active sessions
        const { data: sessions } = await supabase
            .from("sessions_ref")
            .select("id, name, time_start, time_end")
            .eq("is_active", true)
            .order("sort_order", { ascending: true });

        // Get halaqahs with teachers - filtered for regular admin
        let halaqahQuery = supabase
            .from("halaqah")
            .select("id, name, teacher_id, teachers(id, name, phone)")
            .eq("status", "active")
            .not("teacher_id", "is", null);

        if (!isSuperAdmin && assignedGuruIds.length > 0) {
            halaqahQuery = halaqahQuery.in("teacher_id", assignedGuruIds);
        }

        const { data: halaqahsWithTeachers } = await halaqahQuery;

        if (sessions && halaqahsWithTeachers) {
            const missing: MissingReport[] = [];

            for (const session of sessions) {
                // For each session, find halaqahs that have submitted at least one assessment
                const { data: submittedAssessments } = await supabase
                    .from("daily_assessments")
                    .select("student_id, students!inner(halaqah)")
                    .eq("date", today)
                    .eq("session_id", session.id);

                // Get unique halaqah names that have submitted
                const submittedHalaqahNames = new Set<string>();
                if (submittedAssessments) {
                    submittedAssessments.forEach((assessment) => {
                        const studentData = assessment.students as unknown as { halaqah: string }[] | { halaqah: string };
                        if (Array.isArray(studentData) && studentData.length > 0) {
                            submittedHalaqahNames.add(studentData[0].halaqah);
                        } else if (!Array.isArray(studentData) && studentData?.halaqah) {
                            submittedHalaqahNames.add(studentData.halaqah);
                        }
                    });
                }

                // Find halaqahs (and their teachers) that haven't submitted
                for (const halaqah of halaqahsWithTeachers) {
                    if (!submittedHalaqahNames.has(halaqah.name)) {
                        const teacher = halaqah.teachers as unknown as { id: string; name: string; phone: string };
                        if (teacher) {
                            // Format session time
                            const formatTime = (time: string | null) => time ? time.substring(0, 5) : "";
                            const sessionTime = `${formatTime(session.time_start)} - ${formatTime(session.time_end)}`;

                            missing.push({
                                teacherId: teacher.id,
                                teacherName: teacher.name,
                                phone: teacher.phone || "",
                                sessionId: session.id,
                                sessionName: session.name,
                                sessionTime: sessionTime,
                            });
                        }
                    }
                }
            }

            setMissingReports(missing);
        }
        // ---------------------------------------------------

        setLoading(false);
    }

    const getPercentage = (value: number, total: number) => {
        if (total === 0) return "0%";
        return Math.round((value / total) * 100) + "%";
    };

    const statCards = [
        { label: "Total Santri", value: stats.totalSantri, icon: Users, color: "bg-blue-100 text-blue-600" },
        { label: "Total Guru", value: stats.totalGuru, icon: UserCog, color: "bg-green-100 text-green-600" },
        { label: "Total Halaqah", value: stats.totalHalaqah, icon: BookOpen, color: "bg-yellow-100 text-yellow-600" },
        { label: "Rata-rata Global", value: stats.avgScore.toFixed(1), icon: TrendingUp, color: "bg-purple-100 text-purple-600" },
    ];

    const statusStats = [
        { label: "Santri Mutqin", value: stats.santriMutqin, percentage: getPercentage(stats.santriMutqin, stats.totalSantri), color: "text-green-600" },
        { label: "Santri Mutawassith", value: stats.santriMutawassith, percentage: getPercentage(stats.santriMutawassith, stats.totalSantri), color: "text-yellow-600" },
        { label: "Santri Dhaif", value: stats.santriDhaif, percentage: getPercentage(stats.santriDhaif, stats.totalSantri), color: "text-red-600" },
    ];

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-brand-blue-600" />
                <span className="ml-3 text-gray-600">Memuat data dashboard...</span>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-brand-blue-900">Dashboard Admin</h1>
                <p className="text-gray-600 mt-1">Overview sistem manajemen santri</p>
                {!isSuperAdmin && assignedGuruIds.length > 0 && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-brand-blue-900">
                            <span className="font-semibold">Data yang ditampilkan:</span> {stats.totalSantri} santri dari {stats.totalGuru} guru yang Anda awasi
                        </p>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((stat) => (
                    <div key={stat.label} className="card p-6">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-brand-blue-900">{stat.value}</p>
                                <p className="text-sm text-gray-500">{stat.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Attendance Visual */}
            <div className="card p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-brand-blue-900">
                        Statistik Kehadiran Hari Ini (Global)
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Info Card */}
                <div className="card p-6 lg:col-span-2">
                    <h2 className="text-lg font-semibold text-brand-blue-900 mb-4">Ringkasan Data</h2>
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm text-gray-600">Total santri yang terdaftar dalam sistem</p>
                            <p className="text-2xl font-bold text-brand-blue-900 mt-1">{stats.totalSantri} Santri</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                            <p className="text-sm text-gray-600">Total guru/ustadz yang terdaftar</p>
                            <p className="text-2xl font-bold text-green-700 mt-1">{stats.totalGuru} Guru</p>
                        </div>
                        <div className="p-4 bg-yellow-50 rounded-lg">
                            <p className="text-sm text-gray-600">Jumlah halaqah aktif</p>
                            <p className="text-2xl font-bold text-yellow-700 mt-1">{stats.totalHalaqah} Halaqah</p>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-brand-blue-900 mb-4">Status Santri</h2>
                    <div className="space-y-4">
                        {statusStats.map((stat) => (
                            <div key={stat.label} className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">{stat.label}</p>
                                    <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                                </div>
                                <div className={`text-2xl font-bold ${stat.color}`}>
                                    {stat.percentage}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Missing Reports Alert */}
            {missingReports.length > 0 && (
                <div className="card p-6 mt-6 border-l-4 border-orange-400">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        <h2 className="text-lg font-semibold text-brand-blue-900">
                            Guru Belum Input Penilaian Harian ({missingReports.length} laporan tertunda)
                        </h2>
                    </div>
                    <div className="space-y-3">
                        {missingReports.map((report, idx) => {
                            // Create WhatsApp message template
                            const today = new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            const message = encodeURIComponent(
                                `Assalamu'alaikum Ustadz/ah ${report.teacherName},\n\n` +
                                `Mohon untuk segera menginput Penilaian Harian pada:\n` +
                                `Tanggal: ${today}\n` +
                                `Sesi: ${report.sessionName} (${report.sessionTime})\n\n` +
                                `Silakan akses dashboard guru untuk melakukan input.\n\n` +
                                `Jazakumullahu khairan.`
                            );
                            const phoneNumber = report.phone?.replace(/[^0-9]/g, "") || "";
                            const waLink = phoneNumber ? `https://wa.me/${phoneNumber.startsWith("0") ? "62" + phoneNumber.substring(1) : phoneNumber}?text=${message}` : "";

                            return (
                                <div key={`${report.teacherId}-${report.sessionId}`} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800">{report.teacherName}</p>
                                        <p className="text-sm text-gray-500">
                                            <span className="font-medium text-orange-600">{report.sessionName}</span> • {report.sessionTime}
                                        </p>
                                    </div>
                                    {report.phone ? (
                                        <a
                                            href={waLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <Phone className="w-4 h-4" />
                                            Ingatkan
                                        </a>
                                    ) : (
                                        <span className="text-sm text-gray-400 italic">No HP tidak tersedia</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Quick Actions for Admin */}
            <div className="mt-6 card p-6">
                <h2 className="text-lg font-semibold text-brand-blue-900 mb-4">Manajemen Cepat</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <Link href="/dashboard/admin/guru" className="p-4 rounded-lg bg-brand-yellow-100 hover:bg-brand-yellow-400 transition-colors block text-center">
                        <UserCog className="w-8 h-8 text-brand-blue-900 mx-auto mb-2" />
                        <p className="text-sm font-medium text-brand-blue-900">Kelola Guru</p>
                    </Link>
                    <Link href="/dashboard/admin/santri" className="p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors block text-center">
                        <Users className="w-8 h-8 text-brand-blue-900 mx-auto mb-2" />
                        <p className="text-sm font-medium text-brand-blue-900">Kelola Santri</p>
                    </Link>
                    <Link href="/dashboard/admin/halaqah" className="p-4 rounded-lg bg-green-50 hover:bg-green-100 transition-colors block text-center">
                        <BookOpen className="w-8 h-8 text-brand-blue-900 mx-auto mb-2" />
                        <p className="text-sm font-medium text-brand-blue-900">Kelola Halaqah</p>
                    </Link>
                    <Link href="/dashboard/admin/kehadiran" className="p-4 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors block text-center">
                        <CalendarClock className="w-8 h-8 text-brand-blue-900 mx-auto mb-2" />
                        <p className="text-sm font-medium text-brand-blue-900">Detail Kehadiran</p>
                    </Link>
                    <Link href="/dashboard/admin/laporan" className="p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors block text-center">
                        <TrendingUp className="w-8 h-8 text-brand-blue-900 mx-auto mb-2" />
                        <p className="text-sm font-medium text-brand-blue-900">Laporan</p>
                    </Link>
                </div>
            </div>
        </div>
    );
}
