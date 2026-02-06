"use client";

import { useState, useEffect } from "react";
import { BookOpen, TrendingUp, Calendar, Bell, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useWaliAuth } from "@/contexts/WaliAuthContext";

interface Announcement {
    id: string;
    title: string;
    content: string;
    created_at: string;
}

interface ChildSummary {
    id: string;
    name: string;
    halaqah: string;
    status: string;
    average_score: number;
    lastScore: number | null;
    attendanceRate: number;
}

export default function WaliDashboardPage() {
    const { wali, children } = useWaliAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [childrenSummary, setChildrenSummary] = useState<ChildSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [children]);

    async function fetchData() {
        setLoading(true);
        try {
            // Fetch active announcements
            const { data: announcementsData } = await supabase
                .from("announcements")
                .select("id, title, content, created_at")
                .eq("is_active", true)
                .order("created_at", { ascending: false })
                .limit(3);

            setAnnouncements(announcementsData || []);

            // Fetch summary for each child using new RPC
            if (wali?.phone) {
                const { data: summaryData, error: summaryError } = await supabase
                    .rpc("get_wali_dashboard_summary", {
                        phone_input: wali.phone
                    });

                if (summaryError) {
                    console.error("Error fetching dashboard summary:", summaryError);
                } else {
                    const summaries: ChildSummary[] = (summaryData as any[] || []).map(item => ({
                        id: item.id,
                        name: item.name,
                        halaqah: item.halaqah,
                        status: item.status,
                        average_score: item.average_score,
                        lastScore: item.last_score,
                        attendanceRate: item.attendance_rate
                    }));
                    setChildrenSummary(summaries);
                }
            }

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }

    function getStatusColor(status: string) {
        switch (status) {
            case "Mutqin":
                return { bg: "#dcfce7", text: "#166534" };
            case "Dhaif":
                return { bg: "#fee2e2", text: "#991b1b" };
            default:
                return { bg: "#fef9c3", text: "#854d0e" };
        }
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
            {/* Welcome Card */}
            <div className="card p-6 bg-gradient-to-r from-brand-blue-900 to-brand-blue-500 text-white">
                <h2 className="text-2xl font-bold mb-2">
                    Assalamu&apos;alaikum, {wali?.name}! 👋
                </h2>
                <p className="text-blue-100">
                    Selamat datang di Portal Wali Santri. Pantau perkembangan putra/putri Anda.
                </p>
            </div>

            {/* Announcements */}
            {announcements.length > 0 && (
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Bell className="w-5 h-5 text-brand-yellow-500" />
                        <h3 className="text-lg font-semibold text-brand-blue-900">
                            Pengumuman Terbaru
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {announcements.map((announcement) => (
                            <div
                                key={announcement.id}
                                className="p-4 bg-brand-yellow-50 border border-brand-yellow-200 rounded-xl"
                            >
                                <div className="flex items-start justify-between">
                                    <h4 className="font-medium text-brand-blue-900">
                                        {announcement.title}
                                    </h4>
                                    <span className="text-xs text-gray-500">
                                        {formatDate(announcement.created_at)}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    {announcement.content}
                                </p>
                            </div>
                        ))}
                    </div>
                    <Link
                        href="/dashboard/wali/pengumuman"
                        className="inline-flex items-center gap-1 text-sm text-brand-blue-500 hover:text-brand-blue-900 mt-4"
                    >
                        Lihat semua pengumuman
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            )}

            {/* Children Summary */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-brand-blue-500" />
                    <h3 className="text-lg font-semibold text-brand-blue-900">
                        Ringkasan Anak
                    </h3>
                </div>

                {childrenSummary.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                        Belum ada data anak yang terhubung.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {childrenSummary.map((child) => {
                            const statusColor = getStatusColor(child.status);
                            return (
                                <Link
                                    key={child.id}
                                    href={`/dashboard/wali/anak/${child.id}`}
                                    className="block p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-brand-blue-200 transition-all"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h4 className="font-semibold text-brand-blue-900">
                                                {child.name}
                                            </h4>
                                            <p className="text-sm text-gray-500">
                                                {child.halaqah}
                                            </p>
                                        </div>
                                        <span
                                            className="px-2 py-1 text-xs font-medium rounded-full"
                                            style={{
                                                backgroundColor: statusColor.bg,
                                                color: statusColor.text
                                            }}
                                        >
                                            {child.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                                            <BookOpen className="w-4 h-4 text-brand-blue-500 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-brand-blue-900">
                                                {child.average_score.toFixed(0)}
                                            </p>
                                            <p className="text-xs text-gray-500">Rata-rata</p>
                                        </div>
                                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                                            <TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-brand-blue-900">
                                                {child.lastScore ?? "-"}
                                            </p>
                                            <p className="text-xs text-gray-500">Terakhir</p>
                                        </div>
                                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                                            <Calendar className="w-4 h-4 text-brand-yellow-500 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-brand-blue-900">
                                                {child.attendanceRate}%
                                            </p>
                                            <p className="text-xs text-gray-500">Kehadiran</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end mt-3 text-sm text-brand-blue-500">
                                        Lihat Detail
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
