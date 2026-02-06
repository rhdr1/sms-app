"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Edit2, Trash2, Key, ToggleLeft, ToggleRight, Search, X, Save, Loader2, UserCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

interface WaliSantri {
    id: string;
    phone: string;
    name: string;
    is_active: boolean;
    created_at: string;
    children_count: number;
}

interface Student {
    id: string;
    name: string;
    halaqah: string;
}

export default function AdminWaliPage() {
    const { isSuperAdmin } = useAuth();
    const [waliList, setWaliList] = useState<WaliSantri[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedWali, setSelectedWali] = useState<WaliSantri | null>(null);
    const [assignedChildren, setAssignedChildren] = useState<string[]>([]);

    // Form state
    const [formPhone, setFormPhone] = useState("");
    const [formName, setFormName] = useState("");
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            // Fetch wali list with children count
            const { data: waliData } = await supabase
                .from("wali_santri")
                .select("*")
                .order("created_at", { ascending: false });

            // Get children count for each wali
            const waliWithCounts = await Promise.all(
                (waliData || []).map(async (w) => {
                    const { count } = await supabase
                        .from("wali_santri_children")
                        .select("*", { count: "exact", head: true })
                        .eq("wali_id", w.id);
                    return { ...w, children_count: count || 0 };
                })
            );

            setWaliList(waliWithCounts);

            // Fetch all students
            const { data: studentsData } = await supabase
                .from("students")
                .select("id, name, halaqah")
                .order("name");

            setStudents(studentsData || []);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }

    // Normalize phone to 08xxx format
    function normalizePhone(phone: string): string {
        let cleaned = phone.replace(/\D/g, "");
        if (cleaned.startsWith("62")) {
            cleaned = "0" + cleaned.substring(2);
        }
        if (!cleaned.startsWith("08") && cleaned.startsWith("8")) {
            cleaned = "0" + cleaned;
        }
        return cleaned;
    }

    function openModal(wali?: WaliSantri) {
        if (wali) {
            setEditingId(wali.id);
            setFormPhone(wali.phone);
            setFormName(wali.name);
        } else {
            setEditingId(null);
            setFormPhone("");
            setFormName("");
        }
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingId(null);
        setFormPhone("");
        setFormName("");
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formPhone.trim() || !formName.trim()) return;

        setSaving(true);
        try {
            const normalizedPhone = normalizePhone(formPhone);
            const defaultPassword = normalizedPhone.slice(-6);

            if (editingId) {
                // Update existing
                const { error } = await supabase
                    .from("wali_santri")
                    .update({
                        phone: normalizedPhone,
                        name: formName.trim(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", editingId);

                if (error) throw error;
            } else {
                // Create new
                const { error } = await supabase
                    .from("wali_santri")
                    .insert({
                        phone: normalizedPhone,
                        name: formName.trim(),
                        password: defaultPassword,
                        is_active: true,
                    });

                if (error) throw error;
            }

            await fetchData();
            closeModal();
        } catch (error) {
            console.error("Error saving wali:", error);
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(id: string, currentStatus: boolean) {
        try {
            const { error } = await supabase
                .from("wali_santri")
                .update({ is_active: !currentStatus })
                .eq("id", id);

            if (error) throw error;
            setWaliList((prev) =>
                prev.map((w) => (w.id === id ? { ...w, is_active: !currentStatus } : w))
            );
        } catch (error) {
            console.error("Error toggling wali:", error);
        }
    }

    async function resetPassword(wali: WaliSantri) {
        if (!confirm(`Reset password untuk ${wali.name} ke 6 digit terakhir nomor HP?`)) return;

        try {
            const defaultPassword = wali.phone.slice(-6);
            const { error } = await supabase
                .from("wali_santri")
                .update({ password: defaultPassword })
                .eq("id", wali.id);

            if (error) throw error;
            alert("Password berhasil direset!");
        } catch (error) {
            console.error("Error resetting password:", error);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Yakin ingin menghapus akun wali ini?")) return;

        try {
            const { error } = await supabase.from("wali_santri").delete().eq("id", id);
            if (error) throw error;
            setWaliList((prev) => prev.filter((w) => w.id !== id));
        } catch (error) {
            console.error("Error deleting wali:", error);
        }
    }

    async function openAssignModal(wali: WaliSantri) {
        setSelectedWali(wali);

        // Fetch current assigned children
        const { data } = await supabase
            .from("wali_santri_children")
            .select("student_id")
            .eq("wali_id", wali.id);

        setAssignedChildren(data?.map((d) => d.student_id) || []);
        setShowAssignModal(true);
    }

    function toggleChild(studentId: string) {
        setAssignedChildren((prev) =>
            prev.includes(studentId)
                ? prev.filter((id) => id !== studentId)
                : [...prev, studentId]
        );
    }

    async function saveAssignments() {
        if (!selectedWali) return;

        setSaving(true);
        try {
            // Delete all existing assignments
            await supabase
                .from("wali_santri_children")
                .delete()
                .eq("wali_id", selectedWali.id);

            // Insert new assignments
            if (assignedChildren.length > 0) {
                const inserts = assignedChildren.map((studentId) => ({
                    wali_id: selectedWali.id,
                    student_id: studentId,
                }));

                const { error } = await supabase
                    .from("wali_santri_children")
                    .insert(inserts);

                if (error) throw error;
            }

            await fetchData();
            setShowAssignModal(false);
            setSelectedWali(null);
        } catch (error) {
            console.error("Error saving assignments:", error);
        } finally {
            setSaving(false);
        }
    }

    // Filter wali by search
    const filteredWali = waliList.filter(
        (w) =>
            w.name.toLowerCase().includes(search.toLowerCase()) ||
            w.phone.includes(search)
    );

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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-brand-blue-900">
                        Kelola Wali Santri
                    </h1>
                    <p className="text-gray-500">
                        Kelola akun wali santri dan hubungkan dengan anak
                    </p>
                </div>
                <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Tambah Wali
                </button>
            </div>

            {/* Search */}
            <div className="card p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari berdasarkan nama atau nomor HP..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-blue-500"
                    />
                </div>
            </div>

            {/* Wali List */}
            {filteredWali.length === 0 ? (
                <div className="card p-8 text-center">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                        {search ? "Tidak ada wali yang ditemukan" : "Belum ada akun wali santri"}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredWali.map((wali) => (
                        <div key={wali.id} className="card p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-brand-blue-100 rounded-full flex items-center justify-center">
                                        <UserCircle className="w-6 h-6 text-brand-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-brand-blue-900">
                                            {wali.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">{wali.phone}</p>
                                    </div>
                                </div>
                                <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${wali.is_active
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-100 text-gray-500"
                                        }`}
                                >
                                    {wali.is_active ? "Aktif" : "Nonaktif"}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                                <Users className="w-4 h-4" />
                                <span>{wali.children_count} anak terhubung</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openAssignModal(wali)}
                                    className="flex-1 px-3 py-2 text-sm bg-brand-blue-50 text-brand-blue-700 rounded-lg hover:bg-brand-blue-100"
                                >
                                    <Users className="w-4 h-4 inline mr-1" />
                                    Assign Anak
                                </button>
                                <button
                                    onClick={() => toggleActive(wali.id, wali.is_active)}
                                    className={`p-2 rounded-lg ${wali.is_active
                                            ? "text-green-600 hover:bg-green-50"
                                            : "text-gray-400 hover:bg-gray-100"
                                        }`}
                                    title={wali.is_active ? "Nonaktifkan" : "Aktifkan"}
                                >
                                    {wali.is_active ? (
                                        <ToggleRight className="w-5 h-5" />
                                    ) : (
                                        <ToggleLeft className="w-5 h-5" />
                                    )}
                                </button>
                                <button
                                    onClick={() => resetPassword(wali)}
                                    className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                                    title="Reset Password"
                                >
                                    <Key className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => openModal(wali)}
                                    className="p-2 text-brand-blue-500 hover:bg-brand-blue-50 rounded-lg"
                                    title="Edit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                {isSuperAdmin && (
                                    <button
                                        onClick={() => handleDelete(wali.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                        title="Hapus"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold text-brand-blue-900">
                                {editingId ? "Edit Wali" : "Tambah Wali"}
                            </h3>
                            <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nama Wali
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Nama lengkap wali"
                                    required
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nomor HP
                                </label>
                                <input
                                    type="tel"
                                    value={formPhone}
                                    onChange={(e) => setFormPhone(e.target.value)}
                                    placeholder="081234567890"
                                    required
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-blue-500"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    Password akan di-set ke 6 digit terakhir nomor HP
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Simpan
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Children Modal */}
            {showAssignModal && selectedWali && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <div>
                                <h3 className="text-lg font-semibold text-brand-blue-900">
                                    Assign Anak
                                </h3>
                                <p className="text-sm text-gray-500">
                                    Wali: {selectedWali.name}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-2">
                                {students.map((student) => (
                                    <label
                                        key={student.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${assignedChildren.includes(student.id)
                                                ? "bg-brand-blue-50 border border-brand-blue-200"
                                                : "bg-gray-50 hover:bg-gray-100"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={assignedChildren.includes(student.id)}
                                            onChange={() => toggleChild(student.id)}
                                            className="w-4 h-4 text-brand-blue-500 rounded"
                                        />
                                        <div>
                                            <p className="font-medium text-brand-blue-900">
                                                {student.name}
                                            </p>
                                            <p className="text-sm text-gray-500">{student.halaqah}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 border-t flex gap-3">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={saveAssignments}
                                disabled={saving}
                                className="flex-1 btn-primary flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Simpan ({assignedChildren.length} anak)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
