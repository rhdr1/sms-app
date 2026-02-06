"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

interface WaliChild {
    id: string;
    name: string;
    halaqah: string;
    status: string;
    average_score: number;
}

interface WaliProfile {
    id: string;
    phone: string;
    name: string;
    is_active: boolean;
}

interface WaliAuthContextType {
    wali: WaliProfile | null;
    children: WaliChild[];
    loading: boolean;
    error: string | null;
    loginWali: (phone: string, password: string) => Promise<boolean>;
    logoutWali: () => void;
    changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
    refreshChildren: () => Promise<void>;
}

const WaliAuthContext = createContext<WaliAuthContextType | undefined>(undefined);

const WALI_SESSION_KEY = "wali_session";

// Normalize phone number to 08xxx format
function normalizePhone(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, "");

    // Convert +62 to 0
    if (cleaned.startsWith("62")) {
        cleaned = "0" + cleaned.substring(2);
    }

    // Ensure starts with 08
    if (!cleaned.startsWith("08") && cleaned.startsWith("8")) {
        cleaned = "0" + cleaned;
    }

    return cleaned;
}

export function WaliAuthProvider({ children: childrenNodes }: { children: ReactNode }) {
    const [wali, setWali] = useState<WaliProfile | null>(null);
    const [children, setChildren] = useState<WaliChild[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load session from localStorage on mount
    useEffect(() => {
        const savedSession = localStorage.getItem(WALI_SESSION_KEY);
        if (savedSession) {
            try {
                const parsed = JSON.parse(savedSession);
                setWali(parsed.wali);
                fetchChildren(parsed.wali.phone);
            } catch {
                localStorage.removeItem(WALI_SESSION_KEY);
            }
        }
        setLoading(false);
    }, []);

    // Fetch children for a wali based on phone number
    async function fetchChildren(phone: string) {
        try {
            const { data, error: fetchError } = await supabase
                .rpc("get_wali_children_by_phone", {
                    phone_input: phone
                });

            if (fetchError) {
                console.error("Error fetching children (RPC):", fetchError);
                return;
            }

            const childrenData = (data as any[])?.map((item) => ({
                id: item.id,
                name: item.name,
                halaqah: item.halaqah,
                status: item.status,
                average_score: item.average_score || 0,
            })) || [];

            setChildren(childrenData);
        } catch (err) {
            console.error("Error in fetchChildren:", err);
        }
    }

    // Login function
    async function loginWali(phone: string, password: string): Promise<boolean> {
        setError(null);
        setLoading(true);

        try {
            // Use RPC for logic
            const { data, error: loginError } = await supabase
                .rpc("login_wali", {
                    phone_input: phone,
                    password_input: password
                })
                .single(); // Expecting one row or null

            if (loginError || !data) {
                // If rpc returns no rows (empty array), .single() returns an error usually or null depending on SDK version
                // But typically if no match, it might return null data.
                if (loginError && loginError.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
                    console.error("Login RPC error:", loginError);
                }

                // Double check if data is null
                if (!data) {
                    setError("Nomor HP atau password salah");
                    setLoading(false);
                    return false;
                }
            }

            // If we are here and data is valid
            // Cast data to any first to avoid TS errors
            const result = data as any;

            const waliProfile: WaliProfile = {
                id: result.id,
                phone: result.phone,
                name: result.name,
                is_active: result.is_active,
            };

            setWali(waliProfile);
            localStorage.setItem(WALI_SESSION_KEY, JSON.stringify({ wali: waliProfile }));

            await fetchChildren(waliProfile.phone);
            setLoading(false);
            return true;

        } catch (err) {
            console.error("Login error:", err);
            setError("Terjadi kesalahan. Silakan coba lagi.");
            setLoading(false);
            return false;
        }
    }

    // Logout function
    function logoutWali() {
        setWali(null);
        setChildren([]);
        localStorage.removeItem(WALI_SESSION_KEY);
    }

    // Change password function
    async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
        if (!wali) return false;

        try {
            const { data, error: rpcError } = await supabase
                .rpc("change_wali_password", {
                    wali_id_input: wali.id,
                    old_password: oldPassword,
                    new_password: newPassword
                });

            if (rpcError) {
                console.error("Change password RPC error:", rpcError);
                setError("Gagal mengubah password");
                return false;
            }

            // check boolean return
            if (!data) {
                setError("Password lama salah");
                return false;
            }

            return true;
        } catch (err) {
            console.error("Change password error:", err);
            setError("Terjadi kesalahan. Silakan coba lagi.");
            return false;
        }
    }

    // Refresh children data
    async function refreshChildren() {
        if (wali) {
            await fetchChildren(wali.phone);
        }
    }

    const value: WaliAuthContextType = {
        wali,
        children,
        loading,
        error,
        loginWali,
        logoutWali,
        changePassword,
        refreshChildren,
    };

    return (
        <WaliAuthContext.Provider value={value}>
            {childrenNodes}
        </WaliAuthContext.Provider>
    );
}

export function useWaliAuth() {
    const context = useContext(WaliAuthContext);
    if (context === undefined) {
        throw new Error("useWaliAuth must be used within a WaliAuthProvider");
    }
    return context;
}
