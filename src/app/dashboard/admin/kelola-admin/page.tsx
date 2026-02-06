"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Search, Edit2, Trash2, X, Check, Loader2, Shield, UserCog } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AdminUser {
    id: string;
    full_name: string;
    email: string;
    role: "admin" | "super_admin";
    created_at: string;
}

export default function KelolaAdminPage() {
    const { isSuperAdmin } = useAuth();
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        password: "",
        role: "admin" as "admin" | "super_admin"
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isSuperAdmin) {
            fetchAdmins();
        }
    }, [isSuperAdmin]);

    async function fetchAdmins() {
        setLoading(true);
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .in("role", ["admin", "super_admin"])
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching admins:", error);
        } else {
            setAdmins(data || []);
        }
        setLoading(false);
    }

    async function handleCreateAdmin(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            // 1. Check for existing email
            const { data: existingUser } = await supabase
                .from("profiles")
                .select("email")
                .eq("email", formData.email)
                .single();

            if (existingUser) {
                setError("Email sudah terdaftar");
                setSubmitting(false);
                return;
            }

            // 2. Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.full_name,
                    },
                    emailRedirectTo: undefined // Disable email confirmation redirect
                }
            });

            if (authError) throw authError;

            // 3. Insert/Update profile
            if (authData.user) {
                const { error: profileError } = await supabase
                    .from("profiles")
                    .upsert({
                        id: authData.user.id,
                        email: formData.email,
                        full_name: formData.full_name,
                        role: formData.role
                    });

                if (profileError) throw profileError;
            }

            // Reset and refresh
            setFormData({ full_name: "", email: "", password: "", role: "admin" });
            setShowAddModal(false);
            fetchAdmins();
            alert("Admin berhasil ditambahkan!");
        } catch (err: any) {
            setError(err.message || "Gagal membuat admin");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleUpdateAdmin(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedAdmin) return;

        setError("");
        setSubmitting(true);

        try {
            const { error: updateError } = await supabase
                .from("profiles")
                .update({
                    full_name: formData.full_name,
                    email: formData.email,
                    role: formData.role
                })
                .eq("id", selectedAdmin.id);

            if (updateError) throw updateError;

            setShowEditModal(false);
            setSelectedAdmin(null);
            fetchAdmins();
            alert("Admin berhasil diperbarui!");
        } catch (err: any) {
            setError(err.message || "Gagal memperbarui admin");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDeleteAdmin(admin: AdminUser) {
        if (!confirm(`Yakin ingin menghapus admin "${admin.full_name}"? Aksi ini tidak dapat dibatalkan.`)) {
            return;
        }

        try {
            // Delete from profiles (auth.users will be handled by trigger or manually)
            const { error } = await supabase
                .from("profiles")
                .delete()
                .eq("id", admin.id);

            if (error) throw error;

            fetchAdmins();
            alert("Admin berhasil dihapus!");
        } catch (err: any) {
            alert(`Gagal menghapus admin: ${err.message}`);
        }
    }

    function openEditModal(admin: AdminUser) {
        setSelectedAdmin(admin);
        setFormData({
            full_name: admin.full_name,
            email: admin.email,
            password: "",
            role: admin.role
        });
        setError("");
        setShowEditModal(true);
    }

    const filteredAdmins = admins.filter(
        (admin) =>
            admin.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            admin.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isSuperAdmin) {
        return (
            <div className="p-6">
                <div className="text-center text-red-500">
                    Akses ditolak. Halaman ini hanya untuk Super Admin.
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-brand-blue-900">Kelola Admin</h1>
                    <p className="text-gray-500 mt-1">Tambah, edit, dan kelola akun admin</p>
                </div>
                <button
                    onClick={() => {
                        setFormData({ full_name: "", email: "", password: "", role: "admin" });
                        setError("");
                        setShowAddModal(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Tambah Admin
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
                        placeholder="Cari admin berdasarkan nama atau email..."
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

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terdaftar</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    Memuat data...
                                </td>
                            </tr>
                        ) : filteredAdmins.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    Tidak ada data admin
                                </td>
                            </tr>
                        ) : (
                            filteredAdmins.map((admin) => (
                                <tr key={admin.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-brand-blue-100 text-brand-blue-600 flex items-center justify-center font-medium">
                                                {admin.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="font-medium text-gray-900">{admin.full_name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{admin.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${admin.role === "super_admin"
                                            ? "bg-yellow-100 text-yellow-800"
                                            : "bg-blue-100 text-blue-800"
                                            }`}>
                                            <Shield className="w-3 h-3" />
                                            {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-sm">
                                        {new Date(admin.created_at).toLocaleDateString("id-ID")}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(admin)}
                                                className="p-2 text-brand-blue-600 hover:bg-blue-50 rounded-lg"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAdmin(admin)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                title="Hapus"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="bg-gradient-to-r from-brand-blue-600 to-brand-blue-700 p-5 rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                        <UserCog className="w-5 h-5 text-white" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-white">Tambah Admin Baru</h2>
                                </div>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nama Lengkap <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Password <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue-500"
                                    required
                                    minLength={6}
                                />
                                <p className="text-xs text-gray-500 mt-1">Minimal 6 karakter</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "super_admin" })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue-500"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
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
                                            Membuat...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Buat Admin
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedAdmin && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="bg-gradient-to-r from-brand-blue-600 to-brand-blue-700 p-5 rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                        <Edit2 className="w-5 h-5 text-white" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-white">Edit Admin</h2>
                                </div>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateAdmin} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nama Lengkap <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "super_admin" })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue-500"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
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
        </div>
    );
}
