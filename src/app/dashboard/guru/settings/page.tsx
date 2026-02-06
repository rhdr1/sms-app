"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
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

export default function GuruSettingsPage() {
    const { profile, signOut } = useAuth();
    const [fontSize, setFontSize] = useState<FontSize>("medium");
    const [viewMode, setViewMode] = useState<ViewMode>("desktop");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    // Load settings from localStorage
    useEffect(() => {
        const savedFontSize = localStorage.getItem("sms-font-size") as FontSize;
        const savedViewMode = localStorage.getItem("sms-view-mode") as ViewMode;

        if (savedFontSize) setFontSize(savedFontSize);
        if (savedViewMode) setViewMode(savedViewMode);

        applyFontSize(savedFontSize || "medium");
    }, []);

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
        await signOut();
        window.location.href = "/login";
    }

    return (
        <div className={`p-6 ${viewMode === "mobile" ? "max-w-sm mx-auto" : ""}`}>
            {/* Header */}
            <div className="mb-8">
                <h1 style={{ color: "#1a365d", fontSize: "1.5rem", fontWeight: 700 }}>Pengaturan</h1>
                <p style={{ color: "#718096", marginTop: "0.25rem" }}>Kelola preferensi dan akun Anda</p>
            </div>

            {/* Success Message */}
            {message && (
                <div className="mb-6 p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: "#f0fff4", color: "#2f855a" }}>
                    <Check className="w-5 h-5" />
                    {message}
                </div>
            )}

            <div className="space-y-6">
                {/* Account Section */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <User className="w-5 h-5" style={{ color: "#3182ce" }} />
                        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1a365d" }}>Akun</h2>
                    </div>

                    <div className="space-y-4">
                        {profile ? (
                            <>
                                <div className="p-4 rounded-lg" style={{ backgroundColor: "#f7fafc" }}>
                                    <p style={{ fontSize: "0.875rem", color: "#a0aec0" }}>Nama</p>
                                    <p style={{ fontWeight: 500, color: "#1a202c" }}>{profile.full_name}</p>
                                </div>
                                <div className="p-4 rounded-lg" style={{ backgroundColor: "#f7fafc" }}>
                                    <p style={{ fontSize: "0.875rem", color: "#a0aec0" }}>Email</p>
                                    <p style={{ fontWeight: 500, color: "#1a202c" }}>{profile.email}</p>
                                </div>
                                <div className="p-4 rounded-lg" style={{ backgroundColor: "#f7fafc" }}>
                                    <p style={{ fontSize: "0.875rem", color: "#a0aec0" }}>Role</p>
                                    <p style={{ fontWeight: 500, color: "#1a202c" }}>{profile.role === "admin" ? "Administrator" : "Guru"}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    disabled={saving}
                                    className="w-full px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                    style={{ backgroundColor: "#fff5f5", color: "#e53e3e" }}
                                >
                                    <LogOut className="w-5 h-5" />
                                    {saving ? "Keluar..." : "Keluar dari Akun"}
                                </button>
                            </>
                        ) : (
                            <div className="text-center py-4">
                                <p style={{ color: "#a0aec0" }} className="mb-4">Memuat data akun...</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Font Size Section */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Type className="w-5 h-5" style={{ color: "#3182ce" }} />
                        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1a365d" }}>Ukuran Font</h2>
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
                                    ? "border-blue-600 bg-blue-50"
                                    : "border-gray-200 hover:border-gray-300"
                                    }`}
                            >
                                <span className={`${option.size} font-medium ${fontSize === option.value
                                    ? "text-blue-600"
                                    : "text-gray-600"
                                    }`}>
                                    Aa
                                </span>
                                <p className={`text-xs mt-1 ${fontSize === option.value
                                    ? "text-blue-600"
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
                        <Eye className="w-5 h-5" style={{ color: "#3182ce" }} />
                        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1a365d" }}>Mode Tampilan</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleViewModeChange("desktop")}
                            className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${viewMode === "desktop"
                                ? "border-blue-600 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                                }`}
                        >
                            <Monitor className={`w-8 h-8 ${viewMode === "desktop" ? "text-blue-600" : "text-gray-400"}`} />
                            <span className={`font-medium ${viewMode === "desktop" ? "text-blue-600" : "text-gray-600"}`}>
                                Desktop
                            </span>
                            {viewMode === "desktop" && <Check className="w-4 h-4 text-blue-600" />}
                        </button>

                        <button
                            onClick={() => handleViewModeChange("mobile")}
                            className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${viewMode === "mobile"
                                ? "border-blue-600 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                                }`}
                        >
                            <Smartphone className={`w-8 h-8 ${viewMode === "mobile" ? "text-blue-600" : "text-gray-400"}`} />
                            <span className={`font-medium ${viewMode === "mobile" ? "text-blue-600" : "text-gray-600"}`}>
                                Mobile
                            </span>
                            {viewMode === "mobile" && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                    </div>

                    {viewMode === "mobile" && (
                        <p className="mt-3 text-sm text-center" style={{ color: "#a0aec0" }}>
                            Mode mobile mensimulasikan tampilan di layar kecil
                        </p>
                    )}
                </div>

                {/* App Info */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Settings className="w-5 h-5" style={{ color: "#3182ce" }} />
                        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1a365d" }}>Tentang Aplikasi</h2>
                    </div>

                    <div className="space-y-2 text-sm" style={{ color: "#718096" }}>
                        <p><strong>Nama:</strong> Sistem Manajemen Santri (SMS)</p>
                        <p><strong>Versi:</strong> 1.0.0</p>
                        <p><strong>Sekolah:</strong> Mulazamah</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
