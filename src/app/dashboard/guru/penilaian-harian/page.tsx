"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import {
    Calendar,
    Save,
    Loader2,
    CheckCircle,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Users,
    Check,
    X,
} from "lucide-react";

interface Student {
    id: string;
    name: string;
    halaqah: string;
}

interface Criteria {
    id: number;
    aspect: "adab" | "discipline";
    title: string;
    description: string | null;
}

interface Session {
    id: number;
    name: string;
    time_start: string | null;
    time_end: string | null;
}

interface AssessmentMap {
    [key: string]: boolean; // key format: `${studentId}-${criteriaId}`
}

export default function PenilaianHarianPage() {
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [criteria, setCriteria] = useState<Criteria[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split("T")[0];
    });
    const [selectedSession, setSelectedSession] = useState<number | null>(null);
    const [assessments, setAssessments] = useState<AssessmentMap>({});
    const [existingData, setExistingData] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Absence reason modal state
    const [showAbsenceModal, setShowAbsenceModal] = useState(false);
    const [pendingAbsence, setPendingAbsence] = useState<{ studentId: string; criteriaId: number } | null>(null);
    const [absenceReasons, setAbsenceReasons] = useState<{ [studentId: string]: string }>({});

    // Fetch initial data
    useEffect(() => {
        if (profile) {
            fetchInitialData();
        }
    }, [profile]);

    // Fetch assessments when date or session changes
    useEffect(() => {
        if (selectedSession && students.length > 0 && criteria.length > 0) {
            fetchExistingAssessments();
        }
    }, [selectedDate, selectedSession, students.length, criteria.length]);

    async function fetchInitialData() {
        setLoading(true);
        try {
            // First, get halaqah names that belong to this teacher
            let halaqahNames: string[] = [];

            if (profile?.teacher_id) {
                const { data: teacherHalaqah } = await supabase
                    .from("halaqah")
                    .select("name")
                    .eq("teacher_id", profile.teacher_id)
                    .eq("status", "active");

                halaqahNames = teacherHalaqah?.map(h => h.name) || [];
            }

            // Fetch students in teacher's halaqah
            let studentsData: Student[] = [];
            if (halaqahNames.length > 0) {
                const { data } = await supabase
                    .from("students")
                    .select("id, name, halaqah")
                    .in("halaqah", halaqahNames)
                    .order("name");
                studentsData = data || [];
            }

            // Fetch active criteria
            const { data: criteriaData } = await supabase
                .from("criteria_ref")
                .select("*")
                .eq("is_active", true)
                .order("aspect")
                .order("sort_order");

            // Fetch active sessions
            const { data: sessionsData } = await supabase
                .from("sessions_ref")
                .select("*")
                .eq("is_active", true)
                .order("sort_order");

            setStudents(studentsData);
            setCriteria(criteriaData || []);
            setSessions(sessionsData || []);

            // Auto-select first session
            if (sessionsData && sessionsData.length > 0) {
                setSelectedSession(sessionsData[0].id);
            }
        } catch (err) {
            console.error("Error fetching data:", err);
            setError("Gagal memuat data");
        }
        setLoading(false);
    }

    const fetchExistingAssessments = useCallback(async () => {
        if (!selectedSession) return;

        const { data } = await supabase
            .from("daily_assessments")
            .select("student_id, criteria_id, is_compliant, absence_reason")
            .eq("date", selectedDate)
            .eq("session_id", selectedSession);

        if (data && data.length > 0) {
            setExistingData(true);
            const map: AssessmentMap = {};
            data.forEach((item) => {
                map[`${item.student_id}-${item.criteria_id}`] = item.is_compliant;
            });
            setAssessments(map);

            // Load absence reasons from existing data
            const reasonsMap: { [studentId: string]: string } = {};
            data.forEach((item: any) => {
                if (item.absence_reason) {
                    reasonsMap[item.student_id] = item.absence_reason;
                }
            });
            setAbsenceReasons(reasonsMap);
        } else {
            setExistingData(false);
            // Initialize all as compliant (checked)
            const map: AssessmentMap = {};
            students.forEach((student) => {
                criteria.forEach((crit) => {
                    map[`${student.id}-${crit.id}`] = true;
                });
            });
            setAssessments(map);
            setAbsenceReasons({}); // Clear previous absence reasons
        }
    }, [selectedSession, selectedDate, students, criteria]);

    function toggleAssessment(studentId: string, criteriaId: number) {
        const key = `${studentId}-${criteriaId}`;
        const currentValue = assessments[key] ?? true;

        // Check if this is the attendance criteria being unchecked
        const attendanceCriteria = criteria.find(
            (c) => c.aspect === "discipline" && c.title.toLowerCase().includes("kehadiran")
        );

        if (attendanceCriteria && criteriaId === attendanceCriteria.id && currentValue) {
            // User is marking student as absent - show modal
            setPendingAbsence({ studentId, criteriaId });
            setShowAbsenceModal(true);
            return;
        }

        // If checking attendance back (marking present), clear absence reason
        if (attendanceCriteria && criteriaId === attendanceCriteria.id && !currentValue) {
            setAbsenceReasons(prev => {
                const updated = { ...prev };
                delete updated[studentId];
                return updated;
            });
        }

        setAssessments((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    }

    function handleAbsenceReasonSelect(reason: string) {
        if (!pendingAbsence) return;

        // Store the absence reason
        setAbsenceReasons(prev => ({
            ...prev,
            [pendingAbsence.studentId]: reason,
        }));

        // Now toggle the assessment to mark as absent
        setAssessments((prev) => ({
            ...prev,
            [`${pendingAbsence.studentId}-${pendingAbsence.criteriaId}`]: false,
        }));

        // Close modal and clear pending
        setShowAbsenceModal(false);
        setPendingAbsence(null);
    }

    function cancelAbsenceModal() {
        setShowAbsenceModal(false);
        setPendingAbsence(null);
    }

    function isStudentAbsent(studentId: string): boolean {
        // Find the attendance criteria (Kehadiran)
        const attendanceCriteria = criteria.find(
            (c) => c.aspect === "discipline" && c.title.toLowerCase().includes("kehadiran")
        );
        if (!attendanceCriteria) return false;
        return !assessments[`${studentId}-${attendanceCriteria.id}`];
    }

    function toggleAllForStudent(studentId: string, checked: boolean) {
        setAssessments((prev) => {
            const updated = { ...prev };
            criteria.forEach((crit) => {
                updated[`${studentId}-${crit.id}`] = checked;
            });
            return updated;
        });
    }

    function toggleAllForCriteria(criteriaId: number, checked: boolean) {
        setAssessments((prev) => {
            const updated = { ...prev };
            students.forEach((student) => {
                updated[`${student.id}-${criteriaId}`] = checked;
            });
            return updated;
        });
    }

    async function handleSave() {
        if (!selectedSession || !user) return;

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            // Prepare data for upsert
            const records = students.flatMap((student) =>
                criteria.map((crit) => {
                    const isAttendance = crit.aspect === "discipline" && crit.title.toLowerCase().includes("kehadiran");
                    const isCompliant = assessments[`${student.id}-${crit.id}`] ?? true;

                    return {
                        date: selectedDate,
                        student_id: student.id,
                        session_id: selectedSession,
                        criteria_id: crit.id,
                        is_compliant: isCompliant,
                        created_by: user.id,
                        // Only include absence_reason for attendance criteria when absent
                        absence_reason: (isAttendance && !isCompliant) ? (absenceReasons[student.id] || 'tanpa_keterangan') : null,
                    };
                })
            );

            // Use upsert with conflict handling
            const { error: upsertError } = await supabase
                .from("daily_assessments")
                .upsert(records, {
                    onConflict: "date,student_id,session_id,criteria_id",
                });

            if (upsertError) {
                throw upsertError;
            }

            setSuccess("Data penilaian berhasil disimpan!");
            setExistingData(true);
        } catch (err: any) {
            console.error("Error saving assessment:", {
                message: err.message,
                details: err.details,
                hint: err.hint,
                code: err.code,
                fullError: err
            });
            setError(`Gagal menyimpan data: ${err.message || "Unknown error"}`);
        }

        setSaving(false);
        setTimeout(() => setSuccess(""), 3000);
    }

    function changeDate(days: number) {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (date <= today) {
            setSelectedDate(date.toISOString().split("T")[0]);
        }
    }

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    }

    const disciplineCriteria = criteria.filter((c) => c.aspect === "discipline");
    const adabCriteria = criteria.filter((c) => c.aspect === "adab");

    // Calculate stats
    // Helper to calculate student compliance for a specific aspect
    const getStudentCompliance = (studentId: string, aspect: "adab" | "discipline") => {
        const targetCriteria = aspect === "adab" ? adabCriteria : disciplineCriteria;
        if (targetCriteria.length === 0) return 0;

        const compliantCount = targetCriteria.filter(c => assessments[`${studentId}-${c.id}`] ?? true).length;
        return Math.round((compliantCount / targetCriteria.length) * 100);
    };

    // Calculate global stats
    const calculateGlobalRate = (aspect: "adab" | "discipline") => {
        const targetCriteria = aspect === "adab" ? adabCriteria : disciplineCriteria;
        if (targetCriteria.length === 0 || students.length === 0) return 0;

        let totalCompliant = 0;
        students.forEach(s => {
            totalCompliant += targetCriteria.filter(c => assessments[`${s.id}-${c.id}`] ?? true).length;
        });

        const totalChecks = students.length * targetCriteria.length;
        return Math.round((totalCompliant / totalChecks) * 100);
    };

    const adabRate = calculateGlobalRate("adab");
    const disciplineRate = calculateGlobalRate("discipline");

    // Total compliance (all criteria)
    const totalChecks = students.length * criteria.length;
    let totalCompliantAll = 0;
    students.forEach(s => {
        totalCompliantAll += criteria.filter(c => assessments[`${s.id}-${c.id}`] ?? true).length;
    });
    const complianceRate = totalChecks > 0 ? Math.round((totalCompliantAll / totalChecks) * 100) : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-blue-600" size={48} />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 max-w-full mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Penilaian Harian</h1>
                <p className="text-gray-600 mt-1">
                    Input penilaian Adab dan Disiplin santri per sesi
                </p>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                    <CheckCircle size={20} />
                    {success}
                </div>
            )}

            {/* Date & Session Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Date Picker */}
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar size={16} className="inline mr-1" />
                            Tanggal Penilaian
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => changeDate(-1)}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                max={new Date().toISOString().split("T")[0]}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={() => changeDate(1)}
                                disabled={selectedDate === new Date().toISOString().split("T")[0]}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{formatDate(selectedDate)}</p>
                    </div>

                    {/* Session Selector */}
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Pilih Sesi
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {sessions.map((session) => (
                                <button
                                    key={session.id}
                                    onClick={() => setSelectedSession(session.id)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedSession === session.id
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    {session.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Save Button */}
                    {students.length > 0 && criteria.length > 0 && (
                        <div className="flex items-end">
                            <button
                                onClick={handleSave}
                                disabled={saving || !selectedSession}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 shadow-lg"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Simpan
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Status */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-gray-600">
                            <Users size={16} />
                            {students.length} santri
                        </span>
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${existingData
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                                }`}
                        >
                            {existingData ? "Mode Edit" : "Input Baru"}
                        </span>
                    </div>
                    <div className="flex gap-4 text-sm font-medium">
                        <div className="text-gray-600">
                            Disiplin: <strong className={disciplineRate >= 80 ? "text-green-600" : disciplineRate >= 60 ? "text-yellow-600" : "text-red-600"}>{disciplineRate}%</strong>
                        </div>
                        <div className="text-gray-600">
                            Adab: <strong className={adabRate >= 80 ? "text-green-600" : adabRate >= 60 ? "text-yellow-600" : "text-red-600"}>{adabRate}%</strong>
                        </div>
                        <div className="text-gray-600">
                            Total: <strong className={complianceRate >= 80 ? "text-green-600" : complianceRate >= 60 ? "text-yellow-600" : "text-red-600"}>{complianceRate}%</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                    <strong>Tips:</strong> Semua checkbox tercentang secara default (patuh). Hilangkan centang pada santri yang melanggar atau tidak hadir.
                    Jika &quot;Kehadiran&quot; tidak dicentang, kriteria lain akan otomatis disabled.
                </p>
            </div>

            {/* Assessment Matrix */}
            {students.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <Users size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Belum ada data santri</p>
                </div>
            ) : criteria.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <p className="text-lg">Belum ada kriteria penilaian aktif</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700 min-w-[200px]">
                                        Santri
                                    </th>
                                    {/* Discipline Criteria */}
                                    <th
                                        colSpan={disciplineCriteria.length}
                                        className="px-2 py-2 text-center font-semibold text-blue-700 bg-blue-50 border-x border-gray-200"
                                    >
                                        Disiplin
                                    </th>
                                    {/* Adab Criteria */}
                                    <th
                                        colSpan={adabCriteria.length}
                                        className="px-2 py-2 text-center font-semibold text-green-700 bg-green-50"
                                    >
                                        Adab
                                    </th>
                                </tr>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2"></th>
                                    {/* Discipline Headers */}
                                    {disciplineCriteria.map((crit) => {
                                        const allChecked = students.every((s) => assessments[`${s.id}-${crit.id}`] ?? true);
                                        return (
                                            <th
                                                key={crit.id}
                                                className="px-1 py-2 text-center bg-blue-50 border-x border-gray-100 min-w-[60px] max-w-[80px]"
                                            >
                                                <div
                                                    className="text-[10px] font-medium text-gray-700 cursor-help leading-tight"
                                                    title={crit.description || crit.title}
                                                >
                                                    {crit.title.length > 8
                                                        ? crit.title.substring(0, 8) + "…"
                                                        : crit.title}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={allChecked}
                                                    onChange={() => toggleAllForCriteria(crit.id, !allChecked)}
                                                    className="mt-1 w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    title="Toggle semua"
                                                />
                                            </th>
                                        );
                                    })}
                                    {/* Adab Headers */}
                                    {adabCriteria.map((crit) => {
                                        const allChecked = students.every((s) => assessments[`${s.id}-${crit.id}`] ?? true);
                                        return (
                                            <th
                                                key={crit.id}
                                                className="px-1 py-2 text-center bg-green-50 min-w-[60px] max-w-[80px]"
                                            >
                                                <div
                                                    className="text-[10px] font-medium text-gray-700 cursor-help leading-tight"
                                                    title={crit.description || crit.title}
                                                >
                                                    {crit.title.length > 8
                                                        ? crit.title.substring(0, 8) + "…"
                                                        : crit.title}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={allChecked}
                                                    onChange={() => toggleAllForCriteria(crit.id, !allChecked)}
                                                    className="mt-1 w-3.5 h-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                                    title="Toggle semua"
                                                />
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student, idx) => {
                                    const absent = isStudentAbsent(student.id);

                                    return (
                                        <tr
                                            key={student.id}
                                            className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                                                } ${absent ? "opacity-50" : ""}`}
                                        >
                                            <td className="sticky left-0 z-10 px-4 py-3 bg-inherit border-r border-gray-100">
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <div className="font-medium text-gray-800">
                                                            {student.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {student.halaqah}
                                                        </div>
                                                    </div>
                                                    {absent && (
                                                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                                                            Tidak Hadir {absenceReasons[student.id] && (
                                                                <span className="font-normal">({absenceReasons[student.id] === 'sakit' ? 'Sakit' : absenceReasons[student.id] === 'izin' ? 'Izin' : 'Tanpa Ket.'})</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Discipline Checkboxes */}
                                            {disciplineCriteria.map((crit) => {
                                                const key = `${student.id}-${crit.id}`;
                                                const isAttendance = crit.title.toLowerCase().includes("kehadiran");
                                                const disabled = absent && !isAttendance;
                                                const checked = assessments[key] ?? true;

                                                return (
                                                    <td
                                                        key={crit.id}
                                                        className="px-2 py-2 text-center border-x border-gray-100"
                                                    >
                                                        <button
                                                            onClick={() => !disabled && toggleAssessment(student.id, crit.id)}
                                                            disabled={disabled}
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all mx-auto ${disabled
                                                                ? "bg-gray-100 cursor-not-allowed"
                                                                : checked
                                                                    ? "bg-green-500 text-white hover:bg-green-600"
                                                                    : "bg-red-100 text-red-600 hover:bg-red-200 border border-red-300"
                                                                }`}
                                                        >
                                                            {checked ? <Check size={16} /> : <X size={16} />}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                            {/* Adab Checkboxes */}
                                            {adabCriteria.map((crit) => {
                                                const key = `${student.id}-${crit.id}`;
                                                const disabled = absent;
                                                const checked = assessments[key] ?? true;

                                                return (
                                                    <td key={crit.id} className="px-2 py-2 text-center">
                                                        <button
                                                            onClick={() => !disabled && toggleAssessment(student.id, crit.id)}
                                                            disabled={disabled}
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all mx-auto ${disabled
                                                                ? "bg-gray-100 cursor-not-allowed"
                                                                : checked
                                                                    ? "bg-green-500 text-white hover:bg-green-600"
                                                                    : "bg-red-100 text-red-600 hover:bg-red-200 border border-red-300"
                                                                }`}
                                                        >
                                                            {checked ? <Check size={16} /> : <X size={16} />}
                                                        </button>
                                                    </td>
                                                );
                                            })}


                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div >
            )
            }



            {/* Absence Reason Modal */}
            {showAbsenceModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
                        <div className="p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-800">
                                Alasan Tidak Hadir
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Pilih alasan ketidakhadiran santri
                            </p>
                        </div>
                        <div className="p-4 space-y-3">
                            <button
                                onClick={() => handleAbsenceReasonSelect('sakit')}
                                className="w-full p-4 text-left rounded-lg border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all flex items-center gap-3"
                            >
                                <span className="text-2xl">🤒</span>
                                <div>
                                    <div className="font-medium text-gray-800">Sakit</div>
                                    <div className="text-sm text-gray-500">Tidak hadir karena sakit</div>
                                </div>
                            </button>
                            <button
                                onClick={() => handleAbsenceReasonSelect('izin')}
                                className="w-full p-4 text-left rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center gap-3"
                            >
                                <span className="text-2xl">📝</span>
                                <div>
                                    <div className="font-medium text-gray-800">Izin</div>
                                    <div className="text-sm text-gray-500">Ada keperluan/izin resmi</div>
                                </div>
                            </button>
                            <button
                                onClick={() => handleAbsenceReasonSelect('tanpa_keterangan')}
                                className="w-full p-4 text-left rounded-lg border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all flex items-center gap-3"
                            >
                                <span className="text-2xl">❓</span>
                                <div>
                                    <div className="font-medium text-gray-800">Tanpa Keterangan</div>
                                    <div className="text-sm text-gray-500">Tidak hadir tanpa alasan</div>
                                </div>
                            </button>
                        </div>
                        <div className="p-4 border-t">
                            <button
                                onClick={cancelAbsenceModal}
                                className="w-full py-2 text-gray-600 hover:text-gray-800 font-medium"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
