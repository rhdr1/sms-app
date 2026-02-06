"use client";

import { useState, useEffect } from "react";
import { Bell, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Save, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

interface Announcement {
    id: string;
    title: string;
    content: string;
    is_active: boolean;
    created_at: string;
    created_by: string | null;
}

export default function AdminPengumumanPage() {
    const { isSuperAdmin } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    async function fetchAnnouncements() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("announcements")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setAnnouncements(data || []);
        } catch (error) {
            console.error("Error fetching announcements:", error);
        } finally {
            setLoading(false);
        }
    }

    function openModal(announcement?: Announcement) {
        if (announcement) {
            setEditingId(announcement.id);
            setTitle(announcement.title);
            setContent(announcement.content);
        } else {
            setEditingId(null);
            setTitle("");
            setContent("");
        }
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingId(null);
        setTitle("");
        setContent("");
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        setSaving(true);
        try {
            if (editingId) {
                // Update existing
                const { error } = await supabase
                    .from("announcements")
                    .update({
                        title: title.trim(),
                        content: content.trim(),
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", editingId);

                if (error) throw error;
            } else {
                // Create new
                const { error } = await supabase
                    .from("announcements")
                    .insert({
                        title: title.trim(),
                        content: content.trim(),
                        is_active: true
                    });

                if (error) throw error;
            }

            await fetchAnnouncements();
            closeModal();
        } catch (error) {
            console.error("Error saving announcement:", error);
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(id: string, currentStatus: boolean) {
        try {
            const { error } = await supabase
                .from("announcements")
                .update({ is_active: !currentStatus })
                .eq("id", id);

            if (error) throw error;

            setAnnouncements(prev =>
                prev.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a)
            );
        } catch (error) {
            console.error("Error toggling announcement:", error);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Yakin ingin menghapus pengumuman ini?")) return;

        try {
            const { error } = await supabase
                .from("announcements")
                .delete()
                .eq("id", id);

            if (error) throw error;
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            console.error("Error deleting announcement:", error);
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

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
                        Kelola Pengumuman
                    </h1>
                    <p className="text-gray-500">
                        Buat dan kelola pengumuman untuk wali santri
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Tambah Pengumuman
                </button>
            </div>

            {/* Announcements List */}
            {announcements.length === 0 ? (
                <div className="card p-8 text-center">
                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                        Belum ada pengumuman. Klik tombol &quot;Tambah Pengumuman&quot; untuk membuat.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {announcements.map((announcement) => (
                        <div key={announcement.id} className="card p-6">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-lg font-semibold text-brand-blue-900">
                                            {announcement.title}
                                        </h2>
                                        <span
                                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${announcement.is_active
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-gray-100 text-gray-500"
                                                }`}
                                        >
                                            {announcement.is_active ? "Aktif" : "Nonaktif"}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400">
                                        {formatDate(announcement.created_at)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleActive(announcement.id, announcement.is_active)}
                                        className={`p-2 rounded-lg transition-colors ${announcement.is_active
                                                ? "text-green-600 hover:bg-green-50"
                                                : "text-gray-400 hover:bg-gray-100"
                                            }`}
                                        title={announcement.is_active ? "Nonaktifkan" : "Aktifkan"}
                                    >
                                        {announcement.is_active ? (
                                            <ToggleRight className="w-5 h-5" />
                                        ) : (
                                            <ToggleLeft className="w-5 h-5" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => openModal(announcement)}
                                        className="p-2 text-brand-blue-500 hover:bg-brand-blue-50 rounded-lg transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    {isSuperAdmin && (
                                        <button
                                            onClick={() => handleDelete(announcement.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Hapus"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap">
                                {announcement.content}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold text-brand-blue-900">
                                {editingId ? "Edit Pengumuman" : "Tambah Pengumuman"}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Judul
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Judul pengumuman"
                                    required
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Isi Pengumuman
                                </label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Tulis isi pengumuman..."
                                    required
                                    rows={5}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-blue-500 resize-none"
                                />
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
        </div>
    );
}
