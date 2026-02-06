"use client";

import { useState, useEffect } from "react";
import { FileText, Calendar, MessageCircle, Loader2, X, Send, Edit3 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

interface CurriculumDetail {
    id: string;
    name: string;
    category: string;
    pageInfo: string; // e.g., "hlm 1-5" or "ayat 1-7"
    lastProgress: string; // e.g., "15" (last ayat/halaman/bait reached)
    isComplete: boolean; // Whether this material is completed
}

interface ScoreDetail {
    id: string;
    date: string;
    curriculumName: string;
    curriculumCategory: string;
    score: number;
    hafalanType: string | null;
    progress: string; // e.g., "Ayat: 15" or "Halaman: 5"
    errorBreakdown: string; // e.g., "Di Beritahu (2), Salah Harokat (1)"
}

interface ReportItem {
    studentId: string;
    studentName: string;
    waliPhone: string;
    totalSetoran: number;
    avgSetoran: number;
    curriculumDetails: CurriculumDetail[];
    scoreDetails: ScoreDetail[];  // New: detailed scores
    avgAdab: number;
    avgDisiplin: number;
    hafalanBaruCount: number;
    murojaahCount: number;
    totalErrors: { diberitahu: number; salahHarokat: number; salahLupa: number; berhenti: number };
}

type DateRangeType = '7' | '30' | 'custom';

export default function GuruLaporanPage() {
    const { profile } = useAuth();
    const [dateRangeType, setDateRangeType] = useState<DateRangeType>('7');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [dateInfo, setDateInfo] = useState({ startDate: '', endDate: '', totalDays: 0 });
    const [reportData, setReportData] = useState<ReportItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<ReportItem | null>(null);
    const [previewMessage, setPreviewMessage] = useState<string>('');
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Helper function to get date range
    function getDateRange(type: DateRangeType, customStart?: string, customEnd?: string): {
        startDate: string;
        endDate: string;
        totalDays: number;
    } {
        let startDate: Date;
        let endDate: Date;

        if (type === 'custom') {
            if (!customStart || !customEnd) {
                throw new Error('Tanggal custom harus diisi lengkap');
            }

            startDate = new Date(customStart);
            endDate = new Date(customEnd);

            if (startDate > endDate) {
                throw new Error('Tanggal mulai harus lebih kecil atau sama dengan tanggal akhir');
            }
        } else {
            const days = type === '7' ? 7 : 30;
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(endDate.getDate() - (days - 1));
        }

        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            totalDays
        };
    }

    // Format date for display (DD MMM YYYY)
    function formatDateDisplay(dateStr: string): string {
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    // Fetch report data
    async function fetchReportData() {
        setLoading(true);
        try {
            const range = getDateRange(dateRangeType, customStartDate, customEndDate);
            setDateInfo(range);

            // Get teacher's halaqah
            if (!profile?.teacher_id) {
                setReportData([]);
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
                setReportData([]);
                setLoading(false);
                return;
            }

            // Get students in teacher's halaqah
            const { data: myStudents } = await supabase
                .from("students")
                .select("id, name, wali_phone")
                .in("halaqah", halaqahNames);

            if (!myStudents || myStudents.length === 0) {
                setReportData([]);
                setLoading(false);
                return;
            }

            const studentIds = myStudents.map(s => s.id);

            // Fetch daily_scores in date range
            const { data: scoresData } = await supabase
                .from("daily_scores")
                .select("id, student_id, setoran, curriculum_id, created_at, hafalan_type, note")
                .in("student_id", studentIds)
                .gte("created_at", range.startDate)
                .lte("created_at", range.endDate + 'T23:59:59')
                .order("created_at", { ascending: false });

            // Fetch curriculum items to get detailed info
            const curriculumIds = [...new Set(scoresData?.map(s => s.curriculum_id).filter(Boolean))];
            const { data: curriculumItems } = await supabase
                .from("curriculum_items")
                .select("id, name, category, page_start, page_end, ayat_start, ayat_end, total_pages")
                .in("id", curriculumIds);

            // Fetch criteria IDs for adab and disiplin
            const { data: criteriaData } = await supabase
                .from("criteria_ref")
                .select("id, aspect")
                .in("aspect", ["adab", "discipline"]);

            const adabIds = criteriaData?.filter(c => c.aspect === 'adab').map(c => c.id) || [];
            const disiplinIds = criteriaData?.filter(c => c.aspect === 'discipline').map(c => c.id) || [];

            // Fetch daily_assessments in date range
            const { data: assessmentsData } = await supabase
                .from("daily_assessments")
                .select("student_id, criteria_id, is_compliant")
                .in("student_id", studentIds)
                .gte("date", range.startDate)
                .lte("date", range.endDate);

            // Aggregate data per student
            const reportItems: ReportItem[] = myStudents.map(student => {
                const studentScores = scoresData?.filter(s => s.student_id === student.id) || [];
                const studentAssessments = assessmentsData?.filter(a => a.student_id === student.id) || [];

                const totalSetoran = studentScores.length;
                const avgSetoran = totalSetoran > 0
                    ? Math.round(studentScores.reduce((sum, s) => sum + s.setoran, 0) / totalSetoran)
                    : 0;

                // Count hafalan types
                const hafalanBaruCount = studentScores.filter((s: any) => s.hafalan_type === 'baru').length;
                const murojaahCount = studentScores.filter((s: any) => s.hafalan_type === 'murojaah').length;

                // Parse error totals from notes
                const totalErrors = { diberitahu: 0, salahHarokat: 0, salahLupa: 0, berhenti: 0 };

                // Build detailed score list
                const scoreDetails: ScoreDetail[] = studentScores.map((score: any) => {
                    const curriculum = curriculumItems?.find(c => c.id === score.curriculum_id);
                    const note = score.note || '';

                    // Parse progress from note (e.g., "Ayat: 15" or "Halaman: 5")
                    let progress = '';
                    const progressMatch = note.match(/(Ayat|Halaman|Bait):\s*(\d+)/);
                    if (progressMatch) {
                        progress = `${progressMatch[1]}: ${progressMatch[2]}`;
                    }

                    // Parse error breakdown from note
                    let errorBreakdown = '';
                    const errorMatch = note.match(/Kesalahan:\s*Di Beritahu \((\d+)\), Salah Harokat \((\d+)\), Salah\/Lupa \((\d+)\), Berhenti \((\d+)\)/);
                    if (errorMatch) {
                        const e1 = parseInt(errorMatch[1]) || 0;
                        const e2 = parseInt(errorMatch[2]) || 0;
                        const e3 = parseInt(errorMatch[3]) || 0;
                        const e4 = parseInt(errorMatch[4]) || 0;

                        // Accumulate totals
                        totalErrors.diberitahu += e1;
                        totalErrors.salahHarokat += e2;
                        totalErrors.salahLupa += e3;
                        totalErrors.berhenti += e4;

                        errorBreakdown = `DB:${e1}, SH:${e2}, SL:${e3}, B:${e4}`;
                    }

                    return {
                        id: score.id,
                        date: score.created_at,
                        curriculumName: curriculum?.name || '-',
                        curriculumCategory: curriculum?.category || '-',
                        score: score.setoran,
                        hafalanType: score.hafalan_type,
                        progress,
                        errorBreakdown
                    };
                });

                const uniqueCurriculumIds = [...new Set(studentScores.map(s => s.curriculum_id).filter(Boolean))];
                const curriculumDetails: CurriculumDetail[] = uniqueCurriculumIds
                    .map(id => {
                        const item = curriculumItems?.find(c => c.id === id);
                        if (!item) return null;

                        // Get all scores for this curriculum to find last progress and completion
                        const curriculumScores = studentScores.filter(s => s.curriculum_id === id);

                        // Check if any note contains "Selesai" for this curriculum
                        const isComplete = curriculumScores.some((s: any) => {
                            const note = s.note || '';
                            return note.includes('(Selesai Surah)') ||
                                note.includes('(Selesai Kitab)') ||
                                note.includes('(Selesai Mandzumah)');
                        });

                        // Find the last progress value from the most recent score
                        let lastProgress = '';
                        for (const score of curriculumScores) {
                            const note = (score as any).note || '';
                            const progressMatch = note.match(/(Ayat|Halaman|Bait):\s*(\d+)/);
                            if (progressMatch) {
                                lastProgress = progressMatch[2];
                                break; // Already sorted by created_at desc, so first match is latest
                            }
                        }

                        // Format page info based on category
                        let pageInfo = '';
                        if (item.category === 'Surah' && item.ayat_start && item.ayat_end) {
                            pageInfo = `ayat ${item.ayat_start}-${item.ayat_end}`;
                        } else if (item.page_start && item.page_end) {
                            pageInfo = `hlm ${item.page_start}-${item.page_end}`;
                        } else if (item.total_pages) {
                            pageInfo = `${item.total_pages} hlm`;
                        }

                        return {
                            id: item.id,
                            name: item.name,
                            category: item.category,
                            pageInfo,
                            lastProgress,
                            isComplete
                        };
                    })
                    .filter(Boolean) as CurriculumDetail[];

                // Calculate Adab average
                const adabAssessments = studentAssessments.filter(a => adabIds.includes(a.criteria_id));
                const avgAdab = adabAssessments.length > 0
                    ? Math.round((adabAssessments.filter(a => a.is_compliant).length / adabAssessments.length) * 100)
                    : 0;

                // Calculate Disiplin average
                const disiplinAssessments = studentAssessments.filter(a => disiplinIds.includes(a.criteria_id));
                const avgDisiplin = disiplinAssessments.length > 0
                    ? Math.round((disiplinAssessments.filter(a => a.is_compliant).length / disiplinAssessments.length) * 100)
                    : 0;

                return {
                    studentId: student.id,
                    studentName: student.name,
                    waliPhone: student.wali_phone || '',
                    totalSetoran,
                    avgSetoran,
                    curriculumDetails,
                    scoreDetails,
                    avgAdab,
                    avgDisiplin,
                    hafalanBaruCount,
                    murojaahCount,
                    totalErrors
                };
            });

            setReportData(reportItems);
        } catch (error) {
            console.error("Error fetching report data:", error);
            alert(error instanceof Error ? error.message : "Gagal memuat data laporan");
        } finally {
            setLoading(false);
        }
    }

    // Generate WhatsApp message
    function generateWhatsAppMessage(student: ReportItem): string {
        const periodText = dateRangeType === 'custom'
            ? `${formatDateDisplay(dateInfo.startDate)} - ${formatDateDisplay(dateInfo.endDate)}`
            : `${dateInfo.totalDays} hari terakhir`;

        // Format curriculum list with progress status
        const curriculumList = student.curriculumDetails.length > 0
            ? student.curriculumDetails.map(item => {
                // Determine progress label based on category
                const progressType = item.category === 'Surah' ? 'Ayat' :
                    item.category === 'Kitab' ? 'Hlm' : 'Bait';

                // Show "Full" if complete, otherwise show last progress
                const progressText = item.isComplete
                    ? '✅ Full'
                    : item.lastProgress
                        ? `${progressType}: ${item.lastProgress}`
                        : '';

                return `${item.category}: ${item.name} (${progressText})`;
            }).join('\n- ')
            : 'Belum ada setoran';

        // Format detailed score list (max 5 entries)
        const scoreDetailsList = student.scoreDetails.slice(0, 5).map(detail => {
            const typeLabel = detail.hafalanType === 'baru' ? '🆕' : detail.hafalanType === 'murojaah' ? '🔄' : '';
            const progressText = detail.progress ? ` (${detail.progress})` : '';
            return `${typeLabel} ${detail.curriculumName}${progressText}: ${detail.score}/100`;
        }).join('\n  ');

        // Format total error breakdown
        const totalAllErrors = student.totalErrors.diberitahu + student.totalErrors.salahHarokat +
            student.totalErrors.salahLupa + student.totalErrors.berhenti;

        const errorBreakdownText = totalAllErrors > 0
            ? `
📝 *Rincian Kesalahan*
- Di Beritahu: ${student.totalErrors.diberitahu} kali
- Salah Harokat: ${student.totalErrors.salahHarokat} kali
- Salah/Lupa: ${student.totalErrors.salahLupa} kali
- Berhenti: ${student.totalErrors.berhenti} kali`
            : '';

        const overallAvg = (student.avgSetoran + student.avgAdab + student.avgDisiplin) / 3;
        const performanceText = overallAvg >= 85
            ? "perkembangan yang sangat baik"
            : overallAvg >= 70
                ? "perkembangan yang baik"
                : "perlu lebih ditingkatkan";

        return `Assalamu'alaikum Warahmatullahi Wabarakatuh

Yth. Bapak/Ibu Wali Santri *${student.studentName}*

Berikut laporan perkembangan putra/putri Bapak/Ibu selama ${periodText}:

📖 *Setoran Hafalan/Pembelajaran*
- Total setoran: ${student.totalSetoran} kali
  • Hafalan Baru: ${student.hafalanBaruCount} kali
  • Murojaah: ${student.murojaahCount} kali
- Materi yang disetor:
- ${curriculumList}
- Rata-rata nilai: ${student.avgSetoran}/100
${student.scoreDetails.length > 0 ? `
📋 *Detail Setoran Terakhir*
  ${scoreDetailsList}` : ''}
${errorBreakdownText}

🤲 *Adab*
- Rata-rata: ${student.avgAdab}%

⏰ *Disiplin*
- Rata-rata: ${student.avgDisiplin}%

Alhamdulillah, anak Bapak/Ibu menunjukkan ${performanceText}.

Mari kita bersama-sama mendukung putra/putri kita dalam pengembangan diri.

Jazakumullahu khairan
${profile?.full_name || 'Ustadz/Ustadzah'}`;
    }

    // Handle preview
    function handlePreview(student: ReportItem) {
        setSelectedStudent(student);
        setPreviewMessage(generateWhatsAppMessage(student));
        setIsEditingTemplate(false); // Reset edit mode
        setShowPreview(true);
    }

    // Handle send to WhatsApp
    function handleSendWhatsApp() {
        if (!selectedStudent || !selectedStudent.waliPhone) {
            alert("Nomor WhatsApp wali tidak tersedia");
            return;
        }

        let phone = selectedStudent.waliPhone;
        // Clean and format phone number
        phone = phone.replace(/\D/g, ''); // Remove non-digits
        if (phone.startsWith('0')) {
            phone = '62' + phone.substring(1);
        } else if (!phone.startsWith('62')) {
            phone = '62' + phone;
        }

        const encodedMessage = encodeURIComponent(previewMessage);
        const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
        setShowPreview(false);
    }

    // Load data when dateRangeType changes or custom dates change
    useEffect(() => {
        if (profile) {
            if (dateRangeType === 'custom') {
                if (customStartDate && customEndDate) {
                    fetchReportData();
                }
            } else {
                fetchReportData();
            }
        }
    }, [profile, dateRangeType, customStartDate, customEndDate]);

    // Get color for score
    function getScoreColor(score: number): string {
        if (score >= 80) return '#48bb78'; // Green
        if (score >= 60) return '#ed8936'; // Orange
        return '#f56565'; // Red
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 style={{ color: "#1a365d", fontSize: "1.5rem", fontWeight: 700 }}>
                    Laporan Santri
                </h1>
                <p style={{ color: "#718096", marginTop: "0.25rem" }}>
                    Laporan perkembangan santri berdasarkan rentang waktu
                </p>
            </div>

            {/* Date Range Selector */}
            <div className="card p-6 mb-6">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <button
                        onClick={() => setDateRangeType('7')}
                        className="px-4 py-2 rounded-lg font-medium transition-all"
                        style={{
                            backgroundColor: dateRangeType === '7' ? '#3182ce' : '#e2e8f0',
                            color: dateRangeType === '7' ? '#ffffff' : '#4a5568',
                        }}
                    >
                        7 Hari
                    </button>
                    <button
                        onClick={() => setDateRangeType('30')}
                        className="px-4 py-2 rounded-lg font-medium transition-all"
                        style={{
                            backgroundColor: dateRangeType === '30' ? '#3182ce' : '#e2e8f0',
                            color: dateRangeType === '30' ? '#ffffff' : '#4a5568',
                        }}
                    >
                        30 Hari
                    </button>
                    <button
                        onClick={() => setDateRangeType('custom')}
                        className="px-4 py-2 rounded-lg font-medium transition-all"
                        style={{
                            backgroundColor: dateRangeType === 'custom' ? '#3182ce' : '#e2e8f0',
                            color: dateRangeType === 'custom' ? '#ffffff' : '#4a5568',
                        }}
                    >
                        Custom
                    </button>
                </div>

                {/* Custom Date Inputs */}
                {dateRangeType === 'custom' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: "#4a5568" }}>
                                Dari Tanggal:
                            </label>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                style={{ borderColor: "#cbd5e0" }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: "#4a5568" }}>
                                Sampai Tanggal:
                            </label>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                style={{ borderColor: "#cbd5e0" }}
                            />
                        </div>
                    </div>
                )}

                {/* Date Info */}
                {dateInfo.startDate && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: "#4a5568" }}>
                        <Calendar className="w-4 h-4" />
                        <span>
                            Periode: {formatDateDisplay(dateInfo.startDate)} - {formatDateDisplay(dateInfo.endDate)} ({dateInfo.totalDays} hari)
                        </span>
                    </div>
                )}
            </div>

            {/* Report Table */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1a365d" }}>
                        Data Laporan
                    </h2>
                    <span className="text-sm" style={{ color: "#718096" }}>
                        Total: {reportData.length} santri
                    </span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#3182ce" }} />
                        <span className="ml-3" style={{ color: "#718096" }}>Memuat data...</span>
                    </div>
                ) : reportData.length === 0 ? (
                    <div className="text-center py-12" style={{ color: "#a0aec0" }}>
                        <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: "#cbd5e0" }} />
                        <p>Tidak ada data untuk ditampilkan</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                                    <th className="text-left p-3 text-sm font-semibold" style={{ color: "#4a5568" }}>No</th>
                                    <th className="text-left p-3 text-sm font-semibold" style={{ color: "#4a5568" }}>Nama Santri</th>
                                    <th className="text-center p-3 text-sm font-semibold" style={{ color: "#4a5568" }}>Total Setoran</th>
                                    <th className="text-left p-3 text-sm font-semibold" style={{ color: "#4a5568" }}>Materi</th>
                                    <th className="text-center p-3 text-sm font-semibold" style={{ color: "#4a5568" }}>Rata-rata Nilai</th>
                                    <th className="text-center p-3 text-sm font-semibold" style={{ color: "#4a5568" }}>Adab</th>
                                    <th className="text-center p-3 text-sm font-semibold" style={{ color: "#4a5568" }}>Disiplin</th>
                                    <th className="text-center p-3 text-sm font-semibold" style={{ color: "#4a5568" }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((student, index) => (
                                    <tr key={student.studentId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                        <td className="p-3 text-sm" style={{ color: "#4a5568" }}>{index + 1}</td>
                                        <td className="p-3 text-sm font-medium" style={{ color: "#2d3748" }}>{student.studentName}</td>
                                        <td className="p-3 text-center">
                                            <span
                                                className="inline-block px-3 py-1 rounded-full text-sm font-medium"
                                                style={{ backgroundColor: "#3182ce", color: "#ffffff" }}
                                            >
                                                {student.totalSetoran}
                                            </span>
                                        </td>
                                        <td className="p-3 text-left">
                                            <div className="text-xs" style={{ color: "#4a5568", maxWidth: "200px" }}>
                                                {student.curriculumDetails.length > 0 ? (
                                                    <ul className="space-y-1">
                                                        {student.curriculumDetails.slice(0, 3).map((item, idx) => (
                                                            <li key={idx} className="truncate">
                                                                <span className="font-medium" style={{ color: "#2d3748" }}>
                                                                    {item.category}:
                                                                </span> {item.name}
                                                                {item.pageInfo && <span style={{ color: "#a0aec0" }}> ({item.pageInfo})</span>}
                                                            </li>
                                                        ))}
                                                        {student.curriculumDetails.length > 3 && (
                                                            <li style={{ color: "#a0aec0" }}>+{student.curriculumDetails.length - 3} lainnya</li>
                                                        )}
                                                    </ul>
                                                ) : (
                                                    <span style={{ color: "#a0aec0" }}>Belum ada</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span
                                                className="inline-flex items-center gap-1 font-semibold text-sm"
                                                style={{ color: getScoreColor(student.avgSetoran) }}
                                            >
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getScoreColor(student.avgSetoran) }} />
                                                {student.avgSetoran}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center text-sm font-medium" style={{ color: "#4a5568" }}>
                                            {student.avgAdab}%
                                        </td>
                                        <td className="p-3 text-center text-sm font-medium" style={{ color: "#4a5568" }}>
                                            {student.avgDisiplin}%
                                        </td>
                                        <td className=" p-3">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => handlePreview(student)}
                                                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                                    style={{
                                                        border: "1px solid #3182ce",
                                                        color: "#3182ce",
                                                        backgroundColor: "transparent"
                                                    }}
                                                    disabled={!student.waliPhone}
                                                >
                                                    Preview
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handlePreview(student);
                                                        setTimeout(() => handleSendWhatsApp(), 100);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                                    style={{
                                                        backgroundColor: student.waliPhone ? "#48bb78" : "#cbd5e0",
                                                        color: "#ffffff"
                                                    }}
                                                    disabled={!student.waliPhone}
                                                    title={!student.waliPhone ? "Nomor WA tidak tersedia" : ""}
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                    Kirim WA
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {showPreview && selectedStudent && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowPreview(false)}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-semibold" style={{ color: "#1a365d" }}>
                                Preview Pesan WhatsApp
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                                    className="px-3 py-1.5 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors"
                                    style={{
                                        backgroundColor: isEditingTemplate ? "#3182ce" : "#e2e8f0",
                                        color: isEditingTemplate ? "#ffffff" : "#4a5568"
                                    }}
                                >
                                    <Edit3 className="w-4 h-4" />
                                    {isEditingTemplate ? 'Selesai Edit' : 'Edit Template'}
                                </button>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="p-1 rounded-lg hover:bg-gray-100"
                                >
                                    <X className="w-5 h-5" style={{ color: "#4a5568" }} />
                                </button>
                            </div>
                        </div>

                        {/* Message Preview/Editor */}
                        <div className="p-4">
                            {isEditingTemplate ? (
                                <div className="mb-4">
                                    <label className="block text-xs font-medium mb-2" style={{ color: "#4a5568" }}>
                                        Edit template pesan:
                                    </label>
                                    <textarea
                                        value={previewMessage}
                                        onChange={(e) => setPreviewMessage(e.target.value)}
                                        rows={15}
                                        className="w-full p-3 border rounded-lg text-sm font-mono"
                                        style={{
                                            borderColor: "#cbd5e0",
                                            color: "#2d3748",
                                            resize: "vertical"
                                        }}
                                    />
                                    <p className="text-xs mt-1" style={{ color: "#a0aec0" }}>
                                        💡 Tip: Gunakan *teks* untuk bold di WhatsApp
                                    </p>
                                </div>
                            ) : (
                                <div
                                    className="p-4 rounded-lg mb-4 whitespace-pre-wrap text-sm"
                                    style={{ backgroundColor: "#dcf8c6", color: "#1a365d" }}
                                >
                                    {previewMessage}
                                </div>
                            )}

                            {/* Phone Info */}
                            <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: "#f7fafc" }}>
                                <p className="text-xs" style={{ color: "#718096" }}>Nomor Tujuan:</p>
                                <p className="font-medium" style={{ color: "#2d3748" }}>
                                    {selectedStudent.waliPhone || 'Tidak tersedia'}
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex gap-3 p-4 border-t">
                            <button
                                onClick={() => setShowPreview(false)}
                                className="flex-1 px-4 py-2 rounded-lg font-medium"
                                style={{
                                    border: "1px solid #cbd5e0",
                                    color: "#4a5568",
                                    backgroundColor: "transparent"
                                }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSendWhatsApp}
                                className="flex-1 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                                style={{ backgroundColor: "#48bb78", color: "#ffffff" }}
                            >
                                <MessageCircle className="w-4 h-4" />
                                Kirim ke WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
