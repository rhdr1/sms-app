"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useWaliAuth } from "@/contexts/WaliAuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
    requireGuru?: boolean;
}

export default function ProtectedRoute({
    children,
    requireAdmin = false,
    requireGuru = false,
    requireWali = false
}: ProtectedRouteProps & { requireWali?: boolean }) {
    const { user, loading: authLoading, profile, canAccessAdmin, canAccessGuru } = useAuth();
    const { wali, loading: waliLoading } = useWaliAuth();
    const router = useRouter();
    const pathname = usePathname();

    const loading = authLoading || waliLoading;

    useEffect(() => {
        if (!loading) {
            // Case 1: Wali only page
            if (requireWali) {
                if (!wali) {
                    router.push("/wali/login");
                }
                return;
            }

            // Case 2: Regular auth page (Admin/Guru)
            // If it's a regular page, user must be logged in via Supabase Auth
            // UNLESS it's a shared page? For now assume strict separation.
            // Actually, if I wrap strict pages with RequireAdmin/Guru, those will handle it.
            // If I just wrap dashboard layout, I need to know WHO is trying to access.

            // If we are logged in as Wali, and trying to access Wali pages, let it pass.
            // The routing logic handles path checks, here we just check access rights.

            if (wali && pathname?.startsWith("/dashboard/wali")) {
                return;
            }

            // If not Wali, and not generic User, then redirect to Login
            if (!user && !wali) {
                // Determine where to redirect based on what they tried to access?
                // Default to generic login
                router.push("/login");
                return;
            }

            // If logged in as User (not Wali)
            if (user && profile) {
                // Strict role-based access control
                if (requireAdmin && !canAccessAdmin) {
                    // Admin page requested but user can't access admin
                    router.push("/dashboard/guru");
                    return;
                }

                if (requireGuru && !canAccessGuru) {
                    // Guru page requested but user can't access guru
                    router.push("/dashboard/admin");
                    return;
                }
            }
        }
    }, [user, wali, loading, profile, canAccessAdmin, canAccessGuru, requireAdmin, requireGuru, requireWali, router, pathname]);

    // Show loading while checking auth
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto" style={{ color: "#3182ce" }} />
                    <p className="mt-4" style={{ color: "#718096" }}>Memuat...</p>
                </div>
            </div>
        );
    }

    // Not logged in (neither User nor Wali)
    if (!user && !wali) {
        return null;
    }

    // Check specific requirements render-side guards

    // 1. Wali Requirement
    if (requireWali && !wali) return null;

    // 2. Admin Requirement
    if (requireAdmin && (!user || !canAccessAdmin)) return null;

    // 3. Guru Requirement
    if (requireGuru && (!user || !canAccessGuru)) return null;


    return <>{children}</>;
}
