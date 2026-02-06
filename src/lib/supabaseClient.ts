import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

// Helper function to clear invalid session
export async function clearInvalidSession() {
    try {
        await supabase.auth.signOut();
    } catch {
        // Ignore errors during signout
    }
    // Clear local storage auth data
    if (typeof window !== "undefined") {
        localStorage.removeItem("supabase.auth.token");
    }
}
