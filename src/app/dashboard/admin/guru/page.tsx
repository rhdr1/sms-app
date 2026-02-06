"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Search, UserCog, Edit2, Trash2, X, Check, Loader2, Mail, Phone, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Teacher {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    specialization: string | null;
    status: "active" | "inactive";
    created_at: string;
    assigned_admins?: string[]; // IDs of assigned admins
}

interface AdminProfile {
    id: string;
    full_name: string;
    email: string;
}

export default function KelolaGuruPage() {
    const { isSuperAdmin, assignedGuruIds, user } = useAuth();
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [admins, setAdmins] = useState<AdminProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<Teacher | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        specialization: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Add Admin in Modal states
    const [showAddAdminForm, setShowAddAdminForm] = useState(false);
    const [newAdminData, setNewAdminData] = useState({ full_name: "", email: "", password: "" });
    const [addingAdmin, setAddingAdmin] = useState(false);
    const [assignmentLoading, setAssignmentLoading] = useState<string | null>(null);

    // Fetch teachers and assignments
    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user, isSuperAdmin]); // Reload when role info is available

    async function fetchData() {
        setLoading(true);
        try {
            // 1. Fetch Teachers
            const { data: teachersData, error: teachersError } = await supabase
                .from("teachers")
                .select("*")
                .order("created_at", { ascending: false });

            if (teachersError) throw teachersError;

            let allTeachers = teachersData || [];

            // 2. If Super Admin, fetch assignments and admin list
            if (isSuperAdmin) {
                // Fetch Admins
                const { data: adminsData } = await supabase
                    .from("profiles")
                    .select("id, full_name, email")
                    .eq("role", "admin");

                setAdmins(adminsData || []);

                // Fetch Assignments
                const { data: assignmentsData } = await supabase
                    .from("admin_guru_assignments")
                    .select("admin_id, guru_id");

                // Map assignments to teachers
                allTeachers = allTeachers.map(t => ({
                    ...t,
                    assigned_admins: assignmentsData
                        ?.filter(a => a.guru_id === t.id)
                        .map(a => a.admin_id) || []
                }));
            } else {
                // Regular Admin: Filter by assigned teachers
                // assignedGuruIds is fetched in AuthContext
                allTeachers = allTeachers.filter(t => assignedGuruIds?.includes(t.id));
            }

            setTeachers(allTeachers);
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoading(false);
        }
    }

    // Add new teacher
    async function handleAddTeacher(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError("Nama guru harus diisi");
            return;
        }

        setSubmitting(true);
        setError("");

        const { error } = await supabase.from("teachers").insert([
            {
                name: formData.name.trim(),
                email: formData.email.trim() || null,
                phone: formData.phone.trim() || null,
                specialization: formData.specialization.trim() || null,
            },
        ]);

        if (error) {
            setError("Gagal menambahkan guru: " + error.message);
        } else {
            setFormData({ name: "", email: "", phone: "", specialization: "" });
            setShowAddModal(false);
            fetchData();
        }
        setSubmitting(false);
    }

    // Delete teacher
    async function handleDeleteTeacher(id: string) {
        if (!confirm("Apakah Anda yakin ingin menghapus guru ini?")) return;

        const { error } = await supabase.from("teachers").delete().eq("id", id);
        if (error) {
            alert("Gagal menghapus guru: " + error.message);
        } else {
            fetchData();
        }
    }

    // Filter teachers by search
    // Toggle admin assignment with loading state
    async function handleToggleAssignment(adminId: string, isAssigned: boolean) {
        if (!selectedTeacherForAssign) return;

        setAssignmentLoading(adminId);

        if (isAssigned) {
            // Remove assignment
            const { error } = await supabase
                .from("admin_guru_assignments")
                .delete()
                .eq("admin_id", adminId)
                .eq("guru_id", selectedTeacherForAssign.id);

            if (error) {
                console.error("Error removing assignment:", error.message);
                alert(`Gagal menghapus: ${error.message}`);
            }
        } else {
            // Add assignment
            const { error } = await supabase
                .from("admin_guru_assignments")
                .insert({
                    admin_id: adminId,
                    guru_id: selectedTeacherForAssign.id
                });

            if (error) {
                console.error("Error adding assignment:", error.message);
                alert(`Gagal menambahkan: ${error.message}`);
            }
        }

        setAssignmentLoading(null);
        // Update local state immediately for better UX
        setSelectedTeacherForAssign(prev => {
            if (!prev) return null;
            const currentAssigned = prev.assigned_admins || [];
            return {
                ...prev,
                assigned_admins: isAssigned
                    ? currentAssigned.filter(id => id !== adminId)
                    : [...currentAssigned, adminId]
            };
        });
        // Also refresh background data
        fetchData();
    }

    // Create new admin user
    async function handleCreateAdmin(e: React.FormEvent) {
        e.preventDefault();
        if (!newAdminData.email || !newAdminData.full_name || !newAdminData.password) {
            alert("Mohon lengkapi semua field");
            return;
        }

        setAddingAdmin(true);

        // 1. Create auth user via Supabase Admin API (sign up)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: newAdminData.email,
            password: newAdminData.password,
            options: {
                data: {
                    full_name: newAdminData.full_name,
                }
            }
        });

        if (authError) {
            alert(`Gagal membuat akun: ${authError.message}`);
            setAddingAdmin(false);
            return;
        }

        // 2. Insert profile with admin role
        if (authData.user) {
            const { error: profileError } = await supabase
                .from("profiles")
                .insert({
                    id: authData.user.id,
                    email: newAdminData.email,
                    full_name: newAdminData.full_name,
                    role: "admin"
                });

            if (profileError) {
                alert(`Akun dibuat tapi gagal set profil: ${profileError.message}`);
            }
        }

        // Reset form and refresh
        setNewAdminData({ full_name: "", email: "", password: "" });
        setShowAddAdminForm(false);
        setAddingAdmin(false);
        fetchData();
    }

    const filteredTeachers = teachers.filter(
        (t) =>
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.email && t.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (t.specialization && t.specialization.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getStatusBadge = (status: string) => {
        return status === "active"
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-700";
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-brand-blue-900">Kelola Guru</h1>
                    <p className="text-gray-600 mt-1">Tambah, edit, dan kelola data guru/ustadz</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Tambah Guru
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
                        placeholder="Cari guru berdasarkan nama, email, atau spesialisasi..."
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

            {/* Teachers List */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-blue-600" />
                        <span className="ml-3 text-gray-600">Memuat data guru...</span>
                    </div>
                ) : filteredTeachers.length === 0 ? (
                    <div className="text-center p-12">
                        <UserCog className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-600">
                            {searchQuery ? "Guru tidak ditemukan" : "Belum ada data guru"}
                        </h3>
                        <p className="text-gray-400 mt-1">
                            {searchQuery
                                ? "Coba kata kunci lain"
                                : "Klik tombol 'Tambah Guru' untuk menambahkan guru baru"}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Nama Guru
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Kontak
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Spesialisasi
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    {isSuperAdmin && (
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Admin Pengawas
                                        </th>
                                    )}
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredTeachers.map((teacher) => (
                                    <tr key={teacher.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-brand-yellow-100 flex items-center justify-center">
                                                    <span className="text-brand-yellow-600 font-semibold">
                                                        {teacher.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <span className="font-medium text-gray-900">
                                                    {teacher.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {teacher.email && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Mail className="w-4 h-4" />
                                                        {teacher.email}
                                                    </div>
                                                )}
                                                {teacher.phone && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Phone className="w-4 h-4" />
                                                        {teacher.phone}
                                                    </div>
                                                )}
                                                {!teacher.email && !teacher.phone && (
                                                    <span className="text-gray-400 text-sm">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {teacher.specialization || "-"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                                                    teacher.status
                                                )}`}
                                            >
                                                {teacher.status === "active" ? "Aktif" : "Tidak Aktif"}
                                            </span>
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {teacher.assigned_admins && teacher.assigned_admins.length > 0 ? (
                                                        teacher.assigned_admins.map(adminId => {
                                                            const admin = admins.find(a => a.id === adminId);
                                                            return (
                                                                <span key={adminId} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                                                                    {admin?.full_name || "Unknown Admin"}
                                                                </span>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-gray-400 text-xs italic">Belum ada</span>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTeacherForAssign(teacher);
                                                            setShowAssignModal(true);
                                                        }}
                                                        className="ml-1 p-1 text-gray-400 hover:text-blue-600 rounded-full"
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    className="p-2 text-gray-400 hover:text-brand-blue-600 hover:bg-brand-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTeacher(teacher.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Hapus"
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

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold text-brand-blue-900">
                                Tambah Guru Baru
                            </h2>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleAddTeacher} className="p-4 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nama Guru <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    placeholder="Masukkan nama lengkap guru"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData({ ...formData, email: e.target.value })
                                    }
                                    placeholder="ustadz@example.com"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    No. Telepon
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({ ...formData, phone: e.target.value })
                                    }
                                    placeholder="08xxxxxxxxxx"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Spesialisasi
                                </label>
                                <input
                                    type="text"
                                    value={formData.specialization}
                                    onChange={(e) =>
                                        setFormData({ ...formData, specialization: e.target.value })
                                    }
                                    placeholder="Contoh: Tahfidz, Fiqih, Bahasa Arab"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
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

            {/* Assign Admin Modal - Enhanced */}
            {showAssignModal && selectedTeacherForAssign && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-brand-blue-600 to-brand-blue-700 p-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">
                                            Kelola Admin Pengawas
                                        </h2>
                                        <p className="text-sm text-blue-100">untuk {selectedTeacherForAssign.name}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowAssignModal(false);
                                        setShowAddAdminForm(false);
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 max-h-[50vh] overflow-y-auto">
                            {/* Admin List */}
                            <div className="space-y-2">
                                {admins.map(admin => {
                                    const isAssigned = selectedTeacherForAssign.assigned_admins?.includes(admin.id);
                                    const isLoading = assignmentLoading === admin.id;
                                    return (
                                        <div
                                            key={admin.id}
                                            onClick={() => !isLoading && handleToggleAssignment(admin.id, !!isAssigned)}
                                            className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${isLoading
                                                    ? "opacity-60 cursor-wait"
                                                    : isAssigned
                                                        ? "bg-blue-50 border-blue-300 shadow-sm"
                                                        : "bg-white border-gray-100 hover:border-blue-200 hover:bg-blue-50/50"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm ${isAssigned ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
                                                    }`}>
                                                    {admin.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{admin.full_name}</div>
                                                    <div className="text-xs text-gray-500">{admin.email}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center">
                                                {isLoading ? (
                                                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                                ) : isAssigned ? (
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded-full text-xs font-medium">
                                                        <Check className="w-3 h-3" />
                                                        Aktif
                                                    </div>
                                                ) : (
                                                    <div className="px-2 py-1 border border-gray-200 text-gray-400 rounded-full text-xs">
                                                        Klik untuk pilih
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {admins.length === 0 && !showAddAdminForm && (
                                    <div className="text-center py-8">
                                        <Shield className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                        <p className="text-gray-500 mb-2">Belum ada admin terdaftar</p>
                                        <button
                                            onClick={() => setShowAddAdminForm(true)}
                                            className="text-brand-blue-600 font-medium hover:underline"
                                        >
                                            + Tambah Admin Baru
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Add Admin Form */}
                            {showAddAdminForm && (
                                <div className="mt-4 p-4 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl border border-blue-100">
                                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                        <Plus className="w-4 h-4 text-brand-blue-600" />
                                        Tambah Admin Baru
                                    </h3>
                                    <form onSubmit={handleCreateAdmin} className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder="Nama Lengkap"
                                            value={newAdminData.full_name}
                                            onChange={(e) => setNewAdminData({ ...newAdminData, full_name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue-500 focus:border-transparent"
                                            required
                                        />
                                        <input
                                            type="email"
                                            placeholder="Email"
                                            value={newAdminData.email}
                                            onChange={(e) => setNewAdminData({ ...newAdminData, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue-500 focus:border-transparent"
                                            required
                                        />
                                        <input
                                            type="password"
                                            placeholder="Password"
                                            value={newAdminData.password}
                                            onChange={(e) => setNewAdminData({ ...newAdminData, password: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue-500 focus:border-transparent"
                                            required
                                            minLength={6}
                                        />
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowAddAdminForm(false);
                                                    setNewAdminData({ full_name: "", email: "", password: "" });
                                                }}
                                                className="flex-1 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                                            >
                                                Batal
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={addingAdmin}
                                                className="flex-1 px-3 py-2 text-sm bg-brand-blue-600 text-white rounded-lg hover:bg-brand-blue-700 flex items-center justify-center gap-2"
                                            >
                                                {addingAdmin ? (
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
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t bg-gray-50 flex items-center justify-between gap-3">
                            {!showAddAdminForm && admins.length > 0 && (
                                <button
                                    onClick={() => setShowAddAdminForm(true)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-brand-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Admin Baru
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setShowAssignModal(false);
                                    setShowAddAdminForm(false);
                                }}
                                className="flex-1 btn-primary ml-auto max-w-[200px]"
                            >
                                Selesai
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
