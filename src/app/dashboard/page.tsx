"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
    const router = useRouter();
    const { profile, loading, user } = useAuth();

    useEffect(() => {
        if (!loading) {
            // If no user, redirect to login
            if (!user) {
                router.replace("/login");
                return;
            }

            // If user exists but no profile, redirect to login with error
            if (!profile) {
                console.warn("User logged in but profile not found");
                router.replace("/login");
                return;
            }

            // Redirect based on role
            if (profile.role === "admin") {
                router.replace("/dashboard/admin");
            } else if (profile.role === "ustadz" || profile.role === "super_admin") {
                router.replace("/dashboard/guru");
            }
        }
    }, [loading, profile, user, router]);

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
            <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin mx-auto" style={{ color: "#3182ce" }} />
                <p className="mt-4" style={{ color: "#718096" }}>Mengalihkan ke dashboard...</p>
            </div>
        </div>
    );
}
