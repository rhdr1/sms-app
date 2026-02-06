"use client";

import { useState, useEffect, use } from "react";
import { BookOpen, TrendingUp, Calendar, Clock, ChevronLeft, AlertCircle, CheckCircle, XCircle, MinusCircle, UserCheck } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useWaliAuth } from "@/contexts/WaliAuthContext";

interface ScoreRecord {
    id: string;
    date: string;
    setoran: number;
    curriculum_name: string;
    curriculum_category: string;
    note: string | null;
}

interface AssessmentRecord {
    date: string;
    session_name: string;
    criteria_title: string;
    aspect: string;
    is_compliant: boolean;
}

interface ChildData {
    id: string;
    name: string;
    halaqah: string;
    status: string;
    average_score: number;
}

export default function ChildDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const { children } = useWaliAuth();
    const [child, setChild] = useState<ChildData | null>(null);
    const [scores, setScores] = useState<ScoreRecord[]>([]);
    const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
    const [attendanceStats, setAttendanceStats] = useState({
        present: 0,
        sick: 0,
        permit: 0,
        alpha: 0,
        total: 0,
        rate: 0
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"nilai" | "penilaian" | "kehadiran">("nilai");

    useEffect(() => {
        // Find child from context
        const foundChild = children.find(c => c.id === id);
        if (foundChild) {
            // Only set initial data from context if we don't have data for this ID yet
            setChild(prev => (prev?.id === id ? prev : foundChild));
            fetchChildData(id);
        } else {
            // Handle case where child is not found (e.g., unauthorized)
            // Only stop loading if we are sure children list is populated
            if (children.length > 0) {
                setLoading(false);
            }
        }
    }, [id, children]);

    async function fetchChildData(studentId: string) {
        setLoading(true);
        try {
            // 0. Fetch latest Student Profile (to sync average_score & status)
            const { data: studentData } = await supabase
                .from("students")
                .select("id, name, halaqah, status, average_score")
                .eq("id", studentId)
                .single();

            if (studentData) {
                setChild(studentData);
            }

            // 1. Fetch recent scores
            const { data: scoresData } = await supabase
                .from("daily_scores")
                .select(`
                    id,
                    created_at,
                    setoran,
                    note,
                    curriculum_items:curriculum_id (
                        name,
                        category
                    )
                `)
                .eq("student_id", studentId)
                .order("created_at", { ascending: false })
                .limit(20);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const formattedScores = (scoresData || []).map((s: any) => ({
                id: s.id,
                date: s.created_at,
                setoran: s.setoran,
                curriculum_name: s.curriculum_items?.name || "Tidak ada",
                curriculum_category: s.curriculum_items?.category || "",
                note: s.note,
            }));

            setScores(formattedScores);

            // 2. Fetch recent assessments (General)
            const { data: assessmentsData } = await supabase
                .from("daily_assessments")
                .select(`
                    date,
                    is_compliant,
                    sessions_ref:session_id (name),
                    criteria_ref:criteria_id (title, aspect)
                `)
                .eq("student_id", studentId)
                .order("date", { ascending: false })
                .limit(30);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const formattedAssessments = (assessmentsData || []).map((a: any) => ({
                date: a.date,
                session_name: a.sessions_ref?.name || "",
                criteria_title: a.criteria_ref?.title || "",
                aspect: a.criteria_ref?.aspect || "",
                is_compliant: a.is_compliant,
            }));

            setAssessments(formattedAssessments);

            // 3. Fetch Attendance Stats
            // Get 'Kehadiran' criteria ID first
            const { data: criteriaData } = await supabase
                .from("criteria_ref")
                .select("id")
                .ilike("title", "%kehadiran%")
                .single();

            if (criteriaData) {
                const { data: attendanceData } = await supabase
                    .from("daily_assessments")
                    .select("is_compliant, absence_reason")
                    .eq("student_id", studentId)
                    .eq("criteria_id", criteriaData.id);

                if (attendanceData) {
                    let sick = 0, permit = 0, alpha = 0, present = 0;
                    attendanceData.forEach(r => {
                        if (r.is_compliant) {
                            present++;
                        } else {
                            if (r.absence_reason === 'sakit') sick++;
                            else if (r.absence_reason === 'izin') permit++;
                            else alpha++;
                        }
                    });
                    const total = present + sick + permit + alpha;
                    const rate = total > 0 ? (present / total) * 100 : 0;

                    setAttendanceStats({
                        present, sick, permit, alpha, total, rate
                    });
                }
            }

        } catch (error) {
            console.error("Error fetching child data:", error);
        } finally {
            setLoading(false);
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            weekday: "short",
            day: "numeric",
            month: "short",
        });
    }

    function getScoreColor(score: number) {
        if (score >= 90) return { bg: "#dcfce7", text: "#166534" };
        if (score >= 70) return { bg: "#fef9c3", text: "#854d0e" };
        return { bg: "#fee2e2", text: "#991b1b" };
    }

    function getStatusColor(status: string) {
        switch (status) {
            case "Mutqin":
                return { bg: "#dcfce7", text: "#166534" };
            case "Dhaif":
                return { bg: "#fee2e2", text: "#991b1b" };
            default:
                return { bg: "#fef9c3", text: "#854d0e" };
        }
    }

    // --- Chart Components ---
    function ScoreChart({ data }: { data: ScoreRecord[] }) {
        if (data.length < 2) return null;

        // Take last 10 scores and reverse for chronological order
        const chartData = [...data].slice(0, 10).reverse();
        const maxScore = 100;
        const minScore = 0;
        const width = 100; // percent
        const height = 60; // relative units

        // Normalize points
        const points = chartData.map((d, i) => {
            const x = (i / (chartData.length - 1)) * 100;
            const y = height - ((d.setoran - minScore) / (maxScore - minScore)) * height;
            return `${x},${y}`;
        }).join(" ");

        return (
            <div className="w-full h-32 relative mt-4">
                <svg viewBox={`0 0 100 ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2" />
                    <line x1="0" y1={height / 2} x2="100" y2={height / 2} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2" />
                    <line x1="0" y1={height} x2="100" y2={height} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2" />

                    {/* Gradient Area */}
                    <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path
                        d={`M0,${height} L${points.replace(/ /g, " L")} L100,${height} Z`}
                        fill="url(#scoreGradient)"
                    />

                    {/* Line */}
                    <polyline
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        points={points}
                        vectorEffect="non-scaling-stroke"
                    />

                    {/* Dots */}
                    {chartData.map((d, i) => {
                        const x = (i / (chartData.length - 1)) * 100;
                        const y = height - ((d.setoran - minScore) / (maxScore - minScore)) * height;
                        return (
                            <circle
                                key={d.id}
                                cx={x}
                                cy={y}
                                r="1.5"
                                fill="#fff"
                                stroke="#3b82f6"
                                strokeWidth="0.5"
                            />
                        );
                    })}
                </svg>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>{formatDate(chartData[0].date)}</span>
                    <span>{formatDate(chartData[chartData.length - 1].date)}</span>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-gray-200 rounded-full"></div>
                    <div className="w-12 h-12 border-4 border-brand-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
            </div>
        );
    }

    if (!child) {
        return (
            <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl shadow-sm text-center border border-gray-100">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                    Anak Tidak Ditemukan
                </h2>
                <p className="text-gray-500 mb-6">
                    Data anak tidak ditemukan atau Anda tidak memiliki akses.
                </p>
                <Link
                    href="/dashboard/wali"
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-blue-600 text-white rounded-xl hover:bg-brand-blue-700 transition-all font-medium"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Kembali ke Beranda
                </Link>
            </div>
        );
    }

    const statusColor = getStatusColor(child.status);

    return (
        <div className="space-y-6 pb-20 max-w-5xl mx-auto">
            {/* Navigation & Title */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/wali"
                    className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{child.name}</h1>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{child.halaqah}</span>
                        <span>•</span>
                        <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                            style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                        >
                            {child.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Average Score Card */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <BookOpen className="w-16 h-16 text-brand-blue-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-sm font-medium mb-1">Rata-rata Nilai</p>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-gray-900">{child.average_score.toFixed(1)}</span>
                            <span className="text-sm text-gray-400 mb-1">/ 100</span>
                        </div>
                        <div className="mt-4 flex items-center gap-1.5 text-xs text-brand-blue-600 font-medium bg-brand-blue-50 w-fit px-2 py-1 rounded-lg">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Performa Akademik</span>
                        </div>
                    </div>
                </div>

                {/* Latest Score Card */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingUp className="w-16 h-16 text-emerald-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-sm font-medium mb-1">Setoran Terakhir</p>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-gray-900">
                                {scores.length > 0 ? scores[0].setoran : "-"}
                            </span>
                            <span className="text-sm text-gray-400 mb-1">poin</span>
                        </div>
                        <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{scores.length > 0 ? formatDate(scores[0].date) : "Belum ada data"}</span>
                        </div>
                    </div>
                </div>

                {/* Attendance Rate Card */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <UserCheck className="w-16 h-16 text-indigo-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-sm font-medium mb-1">Rate Kehadiran</p>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-gray-900">{attendanceStats.rate.toFixed(0)}%</span>
                        </div>
                        <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-indigo-500 h-full rounded-full"
                                style={{ width: `${attendanceStats.rate}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
                {/* Tabs Header */}
                <div className="border-b border-gray-100 px-6 pt-6">
                    <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                        <button
                            onClick={() => setActiveTab("nilai")}
                            className={`pb-2 text-sm font-semibold transition-all whitespace-nowrap border-b-2 ${activeTab === "nilai"
                                ? "border-brand-blue-600 text-brand-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            Riwayat Nilai
                        </button>
                        <button
                            onClick={() => setActiveTab("penilaian")}
                            className={`pb-2 text-sm font-semibold transition-all whitespace-nowrap border-b-2 ${activeTab === "penilaian"
                                ? "border-brand-blue-600 text-brand-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            Penilaian Karakter
                        </button>
                        <button
                            onClick={() => setActiveTab("kehadiran")}
                            className={`pb-2 text-sm font-semibold transition-all whitespace-nowrap border-b-2 ${activeTab === "kehadiran"
                                ? "border-brand-blue-600 text-brand-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            Statistik Kehadiran
                        </button>
                    </div>
                </div>

                {/* Tab Body */}
                <div className="p-6">
                    {/* --- TAB: NILAI --- */}
                    {activeTab === "nilai" && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Chart Section */}
                            <div className="mb-8 p-4 bg-blue-50/50 rounded-xl border border-blue-50">
                                <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-brand-blue-600" />
                                    Tren Nilai 10 Setoran Terakhir
                                </h3>
                                <ScoreChart data={scores} />
                            </div>

                            <h3 className="text-base font-bold text-gray-900 mb-4">Riwayat Lengkap</h3>
                            {scores.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    Belum ada data nilai setoran.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {scores.map((score) => {
                                        const scoreColor = getScoreColor(score.setoran);
                                        return (
                                            <div
                                                key={score.id}
                                                className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-brand-blue-200 hover:shadow-md transition-all"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="mt-1 p-2 bg-gray-50 rounded-lg text-gray-500 group-hover:bg-brand-blue-50 group-hover:text-brand-blue-600 transition-colors">
                                                        <Clock className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">
                                                            {score.curriculum_name}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-600 font-medium">
                                                                {score.curriculum_category}
                                                            </span>
                                                            <span>•</span>
                                                            <span>{formatDate(score.date)}</span>
                                                        </div>
                                                        {score.note && (
                                                            <p className="text-sm text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg italic border border-gray-100">
                                                                "{score.note}"
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-3 sm:mt-0 flex items-center justify-end">
                                                    <span
                                                        className="px-4 py-1.5 font-bold rounded-lg text-lg tabular-nums"
                                                        style={{ backgroundColor: scoreColor.bg, color: scoreColor.text }}
                                                    >
                                                        {score.setoran}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- TAB: PENILAIAN --- */}
                    {activeTab === "penilaian" && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {assessments.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    Belum ada data penilaian harian.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {assessments.map((assessment, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${assessment.is_compliant
                                                    ? "bg-green-100 text-green-600"
                                                    : "bg-red-100 text-red-600"
                                                    }`}>
                                                    {assessment.is_compliant ? (
                                                        <CheckCircle className="w-5 h-5" />
                                                    ) : (
                                                        <XCircle className="w-5 h-5" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">
                                                        {assessment.criteria_title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                        <span className="capitalize bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                                            {assessment.aspect}
                                                        </span>
                                                        <span>•</span>
                                                        {formatDate(assessment.date)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-medium text-gray-400 mb-1">{assessment.session_name}</p>
                                                <span
                                                    className={`px-2.5 py-1 text-xs font-bold rounded-md ${assessment.is_compliant
                                                        ? "text-green-700 bg-green-50"
                                                        : "text-red-700 bg-red-50"
                                                        }`}
                                                >
                                                    {assessment.is_compliant ? "Baik" : "Perbaikan"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- TAB: KEHADIRAN --- */}
                    {activeTab === "kehadiran" && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                                        <p className="text-sm font-semibold text-emerald-800">Hadir</p>
                                    </div>
                                    <p className="text-3xl font-bold text-emerald-700">{attendanceStats.present}</p>
                                    <p className="text-xs text-emerald-600 mt-1">Hari</p>
                                </div>
                                <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MinusCircle className="w-5 h-5 text-blue-600" />
                                        <p className="text-sm font-semibold text-blue-800">Izin</p>
                                    </div>
                                    <p className="text-3xl font-bold text-blue-700">{attendanceStats.permit}</p>
                                    <p className="text-xs text-blue-600 mt-1">Hari</p>
                                </div>
                                <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="w-5 h-5 text-amber-600" />
                                        <p className="text-sm font-semibold text-amber-800">Sakit</p>
                                    </div>
                                    <p className="text-3xl font-bold text-amber-700">{attendanceStats.sick}</p>
                                    <p className="text-xs text-amber-600 mt-1">Hari</p>
                                </div>
                                <div className="p-5 bg-rose-50 rounded-2xl border border-rose-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="w-5 h-5 text-rose-600" />
                                        <p className="text-sm font-semibold text-rose-800">Alpha</p>
                                    </div>
                                    <p className="text-3xl font-bold text-rose-700">{attendanceStats.alpha}</p>
                                    <p className="text-xs text-rose-600 mt-1">Hari</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                <h4 className="font-bold text-gray-900 mb-4">Distribusi Kehadiran</h4>
                                <div className="space-y-4">
                                    {/* Present Bar */}
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-600">Hadir</span>
                                            <span className="font-medium text-gray-900">{attendanceStats.present}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div
                                                className="bg-emerald-500 h-2.5 rounded-full"
                                                style={{ width: `${(attendanceStats.present / attendanceStats.total || 0) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    {/* Non-Present Summary */}
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-600">Tidak Hadir (Sakit/Izin/Alpha)</span>
                                            <span className="font-medium text-gray-900">
                                                {attendanceStats.sick + attendanceStats.permit + attendanceStats.alpha}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 flex overflow-hidden">
                                            <div
                                                className="bg-amber-500 h-2.5"
                                                style={{ width: `${(attendanceStats.sick / attendanceStats.total || 0) * 100}%` }}
                                            />
                                            <div
                                                className="bg-blue-500 h-2.5"
                                                style={{ width: `${(attendanceStats.permit / attendanceStats.total || 0) * 100}%` }}
                                            />
                                            <div
                                                className="bg-rose-500 h-2.5"
                                                style={{ width: `${(attendanceStats.alpha / attendanceStats.total || 0) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Sakit</span>
                                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Izin</span>
                                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500" /> Alpha</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
