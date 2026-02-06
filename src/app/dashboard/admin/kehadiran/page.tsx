"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
    Search,
    Calendar,
    Loader2,
    ChevronDown,
    ChevronUp,
    Download,
    AlertCircle,
    Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AttendanceRecord {
    date: string;
    session_name: string;
    absence_reason: "sakit" | "izin" | "tanpa_keterangan";
}

interface StudentAttendance {
    id: string;
    name: string;
    halaqah: string;
    total_absences: number;
    sakit: number;
    izin: number;
    alpha: number;
    details?: AttendanceRecord[];
}

type DateRange = "7days" | "30days" | "90days" | "all";

export default function KehadiranPage() {
    const { isSuperAdmin, assignedGuruIds } = useAuth();
    const [students, setStudents] = useState<StudentAttendance[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>("30days");
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
    const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

    useEffect(() => {
        fetchAttendanceData();
    }, [isSuperAdmin, assignedGuruIds, dateRange]);

    async function fetchAttendanceData() {
        setLoading(true);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();

        if (dateRange === "7days") {
            startDate.setDate(endDate.getDate() - 7);
        } else if (dateRange === "30days") {
            startDate.setDate(endDate.getDate() - 30);
        } else if (dateRange === "90days") {
            startDate.setDate(endDate.getDate() - 90);
        } else {
            startDate.setFullYear(2020); // Far back enough for "all"
        }

        const startDateStr = startDate.toISOString().split("T")[0];
        const endDateStr = endDate.toISOString().split("T")[0];

        // For regular admin: get halaqah names from assigned teachers
        let allowedHalaqahNames: string[] = [];

        if (!isSuperAdmin && assignedGuruIds.length > 0) {
            const { data: teacherHalaqahs } = await supabase
                .from("halaqah")
                .select("name")
                .in("teacher_id", assignedGuruIds);

            allowedHalaqahNames = teacherHalaqahs?.map((h) => h.name) || [];
        }

        // Get Kehadiran criteria ID
        const { data: criteriaData } = await supabase
            .from("criteria_ref")
            .select("id")
            .ilike("title", "%kehadiran%")
            .single();

        if (!criteriaData) {
            setLoading(false);
            return;
        }

        // Fetch all students
        let studentsQuery = supabase
            .from("students")
            .select("id, name, halaqah")
            .order("name");

        // Filter for regular admin
        if (!isSuperAdmin && allowedHalaqahNames.length > 0) {
            studentsQuery = studentsQuery.in("halaqah", allowedHalaqahNames);
        } else if (!isSuperAdmin && assignedGuruIds.length === 0) {
            // Regular admin with no assignments - show nothing
            setStudents([]);
            setLoading(false);
            return;
        }

        const { data: studentsData } = await studentsQuery;

        if (!studentsData || studentsData.length === 0) {
            setStudents([]);
            setLoading(false);
            return;
        }

        const studentIds = studentsData.map((s) => s.id);

        // Fetch attendance data for all students
        const { data: attendanceData } = await supabase
            .from("daily_assessments")
            .select("student_id, absence_reason")
            .eq("criteria_id", criteriaData.id)
            .eq("is_compliant", false)
            .in("student_id", studentIds)
            .gte("date", startDateStr)
            .lte("date", endDateStr)
            .not("absence_reason", "is", null);

        // Aggregate data by student
        const attendanceMap = new Map<string, StudentAttendance>();

        studentsData.forEach((student) => {
            attendanceMap.set(student.id, {
                id: student.id,
                name: student.name,
                halaqah: student.halaqah,
                total_absences: 0,
                sakit: 0,
                izin: 0,
                alpha: 0,
            });
        });

        attendanceData?.forEach((record) => {
            const student = attendanceMap.get(record.student_id);
            if (student) {
                student.total_absences++;
                if (record.absence_reason === "sakit") {
                    student.sakit++;
                } else if (record.absence_reason === "izin") {
                    student.izin++;
                } else if (record.absence_reason === "tanpa_keterangan") {
                    student.alpha++;
                }
            }
        });

        // Convert to array and sort by total absences
        const studentsList = Array.from(attendanceMap.values()).sort(
            (a, b) => b.total_absences - a.total_absences
        );

        setStudents(studentsList);
        setLoading(false);
    }

    async function fetchStudentDetails(studentId: string) {
        setLoadingDetails(studentId);

        // Calculate date range (same as main fetch)
        const endDate = new Date();
        const startDate = new Date();

        if (dateRange === "7days") {
            startDate.setDate(endDate.getDate() - 7);
        } else if (dateRange === "30days") {
            startDate.setDate(endDate.getDate() - 30);
        } else if (dateRange === "90days") {
            startDate.setDate(endDate.getDate() - 90);
        } else {
            startDate.setFullYear(2020);
        }

        const startDateStr = startDate.toISOString().split("T")[0];
        const endDateStr = endDate.toISOString().split("T")[0];

        // Get Kehadiran criteria ID
        const { data: criteriaData } = await supabase
            .from("criteria_ref")
            .select("id")
            .ilike("title", "%kehadiran%")
            .single();

        if (!criteriaData) {
            setLoadingDetails(null);
            return;
        }

        // Fetch detailed records
        const { data: detailData } = await supabase
            .from("daily_assessments")
            .select("date, absence_reason, session_id, sessions_ref(name)")
            .eq("student_id", studentId)
            .eq("criteria_id", criteriaData.id)
            .eq("is_compliant", false)
            .not("absence_reason", "is", null)
            .gte("date", startDateStr)
            .lte("date", endDateStr)
            .order("date", { ascending: false });

        const details: AttendanceRecord[] =
            detailData?.map((record) => ({
                date: record.date,
                session_name: (record.sessions_ref as any)?.name || "N/A",
                absence_reason: record.absence_reason as "sakit" | "izin" | "tanpa_keterangan",
            })) || [];

        // Update student details
        setStudents((prev) =>
            prev.map((s) =>
                s.id === studentId ? { ...s, details } : s
            )
        );

        setLoadingDetails(null);
    }

    function toggleStudentDetails(studentId: string) {
        if (expandedStudent === studentId) {
            setExpandedStudent(null);
        } else {
            setExpandedStudent(studentId);
            const student = students.find((s) => s.id === studentId);
            if (student && !student.details) {
                fetchStudentDetails(studentId);
            }
        }
    }

    function downloadCSV() {
        const headers = ["Nama Santri", "Halaqah", "Total Absen", "Sakit", "Izin", "Tanpa Keterangan"];
        const rows = filteredStudents.map((s) => [
            s.name,
            s.halaqah,
            s.total_absences.toString(),
            s.sakit.toString(),
            s.izin.toString(),
            s.alpha.toString(),
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row) => row.join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `laporan_kehadiran_${dateRange}_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const filteredStudents = students.filter(
        (s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.halaqah.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalStats = {
        totalAbsences: filteredStudents.reduce((sum, s) => sum + s.total_absences, 0),
        totalSakit: filteredStudents.reduce((sum, s) => sum + s.sakit, 0),
        totalIzin: filteredStudents.reduce((sum, s) => sum + s.izin, 0),
        totalAlpha: filteredStudents.reduce((sum, s) => sum + s.alpha, 0),
    };

    const getAbsenceColor = (type: "sakit" | "izin" | "alpha") => {
        switch (type) {
            case "sakit":
                return "text-orange-600 bg-orange-50";
            case "izin":
                return "text-blue-600 bg-blue-50";
            case "alpha":
                return "text-red-600 bg-red-50";
        }
    };

    const getAbsenceLabel = (reason: string) => {
        switch (reason) {
            case "sakit":
                return "Sakit";
            case "izin":
                return "Izin";
            case "tanpa_keterangan":
                return "Tanpa Keterangan";
            default:
                return reason;
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-brand-blue-900">Detail Kehadiran Santri</h1>
                <p className="text-gray-600 mt-1">
                    Monitoring absensi santri (Sakit, Izin, Tanpa Keterangan)
                </p>
                {!isSuperAdmin && assignedGuruIds.length > 0 && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-brand-blue-900">
                            <span className="font-semibold">Data yang ditampilkan:</span>{" "}
                            {filteredStudents.length} santri dari guru yang Anda awasi
                        </p>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="card p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                            style={{ color: "#a0aec0" }}
                        />
                        <input
                            type="text"
                            placeholder="Cari santri atau halaqah..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: "100%",
                                paddingLeft: "2.75rem",
                                paddingRight: "1rem",
                                paddingTop: "0.75rem",
                                paddingBottom: "0.75rem",
                                border: "1px solid #e2e8f0",
                                borderRadius: "0.5rem",
                                color: "#2d3748",
                                backgroundColor: "#ffffff",
                                outline: "none",
                            }}
                        />
                    </div>

                    {/* Date Range */}
                    <div className="flex gap-2">
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as DateRange)}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500 bg-white"
                        >
                            <option value="7days">7 Hari Terakhir</option>
                            <option value="30days">30 Hari Terakhir</option>
                            <option value="90days">90 Hari Terakhir</option>
                            <option value="all">Semua Data</option>
                        </select>

                        <button
                            onClick={downloadCSV}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                            disabled={filteredStudents.length === 0}
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Absen</p>
                    <p className="text-2xl font-bold text-gray-900">{totalStats.totalAbsences}</p>
                </div>
                <div className="card p-4 border-l-4 border-orange-400">
                    <p className="text-sm text-gray-600 mb-1">Sakit</p>
                    <p className="text-2xl font-bold text-orange-600">{totalStats.totalSakit}</p>
                </div>
                <div className="card p-4 border-l-4 border-blue-400">
                    <p className="text-sm text-gray-600 mb-1">Izin</p>
                    <p className="text-2xl font-bold text-blue-600">{totalStats.totalIzin}</p>
                </div>
                <div className="card p-4 border-l-4 border-red-400">
                    <p className="text-sm text-gray-600 mb-1">Tanpa Keterangan</p>
                    <p className="text-2xl font-bold text-red-600">{totalStats.totalAlpha}</p>
                </div>
            </div>

            {/* Students Table */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-blue-600" />
                        <span className="ml-3 text-gray-600">Memuat data kehadiran...</span>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="text-center p-12">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-600">
                            {searchQuery ? "Data tidak ditemukan" : "Belum ada data kehadiran"}
                        </h3>
                        <p className="text-gray-400 mt-1">
                            {searchQuery
                                ? "Coba kata kunci lain atau ubah filter tanggal"
                                : "Belum ada data absensi untuk periode ini"}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Nama Santri
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Halaqah
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Total Absen
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Sakit
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Izin
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Tanpa Ket
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Detail
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredStudents.map((student) => (
                                    <React.Fragment key={student.id}>
                                        <tr className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-brand-blue-100 flex items-center justify-center">
                                                        <span className="text-brand-blue-600 font-semibold">
                                                            {student.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="font-medium text-gray-900">
                                                        {student.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{student.halaqah}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="font-semibold text-gray-900">
                                                    {student.total_absences}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-1 rounded text-sm font-medium text-orange-600">
                                                    {student.sakit}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-1 rounded text-sm font-medium text-blue-600">
                                                    {student.izin}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-1 rounded text-sm font-medium text-red-600">
                                                    {student.alpha}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {student.total_absences > 0 && (
                                                    <button
                                                        onClick={() => toggleStudentDetails(student.id)}
                                                        className="p-2 text-brand-blue-600 hover:bg-brand-blue-50 rounded-lg transition-colors"
                                                        title="Lihat Detail"
                                                    >
                                                        {expandedStudent === student.id ? (
                                                            <ChevronUp className="w-5 h-5" />
                                                        ) : (
                                                            <ChevronDown className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Expanded Details Row */}
                                        {expandedStudent === student.id && (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-4 bg-gray-50">
                                                    {loadingDetails === student.id ? (
                                                        <div className="flex items-center justify-center py-4">
                                                            <Loader2 className="w-6 h-6 animate-spin text-brand-blue-600" />
                                                            <span className="ml-2 text-gray-600">
                                                                Memuat detail...
                                                            </span>
                                                        </div>
                                                    ) : student.details && student.details.length > 0 ? (
                                                        <div className="space-y-2">
                                                            <h4 className="font-semibold text-gray-700 mb-3">
                                                                Riwayat Absensi
                                                            </h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                {student.details.map((detail, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="p-3 bg-white rounded-lg border border-gray-200"
                                                                    >
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <span className="text-sm font-medium text-gray-700">
                                                                                {new Date(detail.date).toLocaleDateString("id-ID", {
                                                                                    weekday: "short",
                                                                                    year: "numeric",
                                                                                    month: "short",
                                                                                    day: "numeric",
                                                                                })}
                                                                            </span>
                                                                            <span
                                                                                className={`px-2 py-1 rounded text-xs font-medium ${getAbsenceColor(
                                                                                    detail.absence_reason === "tanpa_keterangan"
                                                                                        ? "alpha"
                                                                                        : detail.absence_reason
                                                                                )}`}
                                                                            >
                                                                                {getAbsenceLabel(detail.absence_reason)}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-500">
                                                                            {detail.session_name}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-4 text-gray-500">
                                                            Tidak ada detail yang tersedia
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
