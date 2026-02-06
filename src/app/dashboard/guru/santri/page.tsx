"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { CurriculumItem } from "@/types";
import {
    Search,
    Loader2,
    Users,
    History,
    Calendar,
    BookOpen,
    Edit2,
    Trash2,
    X,
    Save,
    Check,
    AlertCircle,
    RefreshCw
} from "lucide-react";

interface Student {
    id: string;
    name: string;
    halaqah: string;
    status: "Mutqin" | "Mutawassith" | "Dhaif";
    average_score: number;
    last_score: {
        score: number;
        material: string;
        date: string;
    } | null;
    completed_surah_count: number;
    completed_kitab_count: number;
    completed_mandzumah_count: number;
}

interface ScoreHistory {
    id: string;
    created_at: string;
    setoran: number;
    note: string;
    curriculum_id: string;
    hafalan_type: "baru" | "murojaah" | null;
    curriculum_items: {
        name: string;
        category: string;
        surah_number?: number;
    } | null;
}

const colors = {
    blue900: "#1a365d",
    blue600: "#3182ce",
    blue50: "#ebf8ff",
    yellow400: "#f6e05e",
    surface: "#f8fafc",
    white: "#ffffff",
    gray400: "#cbd5e0",
    gray500: "#a0aec0",
    gray600: "#718096",
    gray800: "#2d3748",
    red600: "#e53e3e",
    green600: "#38a169",
};

