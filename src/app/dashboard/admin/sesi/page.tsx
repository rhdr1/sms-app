"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import {
    Plus,
    Clock,
    Edit2,
    Loader2,
    CheckCircle,
    AlertCircle,
    ToggleLeft,
    ToggleRight,
    Trash2,
} from "lucide-react";

interface Session {
    id: number;
    name: string;
    time_start: string | null;
    time_end: string | null;
    sort_order: number;
    is_active: boolean;
}

export default function KelolaSesiPage() {
    const { isSuperAdmin } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        time_start: "",
        time_end: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

    useEffect(() => {
        fetchSessions();
    }, []);

    async function fetchSessions() {
        setLoading(true);
        const { data, error } = await supabase
            .from("sessions_ref")
            .select("*")
            .order("sort_order", { ascending: true });

        if (error) {
            console.error("Error fetching sessions:", error);
        } else {
            setSessions(data || []);
        }
        setLoading(false);
    }

    async function toggleActive(id: number, currentState: boolean) {
        const { error } = await supabase
            .from("sessions_ref")
            .update({ is_active: !currentState })
            .eq("id", id);

        if (error) {
            setError("Gagal mengubah status sesi");
        } else {
            setSessions((prev) =>
                prev.map((s) => (s.id === id ? { ...s, is_active: !currentState } : s))
            );
            setSuccess(`Sesi berhasil di${!currentState ? "aktifkan" : "nonaktifkan"}`);
            setTimeout(() => setSuccess(""), 3000);
        }
    }

    async function handleDelete(id: number) {
        const { error } = await supabase
            .from("sessions_ref")
            .delete()
            .eq("id", id);

        if (error) {
            setError("Gagal menghapus sesi. Mungkin sudah ada data penilaian yang terkait.");
        } else {
            setSessions((prev) => prev.filter((s) => s.id !== id));
            setSuccess("Sesi berhasil dihapus");
        }
        setShowDeleteConfirm(null);
        setTimeout(() => {
            setError("");
            setSuccess("");
        }, 3000);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError("Nama sesi harus diisi");
            return;
        }

        setSaving(true);
        setError("");

        if (editingSession) {
            // Update existing
            const { error } = await supabase
                .from("sessions_ref")
                .update({
                    name: formData.name.trim(),
                    time_start: formData.time_start || null,
                    time_end: formData.time_end || null,
                })
                .eq("id", editingSession.id);

            if (error) {
                setError("Gagal mengupdate sesi");
            } else {
                setSuccess("Sesi berhasil diupdate");
                fetchSessions();
                closeModal();
            }
        } else {
            // Insert new
            const maxSortOrder = sessions.length + 1;

            const { error } = await supabase.from("sessions_ref").insert({
                name: formData.name.trim(),
                time_start: formData.time_start || null,
                time_end: formData.time_end || null,
                sort_order: maxSortOrder,
            });

            if (error) {
                console.error("Supabase Error:", error);
                setError(`Gagal menambah sesi: ${error.message}`);
            } else {
                setSuccess("Sesi berhasil ditambah");
                fetchSessions();
                closeModal();
            }
        }

        setSaving(false);
        setTimeout(() => setSuccess(""), 3000);
    }

    function openAddModal() {
        setEditingSession(null);
        setFormData({ name: "", time_start: "", time_end: "" });
        setShowModal(true);
        setError("");
    }

    function openEditModal(session: Session) {
        setEditingSession(session);
        setFormData({
            name: session.name,
            time_start: session.time_start || "",
            time_end: session.time_end || "",
        });
        setShowModal(true);
        setError("");
    }

    function closeModal() {
        setShowModal(false);
        setEditingSession(null);
        setFormData({ name: "", time_start: "", time_end: "" });
    }

    function formatTime(time: string | null): string {
        if (!time) return "-";
        return time.slice(0, 5); // HH:MM
    }

    const activeSessionsCount = sessions.filter((s) => s.is_active).length;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Kelola Sesi Harian</h1>
                <p className="text-gray-600 mt-1">
                    Kelola jadwal sesi untuk penilaian harian santri
                </p>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                    <CheckCircle size={20} />
                    {success}
                </div>
            )}

            {/* Actions Bar */}
            <div className="flex justify-between items-center mb-6">
                <div className="text-sm text-gray-600">
                    <span className="font-medium text-blue-600">{activeSessionsCount}</span> dari{" "}
                    <span className="font-medium">{sessions.length}</span> sesi aktif
                </div>
                {isSuperAdmin && (
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        <Plus size={18} />
                        Tambah Sesi
                    </button>
                )}
            </div>

            {/* Info Card */}
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
                <p className="text-sm text-amber-800">
                    <strong>Tips:</strong> Setiap sesi memiliki jam mulai dan selesai. Guru akan
                    melakukan penilaian per sesi untuk setiap santri. Sesi yang dinonaktifkan tidak
                    akan muncul di form penilaian.
                </p>
            </div>

            {/* Sessions List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                </div>
            ) : sessions.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <Clock size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Belum ada sesi</p>
                    <p className="text-sm mt-1">Tambah sesi baru untuk memulai</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sessions.map((session, index) => (
                        <div
                            key={session.id}
                            className={`p-4 bg-white rounded-lg border transition-all ${session.is_active
                                ? "border-gray-200 shadow-sm"
                                : "border-gray-100 bg-gray-50 opacity-60"
                                }`}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center ${session.is_active
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-gray-200 text-gray-500"
                                            }`}
                                    >
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h3
                                            className={`font-semibold ${session.is_active ? "text-gray-800" : "text-gray-500 line-through"
                                                }`}
                                        >
                                            {session.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {formatTime(session.time_start)} - {formatTime(session.time_end)}
                                        </p>
                                    </div>
                                </div>
                                {isSuperAdmin && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEditModal(session)}
                                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => toggleActive(session.id, session.is_active)}
                                            className={`p-2 rounded-lg transition-colors ${session.is_active
                                                ? "text-green-600 hover:bg-green-50"
                                                : "text-gray-400 hover:bg-gray-100"
                                                }`}
                                            title={session.is_active ? "Nonaktifkan" : "Aktifkan"}
                                        >
                                            {session.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteConfirm(session.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Hapus"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Delete Confirmation */}
                            {showDeleteConfirm === session.id && (
                                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                                    <p className="text-sm text-red-700 mb-3">
                                        Yakin ingin menghapus sesi &quot;{session.name}&quot;? Tindakan ini tidak dapat
                                        dibatalkan.
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowDeleteConfirm(null)}
                                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            onClick={() => handleDelete(session.id)}
                                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                                        >
                                            Ya, Hapus
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingSession ? "Edit Sesi" : "Tambah Sesi Baru"}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nama Sesi *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Contoh: Sesi Pagi"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Jam Mulai
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.time_start}
                                        onChange={(e) => setFormData({ ...formData, time_start: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Jam Selesai
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.time_end}
                                        onChange={(e) => setFormData({ ...formData, time_end: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        "Simpan"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
