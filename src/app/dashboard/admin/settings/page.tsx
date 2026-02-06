"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
    LogOut,
    Type,
    Smartphone,
    Monitor,
    Check,
    User,
    Settings,
    Eye
} from "lucide-react";

type FontSize = "small" | "medium" | "large";
type ViewMode = "desktop" | "mobile";

export default function PengaturanPage() {
    const [fontSize, setFontSize] = useState<FontSize>("medium");
    const [viewMode, setViewMode] = useState<ViewMode>("desktop");
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    // Load settings from localStorage
    useEffect(() => {
        const savedFontSize = localStorage.getItem("sms-font-size") as FontSize;
        const savedViewMode = localStorage.getItem("sms-view-mode") as ViewMode;

        if (savedFontSize) setFontSize(savedFontSize);
        if (savedViewMode) setViewMode(savedViewMode);

        applyFontSize(savedFontSize || "medium");
        checkUser();
    }, []);

    async function checkUser() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserEmail(user.email || null);
        }
    }

    function applyFontSize(size: FontSize) {
        const root = document.documentElement;
        const sizes = {
            small: "14px",
            medium: "16px",
            large: "18px",
        };
        root.style.fontSize = sizes[size];
    }

    function handleFontSizeChange(size: FontSize) {
        setFontSize(size);
        localStorage.setItem("sms-font-size", size);
        applyFontSize(size);
        showMessage("Ukuran font berhasil diubah");
    }

    function handleViewModeChange(mode: ViewMode) {
        setViewMode(mode);
        localStorage.setItem("sms-view-mode", mode);
        showMessage(`Mode tampilan diubah ke ${mode === "mobile" ? "Mobile" : "Desktop"}`);
    }

    function showMessage(msg: string) {
        setMessage(msg);
        setTimeout(() => setMessage(""), 3000);
    }

    async function handleLogout() {
        if (!confirm("Apakah Anda yakin ingin keluar?")) return;

        setSaving(true);
        await supabase.auth.signOut();
        window.location.href = "/login";
    }

    async function handleLogin() {
        window.location.href = "/login";
    }

    return (
        <div className={`p-6 ${viewMode === "mobile" ? "max-w-sm mx-auto" : ""}`}>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-brand-blue-900">Pengaturan</h1>
                <p className="text-gray-600 mt-1">Kelola preferensi dan akun Anda</p>
            </div>

            {/* Success Message */}
            {message && (
                <div className="mb-6 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    {message}
                </div>
            )}

            <div className="space-y-6">
                {/* Account Section */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <User className="w-5 h-5 text-brand-blue-600" />
                        <h2 className="text-lg font-semibold text-brand-blue-900">Akun</h2>
                    </div>

                    <div className="space-y-4">
                        {userEmail ? (
                            <>
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-500">Email</p>
                                    <p className="font-medium text-gray-900">{userEmail}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    disabled={saving}
                                    className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                >
                                    <LogOut className="w-5 h-5" />
                                    {saving ? "Keluar..." : "Keluar dari Akun"}
                                </button>
                            </>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-gray-500 mb-4">Anda belum login</p>
                                <button
                                    onClick={handleLogin}
                                    className="btn-primary px-6 py-3"
                                >
                                    Masuk ke Akun
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Font Size Section */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Type className="w-5 h-5 text-brand-blue-600" />
                        <h2 className="text-lg font-semibold text-brand-blue-900">Ukuran Font</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { value: "small", label: "Kecil", size: "text-sm" },
                            { value: "medium", label: "Sedang", size: "text-base" },
                            { value: "large", label: "Besar", size: "text-lg" },
                        ].map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleFontSizeChange(option.value as FontSize)}
                                className={`p-3 rounded-lg border-2 transition-all ${fontSize === option.value
                                    ? "border-brand-blue-600 bg-blue-50"
                                    : "border-gray-200 hover:border-gray-300"
                                    }`}
                            >
                                <span className={`${option.size} font-medium ${fontSize === option.value
                                    ? "text-brand-blue-600"
                                    : "text-gray-600"
                                    }`}>
                                    Aa
                                </span>
                                <p className={`text-xs mt-1 ${fontSize === option.value
                                    ? "text-brand-blue-600"
                                    : "text-gray-500"
                                    }`}>
                                    {option.label}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* View Mode Section */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Eye className="w-5 h-5 text-brand-blue-600" />
                        <h2 className="text-lg font-semibold text-brand-blue-900">Mode Tampilan</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleViewModeChange("desktop")}
                            className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${viewMode === "desktop"
                                ? "border-brand-blue-600 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                                }`}
                        >
                            <Monitor className={`w-8 h-8 ${viewMode === "desktop" ? "text-brand-blue-600" : "text-gray-400"}`} />
                            <span className={`font-medium ${viewMode === "desktop" ? "text-brand-blue-600" : "text-gray-600"}`}>
                                Desktop
                            </span>
                            {viewMode === "desktop" && <Check className="w-4 h-4 text-brand-blue-600" />}
                        </button>

                        <button
                            onClick={() => handleViewModeChange("mobile")}
                            className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${viewMode === "mobile"
                                ? "border-brand-blue-600 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                                }`}
                        >
                            <Smartphone className={`w-8 h-8 ${viewMode === "mobile" ? "text-brand-blue-600" : "text-gray-400"}`} />
                            <span className={`font-medium ${viewMode === "mobile" ? "text-brand-blue-600" : "text-gray-600"}`}>
                                Mobile
                            </span>
                            {viewMode === "mobile" && <Check className="w-4 h-4 text-brand-blue-600" />}
                        </button>
                    </div>

                    {viewMode === "mobile" && (
                        <p className="mt-3 text-sm text-gray-500 text-center">
                            Mode mobile mensimulasikan tampilan di layar kecil
                        </p>
                    )}
                </div>

                {/* App Info */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Settings className="w-5 h-5 text-brand-blue-600" />
                        <h2 className="text-lg font-semibold text-brand-blue-900">Tentang Aplikasi</h2>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                        <p><strong>Nama:</strong> Sistem Manajemen Santri (SMS)</p>
                        <p><strong>Versi:</strong> 1.0.0</p>
                        <p><strong>Sekolah:</strong> Mulazamah</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
