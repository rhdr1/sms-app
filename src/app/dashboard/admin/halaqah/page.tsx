"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
    Plus,
    Search,
    BookOpen,
    Edit2,
    Trash2,
    X,
    Check,
    Loader2,
    Users,
    UserCog,
    ChevronDown,
    ChevronUp
} from "lucide-react";

interface Teacher {
    id: string;
    name: string;
}

interface Student {
    id: string;
    name: string;
    halaqah: string;
}

interface Halaqah {
    id: string;
    name: string;
    teacher_id: string | null;
    description: string | null;
    max_students: number;
    status: string;
    created_at: string;
    teacher?: Teacher;
    students: Student[];
}

export default function KelolaHalaqahPage() {
    const [halaqahList, setHalaqahList] = useState<Halaqah[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAssignStudentModal, setShowAssignStudentModal] = useState(false);
    const [selectedHalaqah, setSelectedHalaqah] = useState<Halaqah | null>(null);
    const [expandedHalaqah, setExpandedHalaqah] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        teacher_id: "",
        description: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);

        // Fetch halaqah
        const { data: halaqahData } = await supabase
            .from("halaqah")
            .select("*")
            .order("created_at", { ascending: false });

        // Fetch teachers
        const { data: teachersData } = await supabase
            .from("teachers")
            .select("id, name")
            .eq("status", "active");

        // Fetch all students
        const { data: studentsData } = await supabase
            .from("students")
            .select("id, name, halaqah");

        setTeachers(teachersData || []);
        setAllStudents(studentsData || []);

        // Combine halaqah with teacher info and students
        if (halaqahData) {
            const enrichedHalaqah = halaqahData.map((h) => {
                const teacher = teachersData?.find((t) => t.id === h.teacher_id);
                const students = studentsData?.filter((s) => s.halaqah === h.name) || [];
                return { ...h, teacher, students };
            });
            setHalaqahList(enrichedHalaqah);
        }

        setLoading(false);
    }

    async function handleAddHalaqah(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError("Nama halaqah harus diisi");
            return;
        }

        setSubmitting(true);
        setError("");

        const { error } = await supabase.from("halaqah").insert([
            {
                name: formData.name.trim(),
                teacher_id: formData.teacher_id || null,
                description: formData.description.trim() || null,
            },
        ]);

        if (error) {
            setError("Gagal menambahkan halaqah: " + error.message);
        } else {
            resetForm();
            setShowAddModal(false);
            fetchData();
        }
        setSubmitting(false);
    }

    async function handleUpdateHalaqah(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedHalaqah || !formData.name.trim()) {
            setError("Nama halaqah harus diisi");
            return;
        }

        setSubmitting(true);
        setError("");

        const { error } = await supabase
            .from("halaqah")
            .update({
                name: formData.name.trim(),
                teacher_id: formData.teacher_id || null,
                description: formData.description.trim() || null,
            })
            .eq("id", selectedHalaqah.id);

        if (error) {
            setError("Gagal mengupdate halaqah: " + error.message);
        } else {
            resetForm();
            setShowEditModal(false);
            setSelectedHalaqah(null);
            fetchData();
        }
        setSubmitting(false);
    }

    async function handleDeleteHalaqah(id: string) {
        if (!confirm("Apakah Anda yakin ingin menghapus halaqah ini?")) return;

        const { error } = await supabase.from("halaqah").delete().eq("id", id);
        if (error) {
            alert("Gagal menghapus halaqah: " + error.message);
        } else {
            fetchData();
        }
    }

    async function handleAssignStudent(studentId: string, halaqahName: string) {
        const halaqah = halaqahList.find((h) => h.name === halaqahName);
        if (halaqah && halaqah.students.length >= halaqah.max_students) {
            alert(`Halaqah ${halaqahName} sudah penuh (maksimal ${halaqah.max_students} santri)`);
            return;
        }

        const { error } = await supabase
            .from("students")
            .update({ halaqah: halaqahName })
            .eq("id", studentId);

        if (error) {
            alert("Gagal menambahkan santri: " + error.message);
        } else {
            fetchData();
        }
    }

    async function handleRemoveStudent(studentId: string) {
        if (!confirm("Apakah Anda yakin ingin menghapus santri dari halaqah ini?")) return;

        const { error } = await supabase
            .from("students")
            .update({ halaqah: "" })
            .eq("id", studentId);

        if (error) {
            alert("Gagal menghapus santri: " + error.message);
        } else {
            fetchData();
        }
    }

    function openEditModal(halaqah: Halaqah) {
        setSelectedHalaqah(halaqah);
        setFormData({
            name: halaqah.name,
            teacher_id: halaqah.teacher_id || "",
            description: halaqah.description || "",
        });
        setShowEditModal(true);
    }

    function openAssignModal(halaqah: Halaqah) {
        setSelectedHalaqah(halaqah);
        setShowAssignStudentModal(true);
    }

    function resetForm() {
        setFormData({ name: "", teacher_id: "", description: "" });
        setError("");
    }

    const filteredHalaqah = halaqahList.filter(
        (h) =>
            h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.teacher?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const unassignedStudents = allStudents.filter((s) => !s.halaqah || s.halaqah === "");

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-brand-blue-900">Kelola Halaqah</h1>
                    <p className="text-gray-600 mt-1">Kelola halaqah, guru, dan santri</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowAddModal(true); }}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Tambah Halaqah
                </button>
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
                        placeholder="Cari halaqah berdasarkan nama atau guru..."
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

            {/* Halaqah List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="card p-12 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-blue-600" />
                        <span className="ml-3 text-gray-600">Memuat data halaqah...</span>
                    </div>
                ) : filteredHalaqah.length === 0 ? (
                    <div className="card p-12 text-center">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-600">
                            {searchQuery ? "Halaqah tidak ditemukan" : "Belum ada halaqah"}
                        </h3>
                        <p className="text-gray-400 mt-1">
                            {searchQuery ? "Coba kata kunci lain" : "Klik 'Tambah Halaqah' untuk membuat halaqah baru"}
                        </p>
                    </div>
                ) : (
                    filteredHalaqah.map((halaqah) => (
                        <div key={halaqah.id} className="card overflow-hidden">
                            {/* Halaqah Header */}
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                                onClick={() => setExpandedHalaqah(expandedHalaqah === halaqah.id ? null : halaqah.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-brand-yellow-100 flex items-center justify-center">
                                        <BookOpen className="w-6 h-6 text-brand-yellow-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-brand-blue-900">{halaqah.name}</h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <UserCog className="w-4 h-4" />
                                                {halaqah.teacher?.name || "Belum ada guru"}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="w-4 h-4" />
                                                {halaqah.students.length}/{halaqah.max_students} Santri
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openEditModal(halaqah); }}
                                        className="p-2 text-gray-400 hover:text-brand-blue-600 hover:bg-brand-blue-50 rounded-lg"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteHalaqah(halaqah.id); }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                        title="Hapus"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    {expandedHalaqah === halaqah.id ? (
                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                            </div>

                            {/* Halaqah Students (Expanded) */}
                            {expandedHalaqah === halaqah.id && (
                                <div className="border-t p-4 bg-gray-50">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium text-gray-700">Daftar Santri</h4>
                                        {halaqah.students.length < halaqah.max_students && (
                                            <button
                                                onClick={() => openAssignModal(halaqah)}
                                                className="text-sm hover:underline flex items-center gap-1"
                                                style={{ color: "#1a365d" }}
                                            >
                                                <Plus className="w-4 h-4" />
                                                Tambah Santri
                                            </button>
                                        )}
                                    </div>
                                    {halaqah.students.length === 0 ? (
                                        <p className="text-gray-400 text-sm">Belum ada santri di halaqah ini</p>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {halaqah.students.map((student) => (
                                                <div
                                                    key={student.id}
                                                    className="flex items-center justify-between bg-white p-2 rounded-lg border"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-brand-blue-100 flex items-center justify-center text-sm font-medium text-brand-blue-600">
                                                            {student.name.charAt(0)}
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-700 truncate max-w-[100px]">
                                                            {student.name}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveStudent(student.id)}
                                                        className="p-1 text-gray-400 hover:text-red-500"
                                                        title="Hapus dari halaqah"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Add/Edit Modal */}
            {(showAddModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold text-brand-blue-900">
                                {showEditModal ? "Edit Halaqah" : "Tambah Halaqah Baru"}
                            </h2>
                            <button
                                onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                                className="p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={showEditModal ? handleUpdateHalaqah : handleAddHalaqah} className="p-4 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nama Halaqah <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Contoh: Halaqah Al-Fatihah"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Guru Pembimbing
                                </label>
                                <select
                                    value={formData.teacher_id}
                                    onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                >
                                    <option value="">-- Pilih Guru --</option>
                                    {teachers.map((teacher) => (
                                        <option key={teacher.id} value={teacher.id}>
                                            {teacher.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Deskripsi
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Deskripsi halaqah (opsional)"
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Simpan
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Student Modal */}
            {showAssignStudentModal && selectedHalaqah && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <div>
                                <h2 className="text-lg font-semibold text-brand-blue-900">
                                    Tambah Santri ke {selectedHalaqah.name}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    {selectedHalaqah.students.length}/{selectedHalaqah.max_students} santri
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowAssignStudentModal(false); setSelectedHalaqah(null); }}
                                className="p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1">
                            {unassignedStudents.length === 0 ? (
                                <div className="text-center py-8">
                                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500">Semua santri sudah masuk halaqah</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {unassignedStudents.map((student) => (
                                        <div
                                            key={student.id}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-brand-blue-100 flex items-center justify-center font-medium text-brand-blue-600">
                                                    {student.name.charAt(0)}
                                                </div>
                                                <span className="font-medium text-gray-700">{student.name}</span>
                                            </div>
                                            <button
                                                onClick={() => handleAssignStudent(student.id, selectedHalaqah.name)}
                                                className="px-3 py-1 text-sm rounded-lg hover:opacity-80"
                                                style={{ backgroundColor: "#f6e05e", color: "#1a365d" }}
                                            >
                                                Tambah
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t">
                            <button
                                onClick={() => { setShowAssignStudentModal(false); setSelectedHalaqah(null); }}
                                className="w-full px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
