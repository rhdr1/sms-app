"use client";

import { WaliAuthProvider } from "@/contexts/WaliAuthContext";

export default function WaliLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <WaliAuthProvider>
            {children}
        </WaliAuthProvider>
    );
}