export default function DaftarSantriPage() {
    const { profile } = useAuth();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [historyLogs, setHistoryLogs] = useState<ScoreHistory[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Edit Score State
    const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
    const [curriculumList, setCurriculumList] = useState<CurriculumItem[]>([]);
    const [editFormData, setEditFormData] = useState({
        setoran: 0,
        curriculum_id: "",
        note: "",
    });
    const [savingEdit, setSavingEdit] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (profile) {
            fetchStudents();
            fetchCurriculum();
        }
    }, [profile]);

    async function fetchCurriculum() {
        const { data } = await supabase
            .from("curriculum_items")
            .select("*")
            .order("category")
            .order("name");
        if (data) setCurriculumList(data);
    }

    async function fetchStudents() {
        setLoading(true);

        if (!profile?.teacher_id) {
            setStudents([]);
            setLoading(false);
            return;
        }

        // 1. Get Teacher's Active Halaqahs
        const { data: teacherHalaqah } = await supabase
            .from("halaqah")
            .select("name")
            .eq("teacher_id", profile.teacher_id)
            .eq("status", "active");

        const halaqahNames = teacherHalaqah?.map((h) => h.name) || [];

        if (halaqahNames.length === 0) {
            setStudents([]);
            setLoading(false);
            return;
        }

        // 2. Get Students in those Halaqahs
        const { data: studentsData, error } = await supabase
            .from("students")
            .select("*")
            .in("halaqah", halaqahNames)
            .order("name");

        if (error) {
            console.error("Error fetching students:", error);
            setLoading(false);
            return;
        }

        // 3. Get Latest Score for each student
        const enrichedStudents = await Promise.all(
            (studentsData || []).map(async (student) => {
                const { data: latestScore } = await supabase
                    .from("daily_scores")
                    .select("setoran, created_at, curriculum_items(name)")
                    .eq("student_id", student.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle(); // Changed from single() to maybeSingle() to handle nulls safely

                // Count "Selesai Surah" occurrences
                const { count: finishedSurahCount } = await supabase
                    .from("daily_scores")
                    .select("*", { count: "exact", head: true })
                    .eq("student_id", student.id)
                    .ilike("note", "%(Selesai Surah)%");

                // Count "Selesai Kitab" occurrences
                const { count: finishedKitabCount } = await supabase
                    .from("daily_scores")
                    .select("*", { count: "exact", head: true })
                    .eq("student_id", student.id)
                    .ilike("note", "%(Selesai Kitab)%");

                // Count "Selesai Mandzumah" occurrences
                const { count: finishedMandzumahCount } = await supabase
                    .from("daily_scores")
                    .select("*", { count: "exact", head: true })
                    .eq("student_id", student.id)
                    .ilike("note", "%(Selesai Mandzumah)%");

                // Handle potential array response for joined table
                const materialName = latestScore?.curriculum_items
                    ? (Array.isArray(latestScore.curriculum_items)
                        ? latestScore.curriculum_items[0]?.name
                        : (latestScore.curriculum_items as any).name)
                    : "-";

                return {
                    ...student,
                    completed_surah_count: finishedSurahCount || 0,
                    completed_kitab_count: finishedKitabCount || 0,
                    completed_mandzumah_count: finishedMandzumahCount || 0,
                    last_score: latestScore
                        ? {
                            score: latestScore.setoran,
                            material: materialName || "-",
                            date: latestScore.created_at,
                        }
                        : null,
                };
            })
        );

        setStudents(enrichedStudents);
        setLoading(false);
    }

    async function fetchHistory(studentId: string) {
        setLoadingHistory(true);
        const { data, error } = await supabase
            .from("daily_scores")
            .select(`
                id,
                created_at,
                setoran,
                note,
                curriculum_id,
                hafalan_type,
                curriculum_items (
                    name,
                    category,
                    surah_number
                )
            `)
            .eq("student_id", studentId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error history:", error);
        } else {
            // Map the data to match ScoreHistory interface
            const formattedData: ScoreHistory[] = (data || []).map((item: any) => ({
                id: item.id,
                created_at: item.created_at,
                setoran: item.setoran,
                note: item.note,
                curriculum_id: item.curriculum_id,
                hafalan_type: item.hafalan_type,
                curriculum_items: Array.isArray(item.curriculum_items)
                    ? item.curriculum_items[0]
                    : item.curriculum_items,
            }));
            setHistoryLogs(formattedData);
        }
        setLoadingHistory(false);
    }

    function openHistory(student: Student) {
        setSelectedStudent(student);
        setShowHistoryModal(true);
        fetchHistory(student.id);
        setMessage("");
        setEditingScoreId(null);
    }

    // --- CRUD Operations for Scores ---

    function startEdit(log: ScoreHistory) {
        setEditingScoreId(log.id);
        setEditFormData({
            setoran: log.setoran,
            curriculum_id: log.curriculum_id || "",
            note: log.note || "",
        });
    }

    function cancelEdit() {
        setEditingScoreId(null);
        setEditFormData({ setoran: 0, curriculum_id: "", note: "" });
    }

    async function handleSaveEdit(id: string) {
        setSavingEdit(true);
        const { error } = await supabase
            .from("daily_scores")
            .update({
                setoran: editFormData.setoran,
                curriculum_id: editFormData.curriculum_id || null,
                note: editFormData.note,
            })
            .eq("id", id);

        if (error) {
            setMessage("Gagal mengupdate: " + error.message);
        } else {
            setMessage("Data berhasil diperbarui");
            setEditingScoreId(null);
            if (selectedStudent) fetchHistory(selectedStudent.id);
            fetchStudents(); // Update main list too
            setTimeout(() => setMessage(""), 3000);
        }
        setSavingEdit(false);
    }

    async function handleDeleteScore(id: string) {
        if (!confirm("Apakah Anda yakin ingin menghapus data nilai ini?")) return;

        const { error } = await supabase.from("daily_scores").delete().eq("id", id);

        if (error) {
            alert("Gagal menghapus: " + error.message);
        } else {
            if (selectedStudent) fetchHistory(selectedStudent.id);
            fetchStudents();
        }
    }

    // --- Helpers ---
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getStatusStyle = (status: string) => {
        const map = {
            Mutqin: "bg-green-100 text-green-700",
            Mutawassith: "bg-yellow-100 text-yellow-700",
            Dhaif: "bg-red-100 text-red-700",
        };
        return map[status as keyof typeof map] || "bg-gray-100 text-gray-700";
    };

    const filteredStudents = students.filter(
        (s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.halaqah.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group curriculum for select
    const groupedCurriculum = curriculumList.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, CurriculumItem[]>);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold" style={{ color: colors.blue900 }}>
                    Daftar Santri
                </h1>
                <p className="text-gray-600 mt-1">
                    Kelola data dan riwayat hafalan santri halaqah Anda
                </p>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: "#a0aec0" }}
                    />
                    <input
                        type="text"
                        placeholder="Cari santri atau halaqah..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: "100%",
                            paddingLeft: "2.75rem", // pl-11 equivalent
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

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                        <span className="text-gray-500">Memuat data santri...</span>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        {searchQuery ? "Data tidak ditemukan" : "Belum ada santri di halaqah Anda"}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Nama Santri
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Surah Selesai
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Kitab Selesai
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Mandzumah Selesai
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Materi Terakhir
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Nilai
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredStudents.map((s) => (
                                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{s.name}</span>
                                                <span className="text-xs text-gray-500">{s.halaqah}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(
                                                    s.status
                                                )}`}
                                            >
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-green-600" />
                                                <span className="font-bold text-gray-900">{s.completed_surah_count}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-blue-600" />
                                                <span className="font-bold text-gray-900">{s.completed_kitab_count}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-purple-600" />
                                                <span className="font-bold text-gray-900">{s.completed_mandzumah_count}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {s.last_score ? (
                                                <span className="text-gray-700 font-medium">
                                                    {s.last_score.material}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic text-sm">Belum ada</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {s.last_score ? (
                                                <div className="flex flex-col">
                                                    <span className="text-lg font-bold text-gray-900">
                                                        {s.last_score.score}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(s.last_score.date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openHistory(s)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                                            >
                                                <History className="w-4 h-4" />
                                                Riwayat
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* History Modal */}
            {showHistoryModal && selectedStudent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    Riwayat Setoran
                                </h3>
                                <p className="text-gray-500">
                                    {selectedStudent.name} - {selectedStudent.halaqah}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                            {message && (
                                <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 flex items-center gap-2">
                                    <Check className="w-4 h-4" /> {message}
                                </div>
                            )}

                            {loadingHistory ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                </div>
                            ) : historyLogs.length === 0 ? (
                                <div className="text-center p-8 text-gray-500 italic">
                                    Belum ada riwayat setoran
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historyLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md"
                                        >
                                            {editingScoreId === log.id ? (
                                                // EDIT MODE
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                                Materi
                                                            </label>
                                                            <select
                                                                className="w-full p-2 border rounded-lg text-sm"
                                                                value={editFormData.curriculum_id}
                                                                onChange={(e) =>
                                                                    setEditFormData({
                                                                        ...editFormData,
                                                                        curriculum_id: e.target.value,
                                                                    })
                                                                }
                                                            >
                                                                <option value="">-- Pilih Materi --</option>
                                                                {Object.entries(groupedCurriculum).map(
                                                                    ([category, items]) => (
                                                                        <optgroup
                                                                            key={category}
                                                                            label={category}
                                                                        >
                                                                            {items.map((item) => (
                                                                                <option
                                                                                    key={item.id}
                                                                                    value={item.id}
                                                                                >
                                                                                    {item.name}
                                                                                </option>
                                                                            ))}
                                                                        </optgroup>
                                                                    )
                                                                )}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                                Nilai
                                                            </label>
                                                            <input
                                                                type="number"
                                                                className="w-full p-2 border rounded-lg text-sm"
                                                                value={editFormData.setoran}
                                                                onChange={(e) =>
                                                                    setEditFormData({
                                                                        ...editFormData,
                                                                        setoran: Number(e.target.value),
                                                                    })
                                                                }
                                                                min="0"
                                                                max="100"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            Catatan
                                                        </label>
                                                        <textarea
                                                            className="w-full p-2 border rounded-lg text-sm"
                                                            rows={2}
                                                            value={editFormData.note}
                                                            onChange={(e) =>
                                                                setEditFormData({
                                                                    ...editFormData,
                                                                    note: e.target.value,
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                                                            disabled={savingEdit}
                                                        >
                                                            Batal
                                                        </button>
                                                        <button
                                                            onClick={() => handleSaveEdit(log.id)}
                                                            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                                            disabled={savingEdit}
                                                        >
                                                            {savingEdit && (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            )}
                                                            Simpan
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // VIEW MODE
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                                {log.curriculum_items?.category ||
                                                                    "Umum"}
                                                            </span>
                                                            {log.hafalan_type && (
                                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${log.hafalan_type === 'baru'
                                                                    ? 'bg-green-50 text-green-700'
                                                                    : 'bg-yellow-50 text-yellow-700'
                                                                    }`}>
                                                                    {log.hafalan_type === 'baru' ? (
                                                                        <BookOpen className="w-3 h-3" />
                                                                    ) : (
                                                                        <RefreshCw className="w-3 h-3" />
                                                                    )}
                                                                    {log.hafalan_type === 'baru' ? 'Baru' : 'Murojaah'}
                                                                </span>
                                                            )}
                                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                {formatDate(log.created_at)}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-semibold text-gray-900 text-lg">
                                                            {log.curriculum_items?.name ||
                                                                "Materi dihapus"}
                                                        </h4>
                                                        {log.note && (
                                                            <p className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded border border-gray-100">
                                                                {log.note}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-center min-w-[60px]">
                                                            <div className="text-2xl font-bold text-gray-900">
                                                                {log.setoran}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                Nilai
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 pl-4 border-l">
                                                            <button
                                                                onClick={() => startEdit(log)}
                                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteScore(log.id)}
                                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
