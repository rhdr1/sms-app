"use client";

import Sidebar from "@/components/Sidebar";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <div className="flex min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
                <Sidebar />
                <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
                    {children}
                </main>
            </div>
        </ProtectedRoute>
    );
}
