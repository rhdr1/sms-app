"use client";

import ProtectedRoute from "@/components/ProtectedRoute";

export default function WaliLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute requireWali={true}>
            {children}
        </ProtectedRoute>
    );
}
