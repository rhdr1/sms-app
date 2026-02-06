"use client";

import { useState, useEffect } from "react";
import { Bell, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Announcement {
    id: string;
    title: string;
    content: string;
    created_at: string;
}

export default function WaliPengumumanPage() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    async function fetchAnnouncements() {
        setLoading(true);
        try {
            const { data } = await supabase
                .from("announcements")
                .select("id, title, content, created_at")
                .eq("is_active", true)
                .order("created_at", { ascending: false });

            setAnnouncements(data || []);
        } catch (error) {
            console.error("Error fetching announcements:", error);
        } finally {
            setLoading(false);
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        });
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
            {/* Header */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-6 h-6 text-brand-yellow-500" />
                    <h1 className="text-2xl font-bold text-brand-blue-900">
                        Pengumuman
                    </h1>
                </div>
                <p className="text-gray-500">
                    Pengumuman dan informasi terbaru dari pesantren.
                </p>
            </div>

            {/* Announcements List */}
            {announcements.length === 0 ? (
                <div className="card p-8 text-center">
                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                        Belum ada pengumuman untuk saat ini.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {announcements.map((announcement) => (
                        <div key={announcement.id} className="card p-6">
                            <div className="flex items-start justify-between mb-3">
                                <h2 className="text-lg font-semibold text-brand-blue-900">
                                    {announcement.title}
                                </h2>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap mb-4">
                                {announcement.content}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Calendar className="w-4 h-4" />
                                {formatDate(announcement.created_at)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
