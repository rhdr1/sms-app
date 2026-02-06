"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: "admin" | "ustadz" | "super_admin";
    avatar_url: string | null;
    teacher_id: string | null;
    assignedGuruIds?: string[];
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    role: "admin" | "ustadz" | "super_admin" | null;
    isAdmin: boolean;
    isGuru: boolean;
    isSuperAdmin: boolean;
    canAccessAdmin: boolean;
    canAccessGuru: boolean;
    assignedGuruIds: string[];
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch user profile from database
    async function fetchProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            // Check for errors FIRST before accessing data
            if (error) {
                if (error.code === "PGRST116") {
                    console.warn("Profile not found for user:", userId);
                    return null;
                }
                // eslint-disable-next-line no-console
                console.error("Error fetching profile:", error);
                return null;
            }

            if (!data) return null;

            // For admin role, fetch assigned guru IDs
            if (data.role === "admin") {
                const { data: assignments } = await supabase
                    .from("admin_guru_assignments")
                    .select("guru_id")
                    .eq("admin_id", userId);

                return {
                    ...data,
                    assignedGuruIds: assignments?.map(a => a.guru_id) || [],
                    teacher_id: null,
                } as Profile;
            }

            // For ustadz or super_admin role, fetch teacher_id by matching email
            let teacherId: string | null = null;
            if ((data.role === "ustadz" || data.role === "super_admin") && data.email) {
                const { data: teacherData } = await supabase
                    .from("teachers")
                    .select("id")
                    .eq("email", data.email)
                    .single();

                teacherId = teacherData?.id || null;
            }

            return {
                ...data,
                assignedGuruIds: [], // Default empty for non-admin users
                teacher_id: teacherId,
            } as Profile;
        } catch (err) {
            console.error("Error in fetchProfile:", err);
            return null;
        }
    }

    // Refresh profile data
    async function refreshProfile() {
        if (user) {
            const profileData = await fetchProfile(user.id);
            setProfile(profileData);
        }
    }

    // Sign out
    async function signOut() {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
    }

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                const profileData = await fetchProfile(session.user.id);
                setProfile(profileData);
            }

            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    const profileData = await fetchProfile(session.user.id);
                    setProfile(profileData);
                } else {
                    setProfile(null);
                }

                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const value: AuthContextType = {
        user,
        session,
        profile,
        role: profile?.role ?? null,
        isSuperAdmin: profile?.role === "super_admin",
        isAdmin: profile?.role === "admin" || profile?.role === "super_admin",
        isGuru: profile?.role === "ustadz" || profile?.role === "super_admin",
        canAccessAdmin: profile?.role === "admin" || profile?.role === "super_admin",
        canAccessGuru: profile?.role === "ustadz" || profile?.role === "super_admin",
        assignedGuruIds: profile?.assignedGuruIds || [],
        loading,
        signOut,
        refreshProfile,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
