"use client";

import { useState, useEffect } from "react";
import {
    Loader2,
    Plus,
    Search,
    Trash2,
    BookOpen,
    Edit,
    X,
    Save,
    AlertCircle,
    Upload,
    FileText,
    Download,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { CurriculumItem } from "@/types";

export default function AdminKurikulumPage() {
    const [items, setItems] = useState<CurriculumItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importLoading, setImportLoading] = useState(false);

    // Form state
    const [editingItem, setEditingItem] = useState<CurriculumItem | null>(null);
    const [formData, setFormData] = useState({
        category: "Surah" as "Surah" | "Juz" | "Kitab" | "Mandzumah", // Added Mandzumah
        name: "",
        surah_number: "",
        ayat_start: "",
        ayat_end: "",
        page_start: "",
        page_end: "",
        total_pages: "",
        target_ayat: "",
        total_bait: "", // Added for Mandzumah
    });

    useEffect(() => {
        fetchItems();
    }, []);

    async function fetchItems() {
        setLoading(true);
        const { data, error } = await supabase
            .from("curriculum_items")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);
        } else {
            setItems(data || []);
        }
        setLoading(false);
    }

    const filteredItems = items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    function handleOpenModal(item?: CurriculumItem) {
        if (item) {
            setEditingItem(item);
            setFormData({
                category: item.category as any, // Cast to any to accept new type if old data doesn't match
                name: item.name,
                surah_number: item.surah_number?.toString() || "",
                ayat_start: item.ayat_start?.toString() || "",
                ayat_end: item.ayat_end?.toString() || "",
                page_start: item.page_start?.toString() || "",
                page_end: item.page_end?.toString() || "",
                total_pages: item.total_pages?.toString() || "",
                target_ayat: item.target_ayat?.toString() || "",
                total_bait: (item.category as string) === "Mandzumah" ? item.target_ayat?.toString() || "" : "",
            });
        } else {
            setEditingItem(null);
            setFormData({
                category: "Surah",
                name: "",
                surah_number: "",
                ayat_start: "",
                ayat_end: "",
                page_start: "",
                page_end: "",
                total_pages: "",
                target_ayat: "",
                total_bait: "",
            });
        }
        setError("");
        setShowModal(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            // Strict payload construction
            let payload: any = {
                category: formData.category,
                name: formData.name,
            };

            if (formData.category === "Surah") {
                payload = {
                    ...payload,
                    surah_number: formData.surah_number ? parseInt(formData.surah_number) : null,
                    ayat_start: formData.ayat_start ? parseInt(formData.ayat_start) : null,
                    ayat_end: formData.ayat_end ? parseInt(formData.ayat_end) : null,
                    page_start: formData.page_start ? parseInt(formData.page_start) : null,
                    page_end: formData.page_end ? parseInt(formData.page_end) : null,
                    target_ayat: null,
                    total_pages: null,
                };
            } else if (formData.category === "Kitab") {
                const pages = formData.total_pages ? parseInt(formData.total_pages) : null;
                payload = {
                    ...payload,
                    total_pages: pages,
                    target_ayat: pages,
                    surah_number: null,
                    ayat_start: null,
                    ayat_end: null,
                    page_start: null,
                    page_end: null,
                };
            } else if (formData.category === "Mandzumah") {
                const bait = formData.total_bait ? parseInt(formData.total_bait) : null;
                payload = {
                    ...payload,
                    target_ayat: bait, // Stores 'Akhir Bait' in target_ayat
                    surah_number: null,
                    ayat_start: null,
                    ayat_end: null, // Strictly NULL to ensure separation from Surah Ayat
                    page_start: null,
                    page_end: null,
                    total_pages: null,
                };
            }

            if (editingItem) {
                const { error } = await supabase
                    .from("curriculum_items")
                    .update(payload)
                    .eq("id", editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("curriculum_items").insert(payload);
                if (error) throw error;
            }

            fetchItems();
            setShowModal(false);
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            setError(err.message || "Gagal menyimpan data");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this curriculum item?")) return;

        const { error } = await supabase.from("curriculum_items").delete().eq("id", id);
        if (error) {
            alert("Gagal menghapus item");
        } else {
            fetchItems();
        }
    }

    async function processCSV(file: File, type: "Surah" | "Kitab") {
        setImportLoading(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setImportLoading(false);
                return;
            }

            const rows = text.split("\n").filter((r) => r.trim() !== "");
            // Assume header row exists? Let's skip first row if it looks like header
            // Or just try to parse. Simplest: Expect no header or handle it.
            // Let's assume standard format:
            // Surah: name, surah_number, ayat_start, ayat_end, page_start, page_end
            // Kitab: name, total_pages

            const batchedItems = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i].trim();
                if (!row) continue;
                // Skip header if likely
                if (i === 0 && (row.toLowerCase().includes("name") || row.toLowerCase().includes("nama"))) continue;

                const cols = row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

                if (type === "Surah") {
                    // name, surah_number, ayat_start, ayat_end, page_start, page_end
                    if (cols.length < 6) continue;
                    batchedItems.push({
                        category: "Surah",
                        name: cols[0],
                        surah_number: parseInt(cols[1]) || null,
                        ayat_start: parseInt(cols[2]) || null,
                        ayat_end: parseInt(cols[3]) || null,
                        page_start: parseInt(cols[4]) || null,
                        page_end: parseInt(cols[5]) || null,
                    });
                } else {
                    // name, total_pages
                    if (cols.length < 2) continue;
                    const total = parseInt(cols[1]) || 0;
                    batchedItems.push({
                        category: "Kitab",
                        name: cols[0],
                        target_ayat: total, // For Kitab, target is pages
                        total_pages: total,
                    });
                }
            }

            if (batchedItems.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error } = await supabase.from("curriculum_items").insert(batchedItems as any);
                if (error) {
                    alert("Gagal import CSV: " + error.message);
                } else {
                    alert(`Berhasil import ${batchedItems.length} item.`);
                    fetchItems();
                    setShowImportModal(false);
                }
            } else {
                alert("Tidak ada data valid yang ditemukan.");
            }
            setImportLoading(false);
        };

        reader.readAsText(file);
    }

    function downloadTemplate(type: "Surah" | "Kitab") {
        let headers = "";
        let sample = "";
        if (type === "Surah") {
            headers = "name,surah_number,ayat_start,ayat_end,page_start,page_end";
            sample = "Al-Mulk,67,1,30,562,564";
        } else {
            headers = "name,total_pages";
            sample = "Kitab Tauhid,150";
        }

        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + sample;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `template_import_${type.toLowerCase()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Manajemen Kurikulum</h1>
                    <p className="text-gray-600 mt-1">Kelola data Surah, Qur&apos;an, Kitab, dan Mandzumah</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="btn-secondary flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                    >
                        <Upload className="w-5 h-5" />
                        Import CSV
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Tambah Item
                    </button>
                </div>
            </div>

            <div className="card p-4 mb-6">
                <div className="relative">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                        style={{ color: "#a0aec0" }}
                    />
                    <input
                        type="text"
                        placeholder="Cari kurikulum..."
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

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-blue-600" />
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Kategori
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Nama
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Detail
                                    </th>
                                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium ${item.category === "Kitab"
                                                    ? "bg-purple-100 text-purple-700"
                                                    : (item.category as string) === "Mandzumah"
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-blue-100 text-blue-700"
                                                    }`}
                                            >
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {item.name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {item.category === "Kitab" ? (
                                                <span>{item.target_ayat || item.total_pages} Halaman</span>
                                            ) : (item.category as string) === "Mandzumah" ? (
                                                <span>{item.target_ayat} Bait</span>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    {item.surah_number && (
                                                        <span>Surah ke-{item.surah_number}</span>
                                                    )}
                                                    {(item.ayat_start || item.ayat_end) && (
                                                        <span>
                                                            Ayat {item.ayat_start}-{item.ayat_end}
                                                        </span>
                                                    )}
                                                    {(item.page_start || item.page_end) && (
                                                        <span>
                                                            Hal {item.page_start}
                                                            {item.page_end && item.page_end !== item.page_start
                                                                ? `-${item.page_end}`
                                                                : ""}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(item)}
                                                    className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-brand-blue-600"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-red-600"
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
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingItem ? "Edit Item" : "Tambah Item"}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Kategori
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            category: e.target.value as any,
                                        })
                                    }
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500 bg-white"
                                >
                                    <option value="Surah">Surah / Quran</option>
                                    <option value="Kitab">Kitab</option>
                                    <option value="Mandzumah">Mandzumah</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nama {formData.category === "Kitab" ? "Kitab" : formData.category === "Mandzumah" ? "Mandzumah" : "Surah"}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                    placeholder={
                                        formData.category === "Kitab"
                                            ? "Contoh: Kitab Tauhid"
                                            : formData.category === "Mandzumah"
                                                ? "Contoh: Al-Jazariyah"
                                                : "Contoh: Al-Mulk"
                                    }
                                />
                            </div>

                            {formData.category === "Kitab" ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Total Halaman
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.total_pages}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                total_pages: e.target.value,
                                            })
                                        }
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                        placeholder="Contoh: 150"
                                    />
                                </div>
                            ) : formData.category === "Mandzumah" ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Akhir Bait
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.total_bait}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                total_bait: e.target.value,
                                            })
                                        }
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                        placeholder="Contoh: 109"
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Nomor Surah
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.surah_number}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        surah_number: e.target.value,
                                                    })
                                                }
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                                placeholder="1-114"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Halaman Mulai
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.page_start}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        page_start: e.target.value,
                                                    })
                                                }
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                                placeholder="Contoh: 562"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Halaman Akhir
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.page_end}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        page_end: e.target.value,
                                                    })
                                                }
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                                placeholder="Contoh: 562"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Ayat Mulai
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.ayat_start}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        ayat_start: e.target.value,
                                                    })
                                                }
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                                placeholder="1"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Ayat Akhir
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.ayat_end}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        ayat_end: e.target.value,
                                                    })
                                                }
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                                placeholder="30"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}


                            <div className="flex gap-3 pt-4 border-t mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold text-gray-900">Import CSV</h2>
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <h3 className="text-sm font-medium text-gray-900 mb-2">Format Surah</h3>
                                    <code className="block bg-gray-50 p-2 rounded text-xs text-gray-600 mb-2">
                                        nama, no_surah, ayat_start, ayat_end, hal_start, hal_end
                                    </code>
                                    <button
                                        onClick={() => downloadTemplate("Surah")}
                                        className="text-xs text-brand-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Download className="w-3 h-3" />
                                        Download Template
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <h3 className="text-sm font-medium text-gray-900 mb-2">Format Kitab</h3>
                                    <code className="block bg-gray-50 p-2 rounded text-xs text-gray-600 mb-2">
                                        nama, total_halaman
                                    </code>
                                    <button
                                        onClick={() => downloadTemplate("Kitab")}
                                        className="text-xs text-brand-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Download className="w-3 h-3" />
                                        Download Template
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block w-full cursor-pointer">
                                    <span className="sr-only">Choose file</span>
                                    <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-brand-blue-500 transition-colors text-center">
                                        <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                        <span className="text-sm text-gray-500">
                                            Upload file .csv untuk <strong>Surah</strong>
                                        </span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".csv"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    processCSV(e.target.files[0], "Surah");
                                                }
                                            }}
                                        />
                                    </div>
                                </label>

                                <div className="relative flex items-center py-2">
                                    <div className="flex-grow border-t border-gray-300"></div>
                                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">ATAU</span>
                                    <div className="flex-grow border-t border-gray-300"></div>
                                </div>

                                <label className="block w-full cursor-pointer">
                                    <span className="sr-only">Choose file</span>
                                    <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-brand-blue-500 transition-colors text-center">
                                        <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                        <span className="text-sm text-gray-500">
                                            Upload file .csv untuk <strong>Kitab</strong>
                                        </span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".csv"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    processCSV(e.target.files[0], "Kitab");
                                                }
                                            }}
                                        />
                                    </div>
                                </label>
                            </div>

                            {importLoading && (
                                <div className="flex items-center justify-center gap-2 text-brand-blue-600 mt-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Memproses...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
