"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useWaliAuth } from "@/contexts/WaliAuthContext";

export default function WaliLoginPage() {
    const router = useRouter();
    const { loginWali, loading, error } = useWaliAuth();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        // Basic validation
        if (!phone.trim()) {
            setLocalError("Nomor HP harus diisi");
            return;
        }

        if (!password.trim()) {
            setLocalError("Password harus diisi");
            return;
        }

        if (password.length < 6) {
            setLocalError("Password minimal 6 karakter");
            return;
        }

        const success = await loginWali(phone, password);
        if (success) {
            router.push("/dashboard/wali");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-surface px-4">
            <div className="card w-full max-w-md p-8">
                {/* Back Link */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-1 text-brand-blue-500 hover:text-brand-blue-900 mb-6 text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Kembali ke Beranda
                </Link>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-brand-blue-500 to-brand-blue-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-white text-xl font-bold">👨‍👩‍👧</span>
                    </div>
                    <h1 className="text-2xl font-bold text-brand-blue-900">
                        Portal Wali Santri
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Masuk untuk melihat perkembangan putra/putri Anda
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Phone */}
                    <div>
                        <label
                            htmlFor="phone"
                            className="block text-sm font-medium mb-2"
                            style={{ color: "#1a365d" }}
                        >
                            Nomor HP
                        </label>
                        <div className="relative">
                            <Phone
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                                style={{ color: "#a0aec0" }}
                            />
                            <input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="081234567890"
                                required
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
                        <p className="text-xs text-gray-400 mt-1">
                            Gunakan nomor HP yang terdaftar
                        </p>
                    </div>

                    {/* Password */}
                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium mb-2"
                            style={{ color: "#1a365d" }}
                        >
                            Password
                        </label>
                        <div className="relative">
                            <Lock
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                                style={{ color: "#a0aec0" }}
                            />
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••"
                                required
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
                        <p className="text-xs text-gray-400 mt-1">
                            Default: 6 digit terakhir nomor HP Anda
                        </p>
                    </div>

                    {/* Error */}
                    {(error || localError) && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error || localError}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-brand-blue-900 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            "Masuk"
                        )}
                    </button>
                </form>

                {/* Help Text */}
                <div className="text-center text-sm text-gray-500 mt-6 space-y-2">
                    <p>
                        Lupa password? Hubungi admin pesantren.
                    </p>
                    <div className="pt-4 border-t">
                        <Link
                            href="/login"
                            className="text-brand-blue-500 hover:text-brand-blue-900"
                        >
                            Login sebagai Guru/Admin →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
