"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
    Plus,
    Search,
    ToggleLeft,
    ToggleRight,
    Edit2,
    Loader2,
    CheckCircle,
    AlertCircle,
} from "lucide-react";

interface Criteria {
    id: number;
    aspect: "adab" | "discipline";
    title: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
}

export default function KelolaCriteriaPage() {
    const [criteria, setCriteria] = useState<Criteria[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"adab" | "discipline">("discipline");
    const [searchQuery, setSearchQuery] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingCriteria, setEditingCriteria] = useState<Criteria | null>(null);
    const [formData, setFormData] = useState({
        aspect: "discipline" as "adab" | "discipline",
        title: "",
        description: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        fetchCriteria();
    }, []);

    async function fetchCriteria() {
        setLoading(true);
        const { data, error } = await supabase
            .from("criteria_ref")
            .select("*")
            .order("sort_order", { ascending: true });

        if (error) {
            console.error("Error fetching criteria:", error);
        } else {
            setCriteria(data || []);
        }
        setLoading(false);
    }

    async function toggleActive(id: number, currentState: boolean) {
        const { error } = await supabase
            .from("criteria_ref")
            .update({ is_active: !currentState })
            .eq("id", id);

        if (error) {
            setError("Gagal mengubah status kriteria");
        } else {
            setCriteria((prev) =>
                prev.map((c) => (c.id === id ? { ...c, is_active: !currentState } : c))
            );
            setSuccess(`Kriteria berhasil di${!currentState ? "aktifkan" : "nonaktifkan"}`);
            setTimeout(() => setSuccess(""), 3000);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.title.trim()) {
            setError("Judul kriteria harus diisi");
            return;
        }

        setSaving(true);
        setError("");

        if (editingCriteria) {
            // Update existing
            const { error } = await supabase
                .from("criteria_ref")
                .update({
                    title: formData.title.trim(),
                    description: formData.description.trim() || null,
                    aspect: formData.aspect,
                })
                .eq("id", editingCriteria.id);

            if (error) {
                setError("Gagal mengupdate kriteria");
            } else {
                setSuccess("Kriteria berhasil diupdate");
                fetchCriteria();
                closeModal();
            }
        } else {
            // Insert new
            const maxSortOrder =
                criteria.filter((c) => c.aspect === formData.aspect).length + 1;

            const { error } = await supabase.from("criteria_ref").insert({
                aspect: formData.aspect,
                title: formData.title.trim(),
                description: formData.description.trim() || null,
                sort_order: maxSortOrder,
            });

            if (error) {
                setError("Gagal menambah kriteria");
            } else {
                setSuccess("Kriteria berhasil ditambah");
                fetchCriteria();
                closeModal();
            }
        }

        setSaving(false);
        setTimeout(() => setSuccess(""), 3000);
    }

    function openAddModal() {
        setEditingCriteria(null);
        setFormData({ aspect: activeTab, title: "", description: "" });
        setShowModal(true);
        setError("");
    }

    function openEditModal(item: Criteria) {
        setEditingCriteria(item);
        setFormData({
            aspect: item.aspect,
            title: item.title,
            description: item.description || "",
        });
        setShowModal(true);
        setError("");
    }

    function closeModal() {
        setShowModal(false);
        setEditingCriteria(null);
        setFormData({ aspect: "discipline", title: "", description: "" });
    }

    const filteredCriteria = criteria.filter(
        (c) =>
            c.aspect === activeTab &&
            (c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const activeCriteriaCount = criteria.filter(
        (c) => c.aspect === activeTab && c.is_active
    ).length;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Kelola Kriteria Penilaian</h1>
                <p className="text-gray-600 mt-1">
                    Kelola kriteria untuk penilaian harian Adab dan Disiplin santri
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

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab("discipline")}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${activeTab === "discipline"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    Disiplin
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
                        {criteria.filter((c) => c.aspect === "discipline").length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab("adab")}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${activeTab === "adab"
                        ? "bg-green-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    Adab
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
                        {criteria.filter((c) => c.aspect === "adab").length}
                    </span>
                </button>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1 card p-4">
                    <div className="relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                            style={{ color: "#a0aec0" }}
                        />
                        <input
                            type="text"
                            placeholder="Cari kriteria berdasarkan judul atau deskripsi..."
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
                <button
                    onClick={openAddModal}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Tambah Kriteria
                </button>
            </div>

            {/* Info Card */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                    <strong>Kriteria Aktif:</strong> {activeCriteriaCount} dari {filteredCriteria.length} kriteria {activeTab === "discipline" ? "Disiplin" : "Adab"} sedang aktif.
                    Kriteria yang dinonaktifkan tidak akan muncul di form penilaian harian.
                </p>
            </div>

            {/* Criteria List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                </div>
            ) : filteredCriteria.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <p className="text-lg">Tidak ada kriteria ditemukan</p>
                    <p className="text-sm mt-1">Tambah kriteria baru untuk memulai</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredCriteria.map((item, index) => (
                        <div
                            key={item.id}
                            className={`p-4 bg-white rounded-lg border transition-all ${item.is_active
                                ? "border-gray-200 shadow-sm"
                                : "border-gray-100 bg-gray-50 opacity-60"
                                }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${item.is_active
                                            ? activeTab === "discipline"
                                                ? "bg-blue-100 text-blue-700"
                                                : "bg-green-100 text-green-700"
                                            : "bg-gray-200 text-gray-500"
                                            }`}
                                    >
                                        {index + 1}
                                    </div>
                                    <div>
                                        <h3
                                            className={`font-semibold ${item.is_active ? "text-gray-800" : "text-gray-500 line-through"
                                                }`}
                                        >
                                            {item.title}
                                        </h3>
                                        {item.description && (
                                            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openEditModal(item)}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => toggleActive(item.id, item.is_active)}
                                        className={`p-2 rounded-lg transition-colors ${item.is_active
                                            ? "text-green-600 hover:bg-green-50"
                                            : "text-gray-400 hover:bg-gray-100"
                                            }`}
                                        title={item.is_active ? "Nonaktifkan" : "Aktifkan"}
                                    >
                                        {item.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                    </button>
                                </div>
                            </div>
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
                                {editingCriteria ? "Edit Kriteria" : "Tambah Kriteria Baru"}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Aspek
                                </label>
                                <select
                                    value={formData.aspect}
                                    onChange={(e) =>
                                        setFormData({ ...formData, aspect: e.target.value as "adab" | "discipline" })
                                    }
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="discipline">Disiplin</option>
                                    <option value="adab">Adab</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Judul Kriteria *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Contoh: Kehadiran"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Deskripsi (Opsional)
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    rows={3}
                                    placeholder="Deskripsi singkat kriteria..."
                                />
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
