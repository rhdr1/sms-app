export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    email: string
                    full_name: string
                    role: "admin" | "ustadz" | "super_admin"
                    avatar_url: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    email: string
                    full_name: string
                    role?: "admin" | "ustadz" | "super_admin"
                    avatar_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    email?: string
                    full_name?: string
                    role?: "admin" | "ustadz" | "super_admin"
                    avatar_url?: string | null
                    updated_at?: string
                }
            }
            students: {
                Row: {
                    id: string
                    name: string
                    halaqah: string
                    status: "Mutqin" | "Mutawassith" | "Dhaif"
                    average_score: number
                    avatar_url: string | null
                    created_at: string
                    updated_at: string
                    wali_name: string | null
                    wali_phone: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    halaqah: string
                    status?: "Mutqin" | "Mutawassith" | "Dhaif"
                    average_score?: number
                    avatar_url?: string | null
                    created_at?: string
                    updated_at?: string
                    wali_name?: string | null
                    wali_phone?: string | null
                }
                Update: {
                    name?: string
                    halaqah?: string
                    status?: "Mutqin" | "Mutawassith" | "Dhaif"
                    average_score?: number
                    avatar_url?: string | null
                    updated_at?: string
                    wali_name?: string | null
                    wali_phone?: string | null
                }
            }
            curriculum_items: {
                Row: {
                    id: string
                    category: "Surah" | "Juz" | "Kitab"
                    name: string
                    target_ayat: number | null
                    surah_number: number | null
                    ayat_start: number | null
                    ayat_end: number | null
                    page: number | null
                    total_pages: number | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    category: "Surah" | "Juz" | "Kitab"
                    name: string
                    target_ayat?: number | null
                    surah_number?: number | null
                    ayat_start?: number | null
                    ayat_end?: number | null
                    page?: number | null
                    total_pages?: number | null
                    created_at?: string
                }
                Update: {
                    category?: "Surah" | "Juz" | "Kitab"
                    name?: string
                    target_ayat?: number | null
                    surah_number?: number | null
                    ayat_start?: number | null
                    ayat_end?: number | null
                    page?: number | null
                    total_pages?: number | null
                }
            }
            daily_scores: {
                Row: {
                    id: string
                    student_id: string
                    ustadz_id: string
                    curriculum_id: string | null
                    adab: number
                    disiplin: number
                    setoran: number
                    note: string | null
                    hafalan_type: "baru" | "murojaah" | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    student_id: string
                    ustadz_id: string
                    curriculum_id?: string | null
                    adab: number
                    disiplin: number
                    setoran: number
                    note?: string | null
                    hafalan_type?: "baru" | "murojaah" | null
                    created_at?: string
                }
                Update: {
                    adab?: number
                    disiplin?: number
                    setoran?: number
                    note?: string | null
                    hafalan_type?: "baru" | "murojaah" | null
                }
            }
            criteria_ref: {
                Row: {
                    id: number
                    aspect: "adab" | "discipline"
                    title: string
                    description: string | null
                    is_active: boolean
                    sort_order: number
                    created_at: string
                }
                Insert: {
                    id?: number
                    aspect: "adab" | "discipline"
                    title: string
                    description?: string | null
                    is_active?: boolean
                    sort_order?: number
                    created_at?: string
                }
                Update: {
                    aspect?: "adab" | "discipline"
                    title?: string
                    description?: string | null
                    is_active?: boolean
                    sort_order?: number
                }
            }
            sessions_ref: {
                Row: {
                    id: number
                    name: string
                    time_start: string | null
                    time_end: string | null
                    sort_order: number
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: number
                    name: string
                    time_start?: string | null
                    time_end?: string | null
                    sort_order?: number
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    name?: string
                    time_start?: string | null
                    time_end?: string | null
                    sort_order?: number
                    is_active?: boolean
                }
            }
            daily_assessments: {
                Row: {
                    id: string
                    date: string
                    student_id: string
                    session_id: number
                    criteria_id: number
                    is_compliant: boolean
                    notes: string | null
                    created_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    date: string
                    student_id: string
                    session_id: number
                    criteria_id: number
                    is_compliant?: boolean
                    notes?: string | null
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    is_compliant?: boolean
                    notes?: string | null
                    updated_at?: string
                }
            }
        }
    }
}
