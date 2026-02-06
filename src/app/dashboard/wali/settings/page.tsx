"use client";

import { useState } from "react";
import { Settings, Lock, Save, CheckCircle2 } from "lucide-react";
import { useWaliAuth } from "@/contexts/WaliAuthContext";

export default function WaliSettingsPage() {
    const { wali, changePassword } = useWaliAuth();
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        // Validation
        if (!oldPassword.trim()) {
            setError("Password lama harus diisi");
            return;
        }

        if (!newPassword.trim()) {
            setError("Password baru harus diisi");
            return;
        }

        if (newPassword.length < 6) {
            setError("Password baru minimal 6 karakter");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Konfirmasi password tidak cocok");
            return;
        }

        if (oldPassword === newPassword) {
            setError("Password baru harus berbeda dengan password lama");
            return;
        }

        setLoading(true);
        try {
            const result = await changePassword(oldPassword, newPassword);
            if (result) {
                setSuccess(true);
                setOldPassword("");
                setNewPassword("");
                setConfirmPassword("");
            }
        } catch (err) {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-6 h-6 text-brand-blue-500" />
                    <h1 className="text-2xl font-bold text-brand-blue-900">
                        Pengaturan
                    </h1>
                </div>
                <p className="text-gray-500">
                    Kelola akun dan keamanan Anda.
                </p>
            </div>

            {/* Account Info */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-brand-blue-900 mb-4">
                    Informasi Akun
                </h2>
                <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">Nama</span>
                        <span className="font-medium text-brand-blue-900">{wali?.name}</span>
                    </div>
                    <div className="flex justify-between py-2">
                        <span className="text-gray-500">Nomor HP</span>
                        <span className="font-medium text-brand-blue-900">{wali?.phone}</span>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Lock className="w-5 h-5 text-brand-blue-500" />
                    <h2 className="text-lg font-semibold text-brand-blue-900">
                        Ubah Password
                    </h2>
                </div>

                {success && (
                    <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 mb-4">
                        <CheckCircle2 className="w-5 h-5" />
                        Password berhasil diubah!
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Password Lama
                        </label>
                        <input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="Masukkan password lama"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Password Baru
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Masukkan password baru (min. 6 karakter)"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Konfirmasi Password Baru
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Masukkan ulang password baru"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-blue-500"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary flex items-center justify-center gap-2 w-full disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Simpan Password
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
