"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                if (authError.message.includes("Invalid login credentials")) {
                    setError("Email atau password salah. Silakan coba lagi.");
                } else if (authError.message.includes("Email not confirmed")) {
                    setError("Email belum dikonfirmasi. Cek inbox Anda.");
                } else {
                    setError(authError.message);
                }
                return;
            }

            if (data.user) {
                router.push("/dashboard");
            }
        } catch (err) {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setLoading(false);
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
                    <div className="w-16 h-16 bg-brand-blue-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-white text-2xl font-bold">SMS</span>
                    </div>
                    <h1 className="text-2xl font-bold text-brand-blue-900">
                        Sistem Manajemen Santri
                    </h1>
                    <p className="text-gray-500 mt-2">Masuk untuk melanjutkan</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email */}
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium mb-2"
                            style={{ color: "#1a365d" }}
                        >
                            Email
                        </label>
                        <div className="relative">
                            <Mail
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                                style={{ color: "#a0aec0" }}
                            />
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ustadz@pesantren.id"
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
                                placeholder="••••••••"
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
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
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
                <p className="text-center text-sm text-gray-500 mt-6">
                    Belum punya akun? Hubungi administrator.
                </p>
            </div>
        </div>
    );
}
