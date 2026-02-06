"use client";

import { useState, useEffect, useRef } from "react";
import { Search, ClipboardList, Loader2, Check, X, Calendar, ChevronDown, BookOpen, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { CurriculumItem } from "@/types";

interface Student {
    id: string;
    name: string;
    halaqah: string;
    status: string;
    average_score: number;
    last_input_date: string | null;
}

const colors = {
    blue900: "#1a365d",
    blue600: "#3182ce",
    yellow400: "#f6e05e",
    surface: "#f8fafc",
    white: "#ffffff",
    gray400: "#cbd5e0",
    gray500: "#a0aec0",
    gray600: "#718096",
    gray800: "#2d3748",
};

const statusColors: Record<string, { bg: string; text: string }> = {
    Mutqin: { bg: "#c6f6d5", text: "#22543d" },
    Mutawassith: { bg: "#fefcbf", text: "#744210" },
    Dhaif: { bg: "#fed7d7", text: "#822727" },
};

export default function InputNilaiPage() {
    const { user, profile } = useAuth();
    const [students, setStudents] = useState<Student[]>([]);
    const [curriculumItems, setCurriculumItems] = useState<CurriculumItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [formData, setFormData] = useState({
        error1: "", // Di Beritahu
        error2: "", // Salah Harokat
        error3: "", // Salah/Lupa
        error4: "", // Berhenti
        note: "",
        curriculum_id: "", // Selected curriculum
        inputProgress: "", // New field for Ayat/Halaman
    });

    // Search state for curriculum
    const [materiQuery, setMateriQuery] = useState("");
    const [isMateriDropdownOpen, setIsMateriDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Hafalan type confirmation modal state
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<{
        score: number;
        finalNote: string;
    } | null>(null);

    async function fetchCurriculum() {
        const { data } = await supabase
            .from("curriculum_items")
            .select("*")
            .order("category")
            .order("surah_number", { ascending: true })
            .order("name", { ascending: true });

        if (data) setCurriculumItems(data);
    }

    async function fetchStudents() {
        setLoading(true);

        // First, get halaqah names that belong to this teacher
        if (!profile?.teacher_id) {
            setStudents([]);
            setLoading(false);
            return;
        }

        const { data: teacherHalaqah } = await supabase
            .from("halaqah")
            .select("name")
            .eq("teacher_id", profile.teacher_id)
            .eq("status", "active");

        const halaqahNames = teacherHalaqah?.map(h => h.name) || [];

        if (halaqahNames.length === 0) {
            setStudents([]);
            setLoading(false);
            return;
        }

        // Fetch students in teacher's halaqah
        const { data: studentsData, error } = await supabase
            .from("students")
            .select("*")
            .in("halaqah", halaqahNames)
            .order("name");

        if (error) {
            console.error("Error fetching students:", error);
            setLoading(false);
            return;
        }

        // Fetch last input date for each student
        const studentsWithLastInput: Student[] = await Promise.all(
            (studentsData || []).map(async (student) => {
                const { data: scoreData } = await supabase
                    .from("daily_scores")
                    .select("created_at")
                    .eq("student_id", student.id)
                    .order("created_at", { ascending: false })
                    .limit(1);

                return {
                    ...student,
                    last_input_date: scoreData?.[0]?.created_at || null,
                };
            })
        );

        setStudents(studentsWithLastInput);
        setLoading(false);
    }

    useEffect(() => {
        if (profile) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fetchStudents();
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fetchCurriculum();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    function formatDate(dateStr: string | null): string {
        if (!dateStr) return "Belum ada input";

        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return "Hari ini";
        } else if (diffDays === 1) {
            return "Kemarin";
        } else if (diffDays < 7) {
            return `${diffDays} hari lalu`;
        } else {
            return date.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
        }
    }

    const filteredStudents = students.filter((student) =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.halaqah.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleInputClick = (student: Student) => {
        setSelectedStudent(student);
        setFormData({
            error1: "",
            error2: "",
            error3: "",
            error4: "",
            note: "",
            curriculum_id: "",
            inputProgress: "",
        });
        setIsBottomSheetOpen(true);
    };

    const calculateScore = () => {
        const e1 = parseInt(formData.error1) || 0;
        const e2 = parseInt(formData.error2) || 0;
        const e3 = parseInt(formData.error3) || 0;
        const e4 = parseInt(formData.error4) || 0;
        const totalErrors = e1 + e2 + e3 + e4;
        const maxErrors = 20; // Default max errors as per requirement
        const score = Math.round((1 - totalErrors / maxErrors) * 100);
        return Math.max(0, Math.min(100, score));
    };

    const getGrade = (score: number) => {
        if (score >= 90) return "Qowiy";
        if (score >= 76) return "Mutawasit";
        return "Dhoif";
    };

    // Prepare data and show confirmation modal
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent || !user) return;

        if (!formData.curriculum_id) {
            setMessage("Gagal: Mohon pilih materi hafalan!");
            setTimeout(() => setMessage(""), 3000);
            return;
        }

        const score = calculateScore();
        const e1 = parseInt(formData.error1) || 0;
        const e2 = parseInt(formData.error2) || 0;
        const e3 = parseInt(formData.error3) || 0;
        const e4 = parseInt(formData.error4) || 0;

        // Construct note with error details
        const errorDetails = `Kesalahan: Di Beritahu (${e1}), Salah Harokat (${e2}), Salah/Lupa (${e3}), Berhenti (${e4})`;

        let progressNote = "";
        const selectedCurriculum = curriculumItems.find(c => c.id === formData.curriculum_id);

        if (selectedCurriculum && formData.inputProgress) {
            const isKitab = selectedCurriculum.category === "Kitab";
            const isMandzumah = (selectedCurriculum.category as string) === "Mandzumah";

            const typeLabel = isKitab ? "Halaman" : isMandzumah ? "Bait" : "Ayat";
            progressNote = `${typeLabel}: ${formData.inputProgress}`;

            let isComplete = false;
            const progress = Number(formData.inputProgress);

            if (isKitab) {
                const target = selectedCurriculum.total_pages || selectedCurriculum.target_ayat;
                if (target && progress >= target) isComplete = true;
            } else if (isMandzumah) {
                const target = selectedCurriculum.target_ayat;
                if (target && progress >= target) isComplete = true;
            } else {
                const target = selectedCurriculum.ayat_end;
                if (target && progress >= target) isComplete = true;
            }

            if (isComplete) {
                if (isKitab) progressNote += " (Selesai Kitab)";
                else if (isMandzumah) progressNote += " (Selesai Mandzumah)";
                else progressNote += " (Selesai Surah)";
            }
        }

        const combinedNote = [formData.note, progressNote, errorDetails].filter(Boolean).join("\n");

        // Store pending data and show confirmation modal
        setPendingSubmitData({
            score,
            finalNote: combinedNote,
        });
        setIsConfirmModalOpen(true);
    };

    // Save with selected hafalan type
    const handleConfirmSave = async (hafalanType: "baru" | "murojaah") => {
        if (!selectedStudent || !user || !pendingSubmitData) return;

        setSubmitting(true);
        setIsConfirmModalOpen(false);

        const { error } = await supabase.from("daily_scores").insert([
            {
                student_id: selectedStudent.id,
                ustadz_id: user.id,
                curriculum_id: formData.curriculum_id || null,
                setoran: pendingSubmitData.score,
                note: pendingSubmitData.finalNote,
                hafalan_type: hafalanType,
            },
        ]);

        if (error) {
            setMessage("Gagal menyimpan: " + error.message);
        } else {
            setMessage(`Nilai setoran (${hafalanType === "baru" ? "Hafalan Baru" : "Murojaah"}) berhasil disimpan!`);
            setIsBottomSheetOpen(false);
            setPendingSubmitData(null);
            fetchStudents();
            setTimeout(() => setMessage(""), 3000);
        }
        setSubmitting(false);
    };

    const currentScore = calculateScore();
    const currentGrade = getGrade(currentScore);

    // Group curriculum items by category
    // Filter curriculum items based on search query
    const filteredCurriculum = curriculumItems.filter(item =>
        !materiQuery ||
        item.name.toLowerCase().includes(materiQuery.toLowerCase()) ||
        (item.surah_number && item.surah_number.toString().includes(materiQuery))
    );

    // Group curriculum items by category
    const groupedCurriculum = filteredCurriculum.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, CurriculumItem[]>);

    const flatSelectableItems = Object.entries(groupedCurriculum).flatMap(([_, items]) => items);

    useEffect(() => {
        if (isMateriDropdownOpen && itemRefs.current[highlightedIndex]) {
            itemRefs.current[highlightedIndex]?.scrollIntoView({
                block: "nearest",
            });
        }
    }, [highlightedIndex, isMateriDropdownOpen]);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [materiQuery, isMateriDropdownOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isMateriDropdownOpen) {
            if (e.key === "ArrowDown" || e.key === "Enter") {
                setIsMateriDropdownOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setHighlightedIndex(prev => Math.min(prev + 1, flatSelectableItems.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setHighlightedIndex(prev => Math.max(prev - 1, 0));
                break;
            case "Enter":
                e.preventDefault();
                if (flatSelectableItems[highlightedIndex]) {
                    setFormData({ ...formData, curriculum_id: flatSelectableItems[highlightedIndex].id });
                    setIsMateriDropdownOpen(false);
                    setMateriQuery("");
                }
                break;
            case "Escape":
                e.preventDefault();
                setIsMateriDropdownOpen(false);
                break;
        }
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: colors.surface }}>
            {/* Header */}
            <div className="p-6 pb-0">
                <h1 style={{ color: colors.blue900, fontSize: "1.5rem", fontWeight: 700 }}>
                    Input Nilai
                </h1>
                <p style={{ color: colors.gray600, marginTop: "0.25rem" }}>
                    Pilih santri untuk input nilai harian
                </p>
            </div>

            {/* Search */}
            <div className="p-6 pt-4">
                <div className="relative">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                        style={{ color: colors.gray500 }}
                    />
                    <input
                        type="text"
                        placeholder="Cari santri..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: "100%",
                            paddingLeft: "2.75rem",
                            paddingRight: "1rem",
                            paddingTop: "0.75rem",
                            paddingBottom: "0.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.5rem",
                            color: colors.gray800,
                            backgroundColor: colors.white,
                        }}
                    />
                </div>
            </div>

            {/* Success Message */}
            {message && (
                <div className="px-6 pb-4">
                    <div
                        className="p-3 rounded-lg flex items-center gap-2"
                        style={{
                            backgroundColor: message.includes("Gagal") ? "#fed7d7" : "#c6f6d5",
                            color: message.includes("Gagal") ? "#822727" : "#22543d",
                        }}
                    >
                        {message.includes("Gagal") ? (
                            <X className="w-5 h-5" />
                        ) : (
                            <Check className="w-5 h-5" />
                        )}
                        {message}
                    </div>
                </div>
            )}

            {/* Student List */}
            <div className="px-6 pb-24 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.blue600 }} />
                        <span className="ml-3" style={{ color: colors.gray600 }}>
                            Memuat data santri...
                        </span>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-12" style={{ color: colors.gray500 }}>
                        {searchQuery ? "Santri tidak ditemukan" : "Belum ada data santri"}
                    </div>
                ) : (
                    filteredStudents.map((student) => (
                        <div
                            key={student.id}
                            className="card p-4 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: "#ebf4ff", color: colors.blue600 }}
                                >
                                    <span className="font-semibold">
                                        {student.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p style={{ fontWeight: 600, color: colors.gray800 }}>
                                        {student.name}
                                    </p>
                                    <p style={{ fontSize: "0.875rem", color: colors.gray500 }}>
                                        {student.halaqah}
                                    </p>
                                    <div className="flex items-center gap-1 mt-1" style={{ fontSize: "0.75rem", color: student.last_input_date ? colors.gray500 : "#d69e2e" }}>
                                        <Calendar className="w-3 h-3" />
                                        <span>Input terakhir: {formatDate(student.last_input_date)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span
                                    className="px-2 py-1 rounded-full text-xs font-medium"
                                    style={{
                                        backgroundColor: statusColors[student.status]?.bg || "#e2e8f0",
                                        color: statusColors[student.status]?.text || colors.gray600,
                                    }}
                                >
                                    {student.status}
                                </span>
                                <button
                                    onClick={() => handleInputClick(student)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    style={{
                                        backgroundColor: colors.yellow400,
                                        color: colors.blue900,
                                    }}
                                >
                                    Input
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Bottom Sheet Overlay */}
            {isBottomSheetOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20"
                    onClick={() => setIsBottomSheetOpen(false)}
                />
            )}

            {/* Bottom Sheet */}
            <div
                className={`fixed bottom-0 left-0 right-0 lg:left-64 rounded-t-3xl z-30 transition-transform duration-300 ${isBottomSheetOpen ? "translate-y-0" : "translate-y-full"
                    }`}
                style={{
                    backgroundColor: colors.white,
                    maxHeight: "90vh",
                    overflowY: "auto"
                }}
            >
                <div className="p-6">
                    {/* Handle */}
                    <div
                        className="w-12 h-1.5 rounded-full mx-auto mb-4"
                        style={{ backgroundColor: colors.gray400 }}
                    />

                    {selectedStudent && (
                        <>
                            <h2 style={{ color: colors.blue900, fontSize: "1.25rem", fontWeight: 700 }}>
                                Input Nilai - {selectedStudent.name}
                            </h2>
                            <p style={{ color: colors.gray500, fontSize: "0.875rem", marginBottom: "1rem" }}>
                                {selectedStudent.halaqah}
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Curriculum Selector */}
                                <div>
                                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: colors.blue900, marginBottom: "0.5rem" }}>
                                        Materi / Surah
                                    </label>
                                    {/* Custom Searchable Dropdown */}
                                    <div className="relative">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={isMateriDropdownOpen ? materiQuery : (
                                                    (() => {
                                                        const item = curriculumItems.find(c => c.id === formData.curriculum_id);
                                                        return item ? `${item.surah_number ? item.surah_number + '. ' : ''}${item.name}` : ""
                                                    })()
                                                )}
                                                onChange={(e) => {
                                                    setMateriQuery(e.target.value);
                                                    if (!isMateriDropdownOpen) setIsMateriDropdownOpen(true);
                                                }}
                                                onFocus={() => {
                                                    if (!isMateriDropdownOpen) {
                                                        setIsMateriDropdownOpen(true);
                                                        setMateriQuery(""); // Clear query on focus to start fresh search
                                                    }
                                                }}
                                                onClick={() => {
                                                    if (!isMateriDropdownOpen) {
                                                        setIsMateriDropdownOpen(true);
                                                        setMateriQuery("");
                                                    }
                                                }}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Pilih materi hafalan..."
                                                className={`w-full pl-4 pr-10 py-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isMateriDropdownOpen ? "border-blue-600 ring-1 ring-blue-600" : "border-gray-200"
                                                    }`}
                                                style={{
                                                    backgroundColor: colors.white,
                                                    color: colors.gray800
                                                }}
                                            />
                                            <ChevronDown
                                                className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${isMateriDropdownOpen ? "rotate-180" : ""}`}
                                            />
                                        </div>

                                        {isMateriDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                                                <div className="overflow-y-auto flex-1">
                                                    {Object.keys(groupedCurriculum).length === 0 ? (
                                                        <div className="p-4 text-center text-sm text-gray-500">
                                                            Tidak ditemukan
                                                        </div>
                                                    ) : (
                                                        (() => {
                                                            let globalIndex = 0;
                                                            return Object.entries(groupedCurriculum).map(([category, items]) => (
                                                                <div key={category}>
                                                                    <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
                                                                        {category}
                                                                    </div>
                                                                    {items.map((item) => {
                                                                        const currentIndex = globalIndex++;
                                                                        const isHighlighted = currentIndex === highlightedIndex;
                                                                        const isSelected = formData.curriculum_id === item.id;

                                                                        return (
                                                                            <div
                                                                                key={item.id}
                                                                                ref={el => { itemRefs.current[currentIndex] = el; }}
                                                                                onClick={() => {
                                                                                    setFormData({ ...formData, curriculum_id: item.id });
                                                                                    setIsMateriDropdownOpen(false);
                                                                                    setMateriQuery("");
                                                                                }}
                                                                                className={`px-4 py-2 text-sm cursor-pointer flex items-center justify-between ${isHighlighted ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                                                                                style={{
                                                                                    backgroundColor: isSelected || isHighlighted ? "#ebf8ff" : "transparent",
                                                                                    color: isSelected || isHighlighted ? colors.blue600 : colors.gray800
                                                                                }}
                                                                            >
                                                                                <span>
                                                                                    {item.surah_number ? `${item.surah_number}. ` : ""}{item.name}
                                                                                </span>
                                                                                {isSelected && <Check className="w-4 h-4" />}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ));
                                                        })()
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Input (Ayat/Halaman) */}
                                {formData.curriculum_id && (
                                    <div>
                                        {(() => {
                                            const selectedItem = curriculumItems.find(c => c.id === formData.curriculum_id);
                                            const isKitab = selectedItem?.category === "Kitab";
                                            const isMandzumah = (selectedItem?.category as string) === "Mandzumah";
                                            const label = isKitab ? "Halaman Terakhir" : isMandzumah ? "Bait Terakhir" : "Ayat Terakhir";
                                            const placeholder = isKitab ? "Contoh: 15" : isMandzumah ? "Contoh: 109" : "Contoh: 7";
                                            const target = selectedItem?.target_ayat;

                                            return (
                                                <>
                                                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: colors.blue900, marginBottom: "0.5rem" }}>
                                                        {label}
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={formData.inputProgress}
                                                            onChange={(e) => setFormData({ ...formData, inputProgress: e.target.value })}
                                                            placeholder={placeholder}
                                                            style={{
                                                                flex: 1,
                                                                padding: "0.75rem 1rem",
                                                                border: "1px solid #e2e8f0",
                                                                borderRadius: "0.5rem",
                                                                color: colors.gray800,
                                                            }}
                                                        />
                                                        {target && (
                                                            <div className="px-3 py-2 bg-gray-100 rounded-lg text-xs text-gray-600 border border-gray-200 whitespace-nowrap">
                                                                Target: {target}
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Score Display */}
                                <div className="p-4 rounded-xl text-center" style={{ backgroundColor: "#ebf4ff" }}>
                                    <p style={{ fontSize: "0.875rem", color: colors.blue600, marginBottom: "0.25rem" }}>
                                        Nilai Setoran
                                    </p>
                                    <p style={{ fontSize: "2.5rem", fontWeight: 800, color: colors.blue900, lineHeight: 1 }}>
                                        {currentScore}
                                    </p>
                                    <span
                                        className="inline-block px-3 py-1 rounded-full text-sm font-medium mt-2"
                                        style={{
                                            backgroundColor: currentScore >= 90 ? "#c6f6d5" : currentScore >= 76 ? "#fefcbf" : "#fed7d7",
                                            color: currentScore >= 90 ? "#22543d" : currentScore >= 76 ? "#744210" : "#822727"
                                        }}
                                    >
                                        {currentGrade}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: colors.gray600, marginBottom: "0.5rem" }}>
                                            Di Beritahu
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.error1}
                                            onChange={(e) => setFormData({ ...formData, error1: e.target.value })}
                                            placeholder="0"
                                            className="w-full text-center font-bold text-lg p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: colors.gray600, marginBottom: "0.5rem" }}>
                                            Salah Harokat
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.error2}
                                            onChange={(e) => setFormData({ ...formData, error2: e.target.value })}
                                            placeholder="0"
                                            className="w-full text-center font-bold text-lg p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: colors.gray600, marginBottom: "0.5rem" }}>
                                            Salah/Lupa
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.error3}
                                            onChange={(e) => setFormData({ ...formData, error3: e.target.value })}
                                            placeholder="0"
                                            className="w-full text-center font-bold text-lg p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: colors.gray600, marginBottom: "0.5rem" }}>
                                            Berhenti
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.error4}
                                            onChange={(e) => setFormData({ ...formData, error4: e.target.value })}
                                            placeholder="0"
                                            className="w-full text-center font-bold text-lg p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: colors.blue900, marginBottom: "0.5rem" }}>
                                        Catatan (Opsional)
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={formData.note}
                                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                        placeholder="Catatan tambahan..."
                                        style={{
                                            width: "100%",
                                            padding: "0.75rem 1rem",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "0.5rem",
                                            color: colors.gray800,
                                            resize: "none",
                                        }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <ClipboardList className="w-5 h-5" />
                                            Simpan Nilai
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            {/* Hafalan Type Confirmation Modal */}
            {isConfirmModalOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setIsConfirmModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: colors.blue900, marginBottom: "0.5rem", textAlign: "center" }}>
                            Jenis Hafalan
                        </h3>
                        <p style={{ fontSize: "0.875rem", color: colors.gray600, marginBottom: "1.5rem", textAlign: "center" }}>
                            Apakah ini hafalan baru atau murojaah (mengulang)?
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleConfirmSave("baru")}
                                disabled={submitting}
                                className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all hover:scale-[1.02]"
                                style={{
                                    backgroundColor: colors.blue600,
                                    color: colors.white,
                                }}
                            >
                                <BookOpen className="w-6 h-6" />
                                <span>Hafalan Baru</span>
                            </button>
                            <button
                                onClick={() => handleConfirmSave("murojaah")}
                                disabled={submitting}
                                className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all hover:scale-[1.02]"
                                style={{
                                    backgroundColor: colors.yellow400,
                                    color: colors.blue900,
                                }}
                            >
                                <RefreshCw className="w-6 h-6" />
                                <span>Murojaah</span>
                            </button>
                        </div>

                        <button
                            onClick={() => setIsConfirmModalOpen(false)}
                            className="w-full mt-4 py-2 text-sm font-medium transition-colors"
                            style={{ color: colors.gray500 }}
                        >
                            Batal
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
}
