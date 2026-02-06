"use client";

import { useState, useEffect, useRef } from "react";
import {
    Loader2,
    Users,
    TrendingUp,
    MessageCircle,
    UserPlus,
    Trash2,
    PieChart,
    BookOpen,
    Send,
    X,
    Check,
    AlertCircle,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

interface Student {
    id: string;
    name: string;
    halaqah: string;
    status: "Mutqin" | "Mutawassith" | "Dhaif";
    average_score: number;
    wali_name: string | null;
    wali_phone: string | null;
    adab_score?: number;
    discipline_score?: number;
}

interface Halaqah {
    id: string;
    name: string;
}

interface StatusStats {
    mutqin: number;
    mutawassith: number;
    dhaif: number;
}

export default function GuruHalaqahPage() {
    const { profile } = useAuth();
    const [halaqahList, setHalaqahList] = useState<Halaqah[]>([]);
    const [selectedHalaqah, setSelectedHalaqah] = useState<string>("");
    const [students, setStudents] = useState<Student[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusStats, setStatusStats] = useState<StatusStats>({ mutqin: 0, mutawassith: 0, dhaif: 0 });

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);


    const [showSendModal, setShowSendModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return {
            start: start.toISOString().split("T")[0],
            end: end.toISOString().split("T")[0],
        };
    });

    // Sort state
    type SortField = "average_score" | "adab_score" | "discipline_score" | null;
    const [sortConfig, setSortConfig] = useState<{ field: SortField; order: "asc" | "desc" }>({
        field: null,
        order: "asc", // Default initial order
    });

    const chartRef = useRef<HTMLCanvasElement>(null);

    // Sort logic
    const handleSort = (field: SortField) => {
        setSortConfig((prev) => {
            if (prev.field === field) {
                // Cycle: asc -> desc -> null
                if (prev.order === "asc") return { field, order: "desc" };
                return { field: null, order: "asc" };
            }
            // New field starts at asc
            return { field, order: "asc" };
        });
    };

    const sortedStudents = [...students].sort((a, b) => {
        if (!sortConfig.field) return 0; // Default order

        const valA = a[sortConfig.field] || 0;
        const valB = b[sortConfig.field] || 0;

        if (sortConfig.order === "asc") {
            return valA - valB;
        } else {
            return valB - valA;
        }
    });

    useEffect(() => {
        if (profile) {
            fetchHalaqahList();
        }
    }, [profile]);

    useEffect(() => {
        if (selectedHalaqah) {
            fetchStudentsByHalaqah(selectedHalaqah);
        }
    }, [selectedHalaqah]);

    useEffect(() => {
        drawChart();
    }, [statusStats]);

    async function fetchHalaqahList() {
        setLoading(true);

        // Filter halaqah by teacher_id
        if (!profile?.teacher_id) {
            setHalaqahList([]);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from("halaqah")
            .select("id, name")
            .eq("teacher_id", profile.teacher_id)
            .eq("status", "active")
            .order("name");

        if (data && data.length > 0) {
            setHalaqahList(data);
            setSelectedHalaqah(data[0].name);
        } else {
            setHalaqahList([]);
        }
        setLoading(false);
    }

    async function fetchStudentsByHalaqah(halaqahName: string) {
        setLoading(true);
        const { data } = await supabase
            .from("students")
            .select("id, name, halaqah, status, average_score, wali_name, wali_phone")
            .eq("halaqah", halaqahName)
            .order("name");

        const studentList: Student[] = data || [];

        // Fetch adab & discipline stats
        if (studentList.length > 0) {
            // 1. Fetch active criteria to map aspect
            const { data: criteriaData } = await supabase
                .from("criteria_ref")
                .select("id, aspect")
                .eq("is_active", true);

            const criteriaMap = new Map(criteriaData?.map(c => [c.id, c.aspect]));

            // 2. Fetch assessments for these students in date range
            const studentIds = studentList.map(s => s.id);
            const { data: assessmentData } = await supabase
                .from("daily_assessments")
                .select("student_id, criteria_id, is_compliant")
                .in("student_id", studentIds)
                .gte("date", dateRange.start)
                .lte("date", dateRange.end);

            if (assessmentData && criteriaData) {
                // Calculate scores per student
                studentList.forEach(student => {
                    const studentAssessments = assessmentData.filter(a => a.student_id === student.id);

                    if (studentAssessments.length === 0) {
                        student.adab_score = 0;
                        student.discipline_score = 0;
                        return;
                    }

                    const adabAssessments = studentAssessments.filter(a => criteriaMap.get(a.criteria_id) === 'adab');
                    const disciplineAssessments = studentAssessments.filter(a => criteriaMap.get(a.criteria_id) === 'discipline');

                    const adabScore = adabAssessments.length > 0
                        ? (adabAssessments.filter(a => a.is_compliant).length / adabAssessments.length) * 100
                        : 0;

                    const disciplineScore = disciplineAssessments.length > 0
                        ? (disciplineAssessments.filter(a => a.is_compliant).length / disciplineAssessments.length) * 100
                        : 0;

                    student.adab_score = Math.round(adabScore);
                    student.discipline_score = Math.round(disciplineScore);
                });
            }
        }

        setStudents(studentList);

        // Calculate stats
        const stats: StatusStats = { mutqin: 0, mutawassith: 0, dhaif: 0 };
        studentList.forEach((s) => {
            if (s.status === "Mutqin") stats.mutqin++;
            else if (s.status === "Mutawassith") stats.mutawassith++;
            else stats.dhaif++;
        });
        setStatusStats(stats);
        setLoading(false);
    }

    async function fetchUnassignedStudents() {
        const { data } = await supabase
            .from("students")
            .select("id, name, halaqah, status, average_score, wali_name, wali_phone")
            .or("halaqah.is.null,halaqah.eq.Belum ditentukan")
            .order("name");

        setAllStudents(data || []);
    }

    function drawChart() {
        const canvas = chartRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const total = statusStats.mutqin + statusStats.mutawassith + statusStats.dhaif;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (total === 0) {
            ctx.fillStyle = "#94a3b8"; // slate-400
            ctx.font = "14px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Belum ada data", canvas.width / 2, canvas.height / 2);
            return;
        }

        const data = [
            { label: "Mutqin", value: statusStats.mutqin, color: "#22c55e" },
            { label: "Mutawassith", value: statusStats.mutawassith, color: "#eab308" },
            { label: "Dhaif", value: statusStats.dhaif, color: "#ef4444" },
        ];

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 - 15; // Move chart slightly up to make room for legend
        const outerRadius = Math.min(centerX, centerY) - 20;
        const innerRadius = outerRadius * 0.6; // Donut hole

        let startAngle = -Math.PI / 2; // Start from top

        // Draw donut segments
        data.forEach((item) => {
            if (item.value === 0) return;

            const sliceAngle = (item.value / total) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
            ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();

            startAngle = endAngle;
        });

        // Draw center text
        ctx.fillStyle = "#1e293b"; // slate-800
        ctx.font = "bold 24px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(total.toString(), centerX, centerY - 5);
        ctx.fillStyle = "#64748b"; // slate-500
        ctx.font = "12px Inter, sans-serif";
        ctx.fillText("Santri", centerX, centerY + 15);

        // Draw legend - Centered and Symmetrical
        const legendY = canvas.height - 25;
        const itemGap = 16; // Gap between legend items
        const dotRadius = 4;
        const dotTextGap = 6;

        ctx.font = "11px Inter, sans-serif";

        // 1. Calculate total width of the legend block
        let totalLegendWidth = 0;
        const itemWidths: number[] = [];

        data.forEach((item, index) => {
            const text = `${item.label}: ${item.value}`;
            const textWidth = ctx.measureText(text).width;
            const itemWidth = (dotRadius * 2) + dotTextGap + textWidth;
            itemWidths.push(itemWidth);
            totalLegendWidth += itemWidth;
            if (index < data.length - 1) totalLegendWidth += itemGap;
        });

        // 2. Start drawing from normalized left position
        let currentX = (canvas.width - totalLegendWidth) / 2;

        data.forEach((item, index) => {
            // Draw Dot
            ctx.beginPath();
            ctx.arc(currentX + dotRadius, legendY, dotRadius, 0, 2 * Math.PI);
            ctx.fillStyle = item.color;
            ctx.fill();

            // Draw Label
            ctx.fillStyle = "#475569"; // slate-600
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(`${item.label}: ${item.value}`, currentX + (dotRadius * 2) + dotTextGap, legendY + 1);

            // Move X pointer
            currentX += itemWidths[index] + itemGap;
        });
    }

    function openWhatsApp(phone: string, studentName: string) {
        let formatted = phone.replace(/[^\d]/g, "");
        if (formatted.startsWith("0")) {
            formatted = "62" + formatted.slice(1);
        }
        const message = encodeURIComponent(
            `Assalamu'alaikum. Berikut adalah laporan perkembangan santri ${studentName} di Halaqah ${selectedHalaqah}.`
        );
        window.open(`https://wa.me/${formatted}?text=${message}`, "_blank");
    }

    function openSendModal(student: Student) {
        setSelectedStudent(student);
        setMessage(
            `Assalamu'alaikum Bapak/Ibu ${student.wali_name || "Wali Santri"}.\n\nBerikut laporan perkembangan ${student.name}:\n- Status: ${student.status}\n- Nilai Rata-rata: ${student.average_score?.toFixed(1) || "0"}\n- Adab: ${student.adab_score || 0}%\n- Kedisiplinan: ${student.discipline_score || 0}%\n- Halaqah: ${selectedHalaqah}\n\nJazakumullahu khairan.`
        );
        setShowSendModal(true);
    }

    function sendWhatsAppMessage() {
        if (!selectedStudent?.wali_phone) return;

        let formatted = selectedStudent.wali_phone.replace(/[^\d]/g, "");
        if (formatted.startsWith("0")) {
            formatted = "62" + formatted.slice(1);
        }
        window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(message)}`, "_blank");
        setShowSendModal(false);
    }

    async function handleAddStudent() {
        if (!selectedStudentToAdd || !selectedHalaqah) return;

        setSubmitting(true);
        setError("");

        const { error: updateError } = await supabase
            .from("students")
            .update({ halaqah: selectedHalaqah })
            .eq("id", selectedStudentToAdd);

        if (updateError) {
            setError("Gagal menambah santri ke halaqah");
        } else {
            fetchStudentsByHalaqah(selectedHalaqah);
            setShowAddModal(false);
            setSelectedStudentToAdd("");
        }
        setSubmitting(false);
    }

    async function handleRemoveStudent(student: Student) {
        if (!confirm(`Yakin ingin menghapus ${student.name} dari halaqah ini?`)) return;

        const { error } = await supabase
            .from("students")
            .update({ halaqah: "Belum ditentukan" })
            .eq("id", student.id);

        if (!error) {
            fetchStudentsByHalaqah(selectedHalaqah);
        }
    }

    function openAddModal() {
        fetchUnassignedStudents();
        setShowAddModal(true);
        setError("");
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            Mutqin: "bg-green-100 text-green-700",
            Mutawassith: "bg-yellow-100 text-yellow-700",
            Dhaif: "bg-red-100 text-red-700",
        };
        return styles[status] || "bg-gray-100 text-gray-700";
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return "bg-green-100 text-green-700";
        if (score >= 70) return "bg-yellow-100 text-yellow-700";
        return "bg-red-100 text-red-700";
    };

    const avgScore =
        students.length > 0
            ? students.reduce((sum, s) => sum + (s.average_score || 0), 0) / students.length
            : 0;

    if (loading && halaqahList.length === 0) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-brand-blue-600" />
                <span className="ml-3 text-gray-600">Memuat data...</span>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-brand-blue-900">Halaqah Saya</h1>
                    <p className="text-gray-600 mt-1">Kelola santri dan pantau perkembangan halaqah</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedHalaqah}
                        onChange={(e) => setSelectedHalaqah(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500 bg-white"
                    >
                        {halaqahList.map((h) => (
                            <option key={h.id} value={h.name}>
                                {h.name}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={openAddModal}
                        className="btn-primary flex items-center gap-2"
                    >
                        <UserPlus className="w-5 h-5" />
                        Tambah Santri
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-brand-blue-900">{students.length}</p>
                            <p className="text-sm text-gray-500">Total Santri</p>
                        </div>
                    </div>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-brand-blue-900">{avgScore.toFixed(1)}</p>
                            <p className="text-sm text-gray-500">Rata-rata Nilai</p>
                        </div>
                    </div>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <Check className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-green-600">{statusStats.mutqin}</p>
                            <p className="text-sm text-gray-500">Mutqin</p>
                        </div>
                    </div>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-red-600">{statusStats.dhaif}</p>
                            <p className="text-sm text-gray-500">Perlu Perhatian</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart & Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChart className="w-5 h-5 text-brand-blue-600" />
                        <h2 className="text-lg font-semibold text-brand-blue-900">Distribusi Status</h2>
                    </div>
                    <canvas
                        ref={chartRef}
                        width={280}
                        height={200}
                        className="w-full"
                    />
                </div>

                {/* Student Table */}
                <div className="card overflow-hidden lg:col-span-2">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-brand-blue-600" />
                            <h2 className="text-lg font-semibold text-brand-blue-900">Daftar Santri</h2>
                        </div>
                        <span className="text-sm text-gray-500">{students.length} santri</span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-blue-600" />
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center p-12">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">Belum ada santri di halaqah ini</p>
                            <button
                                onClick={openAddModal}
                                className="mt-3 text-brand-blue-600 hover:underline text-sm"
                            >
                                + Tambah Santri
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Nama
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Status
                                        </th>
                                        <th
                                            className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-50 transition-colors"
                                            onClick={() => handleSort("average_score")}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                Nilai
                                                {sortConfig.field === "average_score" ? (
                                                    sortConfig.order === "asc" ? (
                                                        <ArrowUp className="w-3 h-3 text-brand-blue-600" />
                                                    ) : (
                                                        <ArrowDown className="w-3 h-3 text-brand-blue-600" />
                                                    )
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-50 transition-colors"
                                            onClick={() => handleSort("adab_score")}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                Adab
                                                {sortConfig.field === "adab_score" ? (
                                                    sortConfig.order === "asc" ? (
                                                        <ArrowUp className="w-3 h-3 text-brand-blue-600" />
                                                    ) : (
                                                        <ArrowDown className="w-3 h-3 text-brand-blue-600" />
                                                    )
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-50 transition-colors"
                                            onClick={() => handleSort("discipline_score")}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                Disiplin
                                                {sortConfig.field === "discipline_score" ? (
                                                    sortConfig.order === "asc" ? (
                                                        <ArrowUp className="w-3 h-3 text-brand-blue-600" />
                                                    ) : (
                                                        <ArrowDown className="w-3 h-3 text-brand-blue-600" />
                                                    )
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {sortedStudents.map((student) => (
                                        <tr key={student.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-brand-blue-100 flex items-center justify-center">
                                                        <span className="text-brand-blue-600 font-medium text-sm">
                                                            {student.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{student.name}</p>
                                                        {student.wali_name && (
                                                            <p className="text-xs text-gray-500">Wali: {student.wali_name}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(student.status)}`}>
                                                    {student.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-gray-600">
                                                {student.average_score?.toFixed(1) || "0.0"}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {student.adab_score !== undefined ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(student.adab_score)}`}>
                                                        {student.adab_score}%
                                                    </span>
                                                ) : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {student.discipline_score !== undefined ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(student.discipline_score)}`}>
                                                        {student.discipline_score}%
                                                    </span>
                                                ) : "-"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {student.wali_phone && (
                                                        <button
                                                            onClick={() => openSendModal(student)}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="Kirim Laporan ke Wali"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleRemoveStudent(student)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Hapus dari Halaqah"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Student Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold text-brand-blue-900">
                                Tambah Santri ke Halaqah
                            </h2>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pilih Santri
                                </label>
                                {allStudents.length === 0 ? (
                                    <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                                        Tidak ada santri yang tersedia. Semua santri sudah memiliki halaqah.
                                    </p>
                                ) : (
                                    <select
                                        value={selectedStudentToAdd}
                                        onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500 bg-white"
                                    >
                                        <option value="">-- Pilih Santri --</option>
                                        {allStudents.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleAddStudent}
                                    disabled={submitting || !selectedStudentToAdd}
                                    className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <UserPlus className="w-4 h-4" />
                                    )}
                                    Tambah
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Send WA Modal */}
            {showSendModal && selectedStudent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold text-brand-blue-900">
                                Kirim Laporan ke Wali
                            </h2>
                            <button
                                onClick={() => setShowSendModal(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">Santri:</span> {selectedStudent.name}
                                </p>
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">Wali:</span> {selectedStudent.wali_name || "-"}
                                </p>
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">No. WA:</span> {selectedStudent.wali_phone}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pesan
                                </label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={6}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowSendModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={sendWhatsAppMessage}
                                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Kirim via WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
