"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
    FileText,
    Calendar,
    Loader2,
    TrendingUp,
    Users,
    Filter,
    ClipboardList,
    Trash2,
    ChevronDown,
    ChevronUp,
    CheckCircle,
    XCircle,
    Clock,
    PieChart,
    AlertCircle,
    BookOpen,
    Search,
    RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ============ TYPES ============
interface StudentReport {
    id: string;
    name: string;
    halaqah: string;
    status: string;
    totalScores: number;
    avgSetoran: number;
    completedSurah: number;
    completedKitab: number;
    completedMandzumah: number;
    hafalanBaruCount: number;
    murojaahCount: number;
}

interface AssessmentReport {
    id: string;
    name: string;
    halaqah: string;
    totalInputs: number;
    complianceAdab: number;
    complianceDiscipline: number;
    complianceTotal: number;
}

interface AssessmentLog {
    date: string;
    sessionId: number;
    sessionName: string;
    studentId: string;
    studentName: string;
    halaqah: string;
    details: { criteriaTitle: string; isCompliant: boolean }[];
}

interface DateRange {
    start: string;
    end: string;
}

type TabType = "nilai" | "penilaian" | "statistik";


interface HalaqahDetail {
    id: string;
    name: string;
    status: string;
    totalScores: number;
    avgScore: number;
    latestMaterial: string;
    latestProgress: string;
}

