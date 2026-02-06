import { Database } from "./supabase";

export type Student = Database["public"]["Tables"]["students"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type DailyScore = Database["public"]["Tables"]["daily_scores"]["Row"];
export type CurriculumItem = Database["public"]["Tables"]["curriculum_items"]["Row"] & {
    page_start?: number | null;
    page_end?: number | null;
    surah_number?: number | null;
    ayat_start?: number | null;
    ayat_end?: number | null;
    total_pages?: number | null;
};

export type StudentStatus = "Mutqin" | "Mutawassith" | "Dhaif";

export interface ScoreInput {
    student_id: string;
    curriculum_id?: string;
    adab: number;
    disiplin: number;
    setoran: number;
    note?: string;
}
