"use client";

import ProtectedRoute from "@/components/ProtectedRoute";

export default function GuruLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute requireGuru={true}>
            {children}
        </ProtectedRoute>
    );
}