export default function LaporanPage() {
    const { isSuperAdmin, assignedGuruIds, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>("nilai");
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return {
            start: start.toISOString().split("T")[0],
            end: end.toISOString().split("T")[0],
        };
    });

    // Tab 1: Nilai Harian (daily_scores)
    const [reports, setReports] = useState<StudentReport[]>([]);
    const [summary, setSummary] = useState({
        totalSantri: 0,
        totalNilai: 0,
        avgGlobal: 0,
    });

    // Tab 2: Penilaian Adab & Disiplin (daily_assessments)
    const [assessmentReports, setAssessmentReports] = useState<AssessmentReport[]>([]);
    const [assessmentSummary, setAssessmentSummary] = useState({
        totalSantri: 0,
        totalInputs: 0,
        avgCompliance: 0,
    });
    const [assessmentLogs, setAssessmentLogs] = useState<AssessmentLog[]>([]);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [selectedLogHalaqah, setSelectedLogHalaqah] = useState<string>("all");

    // Tab 3: Statistik Hafalan Santri
    const [statistikData, setStatistikData] = useState({
        totalSantri: 0,
        mutqin: 0,
        mutawassith: 0,
        dhaif: 0,
        halaqahStats: [] as { name: string; count: number }[],
    });
    const [selectedHalaqahDetail, setSelectedHalaqahDetail] = useState<string | null>(null);
    const [halaqahDetails, setHalaqahDetails] = useState<HalaqahDetail[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    // Fetch data when tab or date changes
    useEffect(() => {
        if (authLoading) return;

        if (activeTab === "nilai") {
            fetchNilaiReports();
        } else if (activeTab === "penilaian") {
            fetchAssessmentReports();
        } else if (activeTab === "statistik") {
            fetchStatistikReports();
        }
    }, [dateRange, activeTab, authLoading, isSuperAdmin]);

    // ============ TAB 1: NILAI HARIAN ============
    async function fetchNilaiReports() {
        setLoading(true);

        const { data: students } = await supabase
            .from("students")
            .select("id, name, halaqah, status")
            .order("name");

        // Filter for Active Halaqahs only
        const { data: activeHalaqahs } = await supabase
            .from("halaqah")
            .select("name, teacher_id")
            .eq("status", "active");

        let activeHalaqahNames: string[] = [];

        if (activeHalaqahs) {
            if (isSuperAdmin) {
                // Super Admin sees all active halaqahs
                activeHalaqahNames = activeHalaqahs.map(h => h.name);
            } else {
                // Regular Admin sees only halaqahs managed by assigned gurus
                activeHalaqahNames = activeHalaqahs
                    .filter(h => h.teacher_id && assignedGuruIds.includes(h.teacher_id))
                    .map(h => h.name);
            }
        }

        // Filter students belonging to active halaqahs
        const activeStudents = students?.filter((s) => activeHalaqahNames.includes(s.halaqah)) || [];

        if (activeStudents.length === 0) {
            setReports([]);
            setLoading(false);
            return;
        }

        const { data: scores } = await supabase
            .from("daily_scores")
            .select("student_id, setoran, created_at, hafalan_type")
            .gte("created_at", `${dateRange.start}T00:00:00`)
            .lte("created_at", `${dateRange.end}T23:59:59`);

        // Fetch ALL-TIME completion counts (ignoring date range)
        // Fetch all notes that are not null for active students
        const activeStudentIds = activeStudents.map(s => s.id);
        const { data: completionData } = await supabase
            .from("daily_scores")
            .select("student_id, note")
            .in("student_id", activeStudentIds)
            .not("note", "is", null);

        const studentReports: StudentReport[] = activeStudents.map((student) => {
            // Calculate scores for date range
            const studentScores = scores?.filter((s) => s.student_id === student.id) || [];

            // Calculate all-time completion stats
            const studentCompletions = completionData?.filter(c => c.student_id === student.id) || [];
            const completedSurah = studentCompletions.filter(c => c.note?.toLowerCase().includes("(selesai surah)")).length;
            const completedKitab = studentCompletions.filter(c => c.note?.toLowerCase().includes("(selesai kitab)")).length;
            const completedMandzumah = studentCompletions.filter(c => c.note?.toLowerCase().includes("(selesai mandzumah)")).length;

            if (studentScores.length === 0) {
                return {
                    id: student.id,
                    name: student.name,
                    halaqah: student.halaqah,
                    status: student.status,
                    totalScores: 0,
                    avgSetoran: 0,
                    completedSurah,
                    completedKitab,
                    completedMandzumah,
                    hafalanBaruCount: 0,
                    murojaahCount: 0,
                };
            }

            const avgSetoran = studentScores.reduce((sum, s) => sum + s.setoran, 0) / studentScores.length;
            const hafalanBaruCount = studentScores.filter((s: any) => s.hafalan_type === 'baru').length;
            const murojaahCount = studentScores.filter((s: any) => s.hafalan_type === 'murojaah').length;

            return {
                id: student.id,
                name: student.name,
                halaqah: student.halaqah,
                status: student.status,
                totalScores: studentScores.length,
                avgSetoran: Math.round(avgSetoran * 10) / 10,
                completedSurah,
                completedKitab,
                completedMandzumah,
                hafalanBaruCount,
                murojaahCount,
            };
        });

        // Use ALL students for the list, not just those with scores (so we can see completion stats even if no score in range)
        // But for summary averages, we might still want to count only those with scores? 
        // Or should we list everyone? 
        // Existing logic filtered filtering out 0 scores *from the summary calc*, but listed everyone?
        // Wait, lines 162-170 in original code returned 0 values if no scores.
        // So all active students were returned.

        const studentsWithScores = studentReports.filter((r) => r.totalScores > 0);
        const totalNilai = studentReports.reduce((sum, r) => sum + r.totalScores, 0);
        const avgGlobal =
            studentsWithScores.length > 0
                ? studentsWithScores.reduce((sum, r) => sum + r.avgSetoran, 0) / studentsWithScores.length
                : 0;

        setSummary({
            totalSantri: activeStudents.length,
            totalNilai,
            avgGlobal: Math.round(avgGlobal * 10) / 10,
        });

        setReports(studentReports);
        setLoading(false);
    }

    // ============ TAB 2: PENILAIAN ADAB & DISIPLIN ============
    async function fetchAssessmentReports() {
        setLoading(true);

        // Fetch students
        const { data: students } = await supabase
            .from("students")
            .select("id, name, halaqah")
            .order("name");

        // Filter for Active Halaqahs only
        const { data: activeHalaqahs } = await supabase
            .from("halaqah")
            .select("name, teacher_id")
            .eq("status", "active");

        let activeHalaqahNames: string[] = [];

        if (activeHalaqahs) {
            if (isSuperAdmin) {
                // Super Admin sees all active halaqahs
                activeHalaqahNames = activeHalaqahs.map(h => h.name);
            } else {
                // Regular Admin sees only halaqahs managed by assigned gurus
                activeHalaqahNames = activeHalaqahs
                    .filter(h => h.teacher_id && assignedGuruIds.includes(h.teacher_id))
                    .map(h => h.name);
            }
        }
        const activeStudents = students?.filter((s) => activeHalaqahNames.includes(s.halaqah)) || [];

        // Fetch criteria
        const { data: criteriaData } = await supabase
            .from("criteria_ref")
            .select("id, aspect, title")
            .eq("is_active", true);

        // Fetch sessions (All sessions to resolve names for history)
        const { data: sessionsData } = await supabase
            .from("sessions_ref")
            .select("id, name")
            .order("sort_order");

        // Fetch assessments within date range
        const { data: assessments } = await supabase
            .from("daily_assessments")
            .select("*")
            .gte("date", dateRange.start)
            .lte("date", dateRange.end)
            .order("date", { ascending: false });

        if (!activeStudents || !criteriaData || !assessments) {
            setLoading(false);
            return;
        }

        const sessionsMap = new Map(sessionsData?.map((s) => [s.id, s.name]) || []);
        const criteriaMap = new Map(criteriaData.map((c) => [c.id, { aspect: c.aspect, title: c.title }]));

        // Calculate per-student compliance
        const assessmentReports: AssessmentReport[] = activeStudents.map((student) => {
            const studentAssessments = assessments.filter((a) => a.student_id === student.id);

            if (studentAssessments.length === 0) {
                return {
                    id: student.id,
                    name: student.name,
                    halaqah: student.halaqah,
                    totalInputs: 0,
                    complianceAdab: 0,
                    complianceDiscipline: 0,
                    complianceTotal: 0,
                };
            }

            const adabAssessments = studentAssessments.filter(
                (a) => criteriaMap.get(a.criteria_id)?.aspect === "adab"
            );
            const disciplineAssessments = studentAssessments.filter(
                (a) => criteriaMap.get(a.criteria_id)?.aspect === "discipline"
            );

            const complianceAdab =
                adabAssessments.length > 0
                    ? (adabAssessments.filter((a) => a.is_compliant).length / adabAssessments.length) * 100
                    : 0;
            const complianceDiscipline =
                disciplineAssessments.length > 0
                    ? (disciplineAssessments.filter((a) => a.is_compliant).length / disciplineAssessments.length) * 100
                    : 0;
            const complianceTotal =
                studentAssessments.length > 0
                    ? (studentAssessments.filter((a) => a.is_compliant).length / studentAssessments.length) * 100
                    : 0;

            // Count unique date-session combinations
            const uniqueInputs = new Set(studentAssessments.map((a) => `${a.date}-${a.session_id}`));

            return {
                id: student.id,
                name: student.name,
                halaqah: student.halaqah,
                totalInputs: uniqueInputs.size,
                complianceAdab: Math.round(complianceAdab),
                complianceDiscipline: Math.round(complianceDiscipline),
                complianceTotal: Math.round(complianceTotal),
            };
        });

        // Calculate summary
        const studentsWithInputs = assessmentReports.filter((r) => r.totalInputs > 0);
        const totalInputs = assessmentReports.reduce((sum, r) => sum + r.totalInputs, 0);
        const avgCompliance =
            studentsWithInputs.length > 0
                ? studentsWithInputs.reduce((sum, r) => sum + r.complianceTotal, 0) / studentsWithInputs.length
                : 0;

        setAssessmentSummary({
            totalSantri: activeStudents.length,
            totalInputs,
            avgCompliance: Math.round(avgCompliance),
        });

        setAssessmentReports(assessmentReports);

        // Build logs grouped by date-session-student
        const logMap = new Map<string, AssessmentLog>();
        assessments.forEach((a) => {
            const key = `${a.date}-${a.session_id}-${a.student_id}`;
            const student = students?.find((s) => s.id === a.student_id);
            const criteria = criteriaMap.get(a.criteria_id);

            if (!logMap.has(key)) {
                logMap.set(key, {
                    date: a.date,
                    sessionId: a.session_id,
                    sessionName: sessionsMap.get(a.session_id) || `Sesi ${a.session_id}`,
                    studentId: a.student_id,
                    studentName: student?.name || "Unknown",
                    halaqah: student?.halaqah || "",
                    details: [],
                });
            }

            logMap.get(key)?.details.push({
                criteriaTitle: criteria?.title || `Kriteria ${a.criteria_id}`,
                isCompliant: a.is_compliant,
            });
        });

        setAssessmentLogs(Array.from(logMap.values()).slice(0, 50)); // Limit to 50
        setLoading(false);
    }

    // ============ DELETE ASSESSMENT LOG ============
    async function handleDeleteLog(log: AssessmentLog) {
        if (!confirm(`Hapus semua data penilaian untuk ${log.studentName} pada ${log.date} sesi ${log.sessionName}?`)) {
            return;
        }

        const key = `${log.date}-${log.sessionId}-${log.studentId}`;
        setDeleting(key);

        const { error } = await supabase
            .from("daily_assessments")
            .delete()
            .eq("date", log.date)
            .eq("session_id", log.sessionId)
            .eq("student_id", log.studentId);

        if (error) {
            alert("Gagal menghapus: " + error.message);
        } else {
            // Refresh data
            fetchAssessmentReports();
        }

        setDeleting(null);
    }

    // ============ TAB 3: STATISTIK HAFALAN ============
    async function fetchStatistikReports() {
        setLoading(true);

        // Fetch active halaqahs
        const { data: activeHalaqahs } = await supabase
            .from("halaqah")
            .select("name, teacher_id")
            .eq("status", "active");

        let activeHalaqahNames: string[] = [];

        if (activeHalaqahs) {
            if (isSuperAdmin) {
                // Super Admin sees all active halaqahs
                activeHalaqahNames = activeHalaqahs.map(h => h.name);
            } else {
                // Regular Admin sees only halaqahs managed by assigned gurus
                activeHalaqahNames = activeHalaqahs
                    .filter(h => h.teacher_id && assignedGuruIds.includes(h.teacher_id))
                    .map(h => h.name);
            }
        }

        // Fetch students in active halaqahs
        const { data: students } = await supabase
            .from("students")
            .select("halaqah, status")
            .in("halaqah", activeHalaqahNames);

        if (!students) {
            setLoading(false);
            return;
        }

        const stats = {
            totalSantri: students.length,
            mutqin: students.filter((s) => s.status === "Mutqin").length,
            mutawassith: students.filter((s) => s.status === "Mutawassith").length,
            dhaif: students.filter((s) => s.status === "Dhaif").length,
            halaqahStats: activeHalaqahNames.map(halaqah => ({
                name: halaqah,
                count: students.filter(s => s.halaqah === halaqah).length
            })).sort((a, b) => b.count - a.count)
        };

        setStatistikData(stats);
        setLoading(false);
    }

    async function fetchHalaqahDetails(halaqahName: string) {
        setDetailLoading(true);
        setSelectedHalaqahDetail(halaqahName);

        // 1. Get students in this halaqah
        const { data: students } = await supabase
            .from("students")
            .select("id, name, status")
            .eq("halaqah", halaqahName)
            .order("name");

        if (!students || students.length === 0) {
            setHalaqahDetails([]);
            setDetailLoading(false);
            return;
        }

        const studentIds = students.map((s) => s.id);

        // 2. Get scores with curriculum and note info
        const { data: scores } = await supabase
            .from("daily_scores")
            .select("student_id, setoran, created_at, note, curriculum_items(name)")
            .in("student_id", studentIds)
            .gte("created_at", `${dateRange.start}T00:00:00`)
            .lte("created_at", `${dateRange.end}T23:59:59`)
            .order("created_at", { ascending: false }); // Order by newest first

        // 3. Combine data
        const details: HalaqahDetail[] = students.map((student) => {
            // Score stats
            const studentScores = scores?.filter((s) => s.student_id === student.id) || [];
            const avgScore =
                studentScores.length > 0
                    ? studentScores.reduce((sum, s) => sum + s.setoran, 0) / studentScores.length
                    : 0;

            // Get latest score info
            const latestScore = studentScores[0]; // Since we ordered by desc

            let latestMaterial = "-";
            let latestProgress = "-";

            if (latestScore) {
                // Get Material Name
                if (latestScore.curriculum_items) {
                    latestMaterial = Array.isArray(latestScore.curriculum_items)
                        ? latestScore.curriculum_items[0]?.name
                        : (latestScore.curriculum_items as any).name;
                }

                // Extract Progress from Note
                if (latestScore.note) {
                    const noteLines = latestScore.note.split('\n');
                    const progressLine = noteLines.find((line: string) =>
                        line.startsWith("Halaman:") || line.startsWith("Ayat:")
                    );
                    if (progressLine) {
                        latestProgress = progressLine.trim();
                    }
                }
            }

            return {
                id: student.id,
                name: student.name,
                status: student.status,
                totalScores: studentScores.length,
                avgScore: Math.round(avgScore * 10) / 10,
                latestMaterial: latestMaterial || "-",
                latestProgress: latestProgress || "-",
            };
        });

        setHalaqahDetails(details);
        setDetailLoading(false);
    }

    // ============ HELPERS ============
    function handleQuickDate(days: number) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        setDateRange({
            start: start.toISOString().split("T")[0],
            end: end.toISOString().split("T")[0],
        });
    }

    function getStatusColor(status: string) {
        switch (status) {
            case "Mutqin":
                return { bg: "#c6f6d5", text: "#22543d" };
            case "Dhaif":
                return { bg: "#fed7d7", text: "#822727" };
            default:
                return { bg: "#fefcbf", text: "#744210" };
        }
    }

    function getScoreColor(score: number) {
        if (score >= 90) return "#22543d";
        if (score >= 75) return "#2f855a";
        if (score >= 60) return "#d69e2e";
        return "#822727";
    }

    function getComplianceColor(pct: number) {
        if (pct >= 90) return { bg: "#c6f6d5", text: "#22543d" };
        if (pct >= 70) return { bg: "#fefcbf", text: "#744210" };
        return { bg: "#fed7d7", text: "#822727" };
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }

    // ============ RENDER ============
    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 style={{ color: "#1a365d", fontSize: "1.5rem", fontWeight: 700 }}>
                        Laporan Penilaian
                    </h1>
                    <p style={{ color: "#718096", marginTop: "0.25rem" }}>
                        Laporan rata-rata nilai dan kepatuhan santri
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab("nilai")}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === "nilai"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    <FileText size={18} />
                    Nilai Setoran
                </button>
                <button
                    onClick={() => setActiveTab("penilaian")}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === "penilaian"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    <ClipboardList size={18} />
                    Penilaian Adab & Disiplin
                </button>
                <button
                    onClick={() => setActiveTab("statistik")}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === "statistik"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    <PieChart size={18} />
                    Statistik Hafalan Santri
                </button>
            </div>

            {/* Date Range Filter */}
            <div className="card p-4 mb-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5" style={{ color: "#718096" }} />
                        <span style={{ fontWeight: 500, color: "#1a365d" }}>Filter Tanggal:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label style={{ fontSize: "0.875rem", color: "#718096" }}>Dari:</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                style={{
                                    padding: "0.5rem 0.75rem",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "0.5rem",
                                    color: "#2d3748",
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label style={{ fontSize: "0.875rem", color: "#718096" }}>Sampai:</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                style={{
                                    padding: "0.5rem 0.75rem",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "0.5rem",
                                    color: "#2d3748",
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={() => handleQuickDate(7)}
                            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                            style={{ backgroundColor: "#ebf4ff", color: "#3182ce" }}
                        >
                            7 Hari
                        </button>
                        <button
                            onClick={() => handleQuickDate(30)}
                            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                            style={{ backgroundColor: "#ebf4ff", color: "#3182ce" }}
                        >
                            30 Hari
                        </button>
                        <button
                            onClick={() => handleQuickDate(90)}
                            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                            style={{ backgroundColor: "#ebf4ff", color: "#3182ce" }}
                        >
                            3 Bulan
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="card p-4 mb-6">
                <div className="relative">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                        style={{ color: "#a0aec0" }}
                    />
                    <input
                        type="text"
                        placeholder="Cari santri berdasarkan nama atau halaqah..."
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
            </div>

            {/* ============ TAB 1: NILAI HARIAN ============ */}
            {activeTab === "nilai" && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="card p-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: "#ebf4ff" }}
                                >
                                    <Users className="w-5 h-5" style={{ color: "#3182ce" }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1a365d" }}>
                                        {summary.totalSantri}
                                    </p>
                                    <p style={{ fontSize: "0.75rem", color: "#a0aec0" }}>Total Santri</p>
                                </div>
                            </div>
                        </div>
                        <div className="card p-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: "#fefcbf" }}
                                >
                                    <FileText className="w-5 h-5" style={{ color: "#d69e2e" }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1a365d" }}>
                                        {summary.totalNilai}
                                    </p>
                                    <p style={{ fontSize: "0.75rem", color: "#a0aec0" }}>Total Nilai Masuk</p>
                                </div>
                            </div>
                        </div>
                        <div className="card p-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: "#c6f6d5" }}
                                >
                                    <TrendingUp className="w-5 h-5" style={{ color: "#2f855a" }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1a365d" }}>
                                        {summary.avgGlobal}
                                    </p>
                                    <p style={{ fontSize: "0.75rem", color: "#a0aec0" }}>Rata-rata Global</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reports Table */}
                    <div className="card overflow-hidden">
                        <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <h2 style={{ fontWeight: 600, color: "#1a365d" }}>Rekap Nilai Per Santri</h2>
                            <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "#718096" }}>
                                <Calendar className="w-4 h-4" />
                                {dateRange.start} s/d {dateRange.end}
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#3182ce" }} />
                                <span className="ml-3" style={{ color: "#718096" }}>
                                    Memuat laporan...
                                </span>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ backgroundColor: "#f7fafc" }}>
                                            <th className="text-left px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                                                Nama Santri
                                            </th>
                                            <th className="text-left px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                                                Halaqah
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                                                Status
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                                                Surah Selesai
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                                                Kitab Selesai
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                                                Mandzumah
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                                                Input
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#38a169", textTransform: "uppercase" }}>
                                                H. Baru
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#d69e2e", textTransform: "uppercase" }}>
                                                Murojaah
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#3182ce", textTransform: "uppercase" }}>
                                                Rata-rata Setoran
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reports
                                            .filter((report) =>
                                                report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                report.halaqah.toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .map((report, index) => {
                                                const statusColor = getStatusColor(report.status);
                                                return (
                                                    <tr
                                                        key={report.id}
                                                        style={{
                                                            borderBottom: "1px solid #f0f0f0",
                                                            backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafafa",
                                                        }}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                                                                    style={{ backgroundColor: "#ebf4ff", color: "#3182ce" }}
                                                                >
                                                                    {report.name.charAt(0)}
                                                                </div>
                                                                <span style={{ fontWeight: 500, color: "#2d3748" }}>
                                                                    {report.name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3" style={{ color: "#718096", fontSize: "0.875rem" }}>
                                                            {report.halaqah}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span
                                                                className="px-2 py-1 rounded-full text-xs font-medium"
                                                                style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                                                            >
                                                                {report.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {report.completedSurah > 0 ? (
                                                                    <>
                                                                        <BookOpen className="w-4 h-4 text-green-600" />
                                                                        <span className="font-bold text-gray-900">{report.completedSurah}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-300">-</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {report.completedKitab > 0 ? (
                                                                    <>
                                                                        <BookOpen className="w-4 h-4 text-blue-600" />
                                                                        <span className="font-bold text-gray-900">{report.completedKitab}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-300">-</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {report.completedMandzumah > 0 ? (
                                                                    <>
                                                                        <BookOpen className="w-4 h-4 text-purple-600" />
                                                                        <span className="font-bold text-gray-900">{report.completedMandzumah}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-300">-</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center" style={{ color: "#718096" }}>
                                                            {report.totalScores}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {report.hafalanBaruCount > 0 ? (
                                                                    <>
                                                                        <BookOpen className="w-4 h-4 text-green-600" />
                                                                        <span className="font-bold text-green-700">{report.hafalanBaruCount}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-300">-</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {report.murojaahCount > 0 ? (
                                                                    <>
                                                                        <RefreshCw className="w-4 h-4 text-yellow-600" />
                                                                        <span className="font-bold text-yellow-700">{report.murojaahCount}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-300">-</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span
                                                                className="px-3 py-1 rounded-lg font-bold"
                                                                style={{
                                                                    backgroundColor: report.avgSetoran > 0 ? "#ebf4ff" : "#f7fafc",
                                                                    color: report.avgSetoran > 0 ? getScoreColor(report.avgSetoran) : "#a0aec0",
                                                                }}
                                                            >
                                                                {report.avgSetoran > 0 ? report.avgSetoran : "-"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!loading && reports.length === 0 && (
                            <div className="text-center p-12">
                                <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: "#e2e8f0" }} />
                                <h3 style={{ fontSize: "1.125rem", fontWeight: 500, color: "#718096" }}>
                                    Belum ada data
                                </h3>
                                <p style={{ color: "#a0aec0", marginTop: "0.25rem" }}>
                                    Data nilai akan muncul setelah ada input nilai santri
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ============ TAB 2: PENILAIAN ADAB & DISIPLIN ============ */}
            {activeTab === "penilaian" && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="card p-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: "#ebf4ff" }}
                                >
                                    <Users className="w-5 h-5" style={{ color: "#3182ce" }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1a365d" }}>
                                        {assessmentSummary.totalSantri}
                                    </p>
                                    <p style={{ fontSize: "0.75rem", color: "#a0aec0" }}>Total Santri</p>
                                </div>
                            </div>
                        </div>
                        <div className="card p-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: "#fefcbf" }}
                                >
                                    <ClipboardList className="w-5 h-5" style={{ color: "#d69e2e" }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1a365d" }}>
                                        {assessmentSummary.totalInputs}
                                    </p>
                                    <p style={{ fontSize: "0.75rem", color: "#a0aec0" }}>Total Input (Sesi)</p>
                                </div>
                            </div>
                        </div>
                        <div className="card p-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: "#c6f6d5" }}
                                >
                                    <CheckCircle className="w-5 h-5" style={{ color: "#2f855a" }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1a365d" }}>
                                        {assessmentSummary.avgCompliance}%
                                    </p>
                                    <p style={{ fontSize: "0.75rem", color: "#a0aec0" }}>Tingkat Kepatuhan</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Assessment Reports Table */}
                    <div className="card overflow-hidden mb-6">
                        <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <h2 style={{ fontWeight: 600, color: "#1a365d" }}>Rekap Kepatuhan Per Santri</h2>
                            <div className="flex items-center gap-2" style={{ fontSize: "0.875rem", color: "#718096" }}>
                                <Calendar className="w-4 h-4" />
                                {dateRange.start} s/d {dateRange.end}
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#3182ce" }} />
                                <span className="ml-3" style={{ color: "#718096" }}>
                                    Memuat laporan...
                                </span>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ backgroundColor: "#f7fafc" }}>
                                            <th className="text-left px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                                                Nama Santri
                                            </th>
                                            <th className="text-left px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                                                Halaqah
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                                                Input (Sesi)
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2f855a", textTransform: "uppercase" }}>
                                                % Adab
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#3182ce", textTransform: "uppercase" }}>
                                                % Disiplin
                                            </th>
                                            <th className="text-center px-4 py-3" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#1a365d", textTransform: "uppercase" }}>
                                                % Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assessmentReports
                                            .filter((report) =>
                                                report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                report.halaqah.toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .map((report, index) => {
                                                const totalColor = getComplianceColor(report.complianceTotal);
                                                return (
                                                    <tr
                                                        key={report.id}
                                                        style={{
                                                            borderBottom: "1px solid #f0f0f0",
                                                            backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafafa",
                                                        }}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                                                                    style={{ backgroundColor: "#ebf4ff", color: "#3182ce" }}
                                                                >
                                                                    {report.name.charAt(0)}
                                                                </div>
                                                                <span style={{ fontWeight: 500, color: "#2d3748" }}>
                                                                    {report.name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3" style={{ color: "#718096", fontSize: "0.875rem" }}>
                                                            {report.halaqah}
                                                        </td>
                                                        <td className="px-4 py-3 text-center" style={{ color: "#718096" }}>
                                                            {report.totalInputs}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {report.totalInputs > 0 ? (
                                                                <span
                                                                    className="px-2 py-1 rounded-full text-xs font-medium"
                                                                    style={{ backgroundColor: getComplianceColor(report.complianceAdab).bg, color: getComplianceColor(report.complianceAdab).text }}
                                                                >
                                                                    {report.complianceAdab}%
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: "#a0aec0" }}>-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {report.totalInputs > 0 ? (
                                                                <span
                                                                    className="px-2 py-1 rounded-full text-xs font-medium"
                                                                    style={{ backgroundColor: getComplianceColor(report.complianceDiscipline).bg, color: getComplianceColor(report.complianceDiscipline).text }}
                                                                >
                                                                    {report.complianceDiscipline}%
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: "#a0aec0" }}>-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {report.totalInputs > 0 ? (
                                                                <span
                                                                    className="px-3 py-1 rounded-lg text-sm font-bold"
                                                                    style={{ backgroundColor: totalColor.bg, color: totalColor.text }}
                                                                >
                                                                    {report.complianceTotal}%
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: "#a0aec0" }}>-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!loading && assessmentReports.length === 0 && (
                            <div className="text-center p-12">
                                <ClipboardList className="w-16 h-16 mx-auto mb-4" style={{ color: "#e2e8f0" }} />
                                <h3 style={{ fontSize: "1.125rem", fontWeight: 500, color: "#718096" }}>
                                    Belum ada data
                                </h3>
                                <p style={{ color: "#a0aec0", marginTop: "0.25rem" }}>
                                    Data akan muncul setelah ada input penilaian harian
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Assessment Logs */}
                    <div className="card overflow-hidden">
                        <div className="p-4" style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                    <h2 style={{ fontWeight: 600, color: "#1a365d" }}>Log Input Penilaian</h2>
                                    <p style={{ fontSize: "0.875rem", color: "#718096", marginTop: "0.25rem" }}>
                                        Histori input penilaian (50 terbaru). Klik untuk detail, gunakan tombol hapus untuk menghapus data yang salah.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label style={{ fontSize: "0.875rem", color: "#718096", whiteSpace: "nowrap" }}>Filter Halaqah:</label>
                                    <select
                                        value={selectedLogHalaqah}
                                        onChange={(e) => setSelectedLogHalaqah(e.target.value)}
                                        style={{
                                            padding: "0.5rem 0.75rem",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "0.5rem",
                                            color: "#2d3748",
                                            minWidth: "150px",
                                            backgroundColor: "white",
                                        }}
                                    >
                                        <option value="all">Semua Halaqah</option>
                                        {Array.from(new Set(assessmentLogs.map(l => l.halaqah))).filter(h => h).sort().map(halaqah => (
                                            <option key={halaqah} value={halaqah}>{halaqah}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#3182ce" }} />
                            </div>
                        ) : assessmentLogs.length === 0 ? (
                            <div className="text-center p-8" style={{ color: "#a0aec0" }}>
                                Belum ada log input
                            </div>
                        ) : (
                            <div>
                                {(() => {
                                    const filteredLogs = (selectedLogHalaqah === "all"
                                        ? assessmentLogs
                                        : assessmentLogs.filter(l => l.halaqah === selectedLogHalaqah))
                                        .filter(l =>
                                            l.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            l.halaqah.toLowerCase().includes(searchQuery.toLowerCase())
                                        );

                                    const groupedLogs = filteredLogs.reduce((acc, log) => {
                                        const halaqah = log.halaqah || "Belum ditentukan";
                                        if (!acc[halaqah]) acc[halaqah] = [];
                                        acc[halaqah].push(log);
                                        return acc;
                                    }, {} as Record<string, AssessmentLog[]>);

                                    const sortedHalaqahs = Object.keys(groupedLogs).sort();

                                    if (filteredLogs.length === 0) {
                                        return (
                                            <div className="text-center p-8" style={{ color: "#a0aec0" }}>
                                                Tidak ada log untuk halaqah ini
                                            </div>
                                        );
                                    }

                                    return sortedHalaqahs.map(halaqah => (
                                        <div key={halaqah}>
                                            {/* Halaqah Header */}
                                            <div
                                                className="px-4 py-3 flex items-center justify-between"
                                                style={{
                                                    backgroundColor: "#f0f7ff",
                                                    borderBottom: "1px solid #e2e8f0",
                                                    borderTop: "1px solid #e2e8f0"
                                                }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-6 h-6 rounded-full flex items-center justify-center"
                                                        style={{ backgroundColor: "#3182ce", color: "white", fontSize: "0.7rem", fontWeight: 600 }}
                                                    >
                                                        {groupedLogs[halaqah].length}
                                                    </div>
                                                    <span style={{ fontWeight: 600, color: "#1a365d" }}>
                                                        Halaqah {halaqah}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: "0.75rem", color: "#718096" }}>
                                                    {groupedLogs[halaqah].length} input
                                                </span>
                                            </div>

                                            {/* Logs for this halaqah */}
                                            <div className="divide-y">
                                                {groupedLogs[halaqah].map((log) => {
                                                    const key = `${log.date}-${log.sessionId}-${log.studentId}`;
                                                    const isExpanded = expandedLog === key;
                                                    const compliantCount = log.details.filter((d) => d.isCompliant).length;

                                                    return (
                                                        <div key={key}>
                                                            <div
                                                                className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                                                                onClick={() => setExpandedLog(isExpanded ? null : key)}
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div
                                                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                                        style={{ backgroundColor: "#ebf4ff" }}
                                                                    >
                                                                        <Clock className="w-5 h-5" style={{ color: "#3182ce" }} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span style={{ fontWeight: 600, color: "#1a365d" }}>
                                                                                {log.studentName}
                                                                            </span>
                                                                            <span
                                                                                className="px-2 py-0.5 rounded text-xs"
                                                                                style={{ backgroundColor: "#ebf4ff", color: "#3182ce" }}
                                                                            >
                                                                                {log.sessionName}
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ fontSize: "0.875rem", color: "#718096" }}>
                                                                            {formatDate(log.date)}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-4">
                                                                    <div className="text-right">
                                                                        <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1a365d" }}>
                                                                            {compliantCount}/{log.details.length} Patuh
                                                                        </div>
                                                                        <div
                                                                            style={{
                                                                                fontSize: "0.75rem",
                                                                                color: getComplianceColor((compliantCount / log.details.length) * 100).text,
                                                                            }}
                                                                        >
                                                                            {Math.round((compliantCount / log.details.length) * 100)}%
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteLog(log);
                                                                        }}
                                                                        disabled={deleting === key}
                                                                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                                                        title="Hapus input ini"
                                                                    >
                                                                        {deleting === key ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                    {isExpanded ? (
                                                                        <ChevronUp className="w-5 h-5" style={{ color: "#718096" }} />
                                                                    ) : (
                                                                        <ChevronDown className="w-5 h-5" style={{ color: "#718096" }} />
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="px-4 pb-4 ml-14">
                                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                                        {log.details.map((detail, idx) => (
                                                                            <div
                                                                                key={idx}
                                                                                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                                                                style={{
                                                                                    backgroundColor: detail.isCompliant ? "#f0fff4" : "#fff5f5",
                                                                                }}
                                                                            >
                                                                                {detail.isCompliant ? (
                                                                                    <CheckCircle className="w-4 h-4" style={{ color: "#38a169" }} />
                                                                                ) : (
                                                                                    <XCircle className="w-4 h-4" style={{ color: "#e53e3e" }} />
                                                                                )}
                                                                                <span
                                                                                    style={{
                                                                                        fontSize: "0.875rem",
                                                                                        color: detail.isCompliant ? "#276749" : "#c53030",
                                                                                    }}
                                                                                >
                                                                                    {detail.criteriaTitle}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ============ TAB 3: STATISTIK HAFALAN ============ */}
            {activeTab === "statistik" && (
                <div className="space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#3182ce" }} />
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="card p-6 flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                                        <Users className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-900">{statistikData.totalSantri}</h3>
                                    <p className="text-sm text-gray-500">Total Santri Aktif</p>
                                </div>
                                <div className="card p-6 flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                                        <CheckCircle className="w-6 h-6 text-green-600" />
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-900">{statistikData.mutqin}</h3>
                                    <p className="text-sm text-gray-500">Mutqin</p>
                                </div>
                                <div className="card p-6 flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-3">
                                        <TrendingUp className="w-6 h-6 text-yellow-600" />
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-900">{statistikData.mutawassith}</h3>
                                    <p className="text-sm text-gray-500">Mutawassith</p>
                                </div>
                                <div className="card p-6 flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                                        <AlertCircle className="w-6 h-6 text-red-600" />
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-900">{statistikData.dhaif}</h3>
                                    <p className="text-sm text-gray-500">Dhaif</p>
                                </div>
                            </div>

                            {/* Halaqah Distribution */}
                            <div className="card p-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Distribusi Santri per Halaqah</h3>
                                <p className="text-sm text-gray-500 mb-4">Klik pada halaqah untuk melihat detail performa santri.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {statistikData.halaqahStats
                                        .filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map((h, i) => (
                                            <button
                                                key={i}
                                                onClick={() => fetchHalaqahDetails(h.name)}
                                                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${selectedHalaqahDetail === h.name
                                                    ? "bg-blue-50 border-blue-200 ring-2 ring-blue-500"
                                                    : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                                                    }`}
                                            >
                                                <span className="font-medium text-gray-700">{h.name}</span>
                                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                                                    {h.count} Santri
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            </div>

                            {/* Detailed Table */}
                            {selectedHalaqahDetail && (
                                <div className="card overflow-hidden mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="p-4 flex items-center justify-between border-b border-gray-100">
                                        <h3 className="text-lg font-bold text-gray-800">
                                            Detail Performa: {selectedHalaqahDetail}
                                        </h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Users className="w-4 h-4" />
                                            {halaqahDetails.length} Santri
                                        </div>
                                    </div>

                                    {detailLoading ? (
                                        <div className="flex items-center justify-center p-12">
                                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nama Santri</th>
                                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                                        <th className="px-6 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Rata-rata Nilai</th>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-purple-600 uppercase">Input Terakhir</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {halaqahDetails
                                                        .filter(student =>
                                                            student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                            student.status.toLowerCase().includes(searchQuery.toLowerCase())
                                                        )
                                                        .map((student) => (
                                                            <tr key={student.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(student.status).bg
                                                                        } ${getStatusColor(student.status).text}`}>
                                                                        {student.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-center font-bold text-gray-700">
                                                                    {student.totalScores > 0 ? student.avgScore : "-"}
                                                                </td>
                                                                <td className="px-6 py-4 text-left">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium text-gray-900">{student.latestMaterial}</span>
                                                                        <span className="text-xs text-gray-500">{student.latestProgress}</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
