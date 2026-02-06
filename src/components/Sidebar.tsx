"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useWaliAuth } from "@/contexts/WaliAuthContext";
import {
    LayoutDashboard,
    Users,
    BookOpen,
    ClipboardList,
    Settings,
    ChevronLeft,
    ChevronRight,
    GraduationCap,
    ShieldCheck,
    UserCog,
    Menu,
    X,
    FileText,
    CheckSquare,
    Clock,
    ListChecks,
    CalendarClock,
    Home,
    Bell,
} from "lucide-react";

interface MenuItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    requireSuperAdmin?: boolean;
}

interface MenuSection {
    title: string;
    icon: React.ReactNode;
    items: MenuItem[];
    requireAdmin?: boolean;
}

const allMenuSections: MenuSection[] = [
    {
        title: "Dashboard Guru",
        icon: <GraduationCap className="w-5 h-5" />,
        requireAdmin: false,
        items: [
            {
                label: "Beranda",
                href: "/dashboard/guru",
                icon: <LayoutDashboard className="w-5 h-5" />,
            },
            {
                label: "Daftar Santri",
                href: "/dashboard/guru/santri",
                icon: <Users className="w-5 h-5" />,
            },
            {
                label: "Input Nilai",
                href: "/dashboard/guru/nilai",
                icon: <ClipboardList className="w-5 h-5" />,
            },
            {
                label: "Penilaian Harian",
                href: "/dashboard/guru/penilaian-harian",
                icon: <CheckSquare className="w-5 h-5" />,
            },
            {
                label: "Halaqah Saya",
                href: "/dashboard/guru/halaqah",
                icon: <BookOpen className="w-5 h-5" />,
            },
            {
                label: "Laporan",
                href: "/dashboard/guru/laporan",
                icon: <FileText className="w-5 h-5" />,
            },
            {
                label: "Pengaturan",
                href: "/dashboard/guru/settings",
                icon: <Settings className="w-5 h-5" />,
            },
        ],
    },
    {
        title: "Dashboard Admin",
        icon: <ShieldCheck className="w-5 h-5" />,
        requireAdmin: true,
        items: [
            {
                label: "Beranda Admin",
                href: "/dashboard/admin",
                icon: <LayoutDashboard className="w-5 h-5" />,
            },
            {
                label: "Kelola Guru",
                href: "/dashboard/admin/guru",
                icon: <UserCog className="w-5 h-5" />,
            },
            {
                label: "Kelola Admin",
                href: "/dashboard/admin/kelola-admin",
                icon: <ShieldCheck className="w-5 h-5" />,
                requireSuperAdmin: true, // Only visible to Super Admin
            },
            {
                label: "Kelola Santri",
                href: "/dashboard/admin/santri",
                icon: <Users className="w-5 h-5" />,
            },
            {
                label: "Kelola Halaqah",
                href: "/dashboard/admin/halaqah",
                icon: <BookOpen className="w-5 h-5" />,
            },
            {
                label: "Detail Kehadiran",
                href: "/dashboard/admin/kehadiran",
                icon: <CalendarClock className="w-5 h-5" />,
            },
            {
                label: "Kurikulum",
                href: "/dashboard/admin/kurikulum",
                icon: <BookOpen className="w-5 h-5" />,
            },
            {
                label: "Kelola Kriteria",
                href: "/dashboard/admin/kriteria",
                icon: <ListChecks className="w-5 h-5" />,
            },
            {
                label: "Kelola Sesi",
                href: "/dashboard/admin/sesi",
                icon: <Clock className="w-5 h-5" />,
            },
            {
                label: "Laporan",
                href: "/dashboard/admin/laporan",
                icon: <FileText className="w-5 h-5" />,
            },
            {
                label: "Pengaturan",
                href: "/dashboard/admin/settings",
                icon: <Settings className="w-5 h-5" />,
            },
        ],
    },
];

// Color constants matching globals.css
const colors = {
    sidebarBg: "#1a365d",
    sidebarBgDark: "#0c1929",
    yellow: "#f6e05e",
    yellowHover: "#ecc94b",
    textWhite: "#ffffff",
    textMuted: "rgba(255, 255, 255, 0.7)",
    textSubtle: "rgba(255, 255, 255, 0.6)",
    borderLight: "rgba(255, 255, 255, 0.1)",
    hoverBg: "rgba(255, 255, 255, 0.1)",
};

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [expandedSections, setExpandedSections] = useState<string[]>(["Dashboard Guru", "Dashboard Admin", "Dashboard Wali", "Anak Saya"]);
    const pathname = usePathname();
    const { isAdmin: isAuthAdmin, profile, signOut } = useAuth();
    const { wali, children: waliChildren, logoutWali } = useWaliAuth();

    // Determine current user context
    const isWali = !!wali;
    const isRegularUser = !!profile;

    // Construct dynamic menus
    let displayMenuSections: MenuSection[] = [];

    if (isWali) {
        // Wali Menu
        const waliMenu: MenuSection = {
            title: "Dashboard Wali",
            icon: <Home className="w-5 h-5" />,
            items: [
                {
                    label: "Beranda",
                    href: "/dashboard/wali",
                    icon: <Home className="w-5 h-5" />,
                },
                {
                    label: "Kehadiran",
                    href: "/dashboard/wali/kehadiran",
                    icon: <CalendarClock className="w-5 h-5" />,
                },
                {
                    label: "Pengumuman",
                    href: "/dashboard/wali/pengumuman",
                    icon: <Bell className="w-5 h-5" />,
                },
                {
                    label: "Pengaturan",
                    href: "/dashboard/wali/settings",
                    icon: <Settings className="w-5 h-5" />,
                },
            ]
        };

        // Children Menu
        const childrenMenu: MenuSection = {
            title: "Anak Saya",
            icon: <Users className="w-5 h-5" />,
            items: waliChildren.map(child => ({
                label: child.name,
                href: `/dashboard/wali/anak/${child.id}`,
                icon: <Users className="w-5 h-5" />,
            }))
        };

        displayMenuSections = [waliMenu];
        if (waliChildren.length > 0) {
            displayMenuSections.push(childrenMenu);
        }

    } else if (isRegularUser) {
        // Regular User (Admin/Guru) Menu
        displayMenuSections = allMenuSections.filter((section) => {
            // Show Dashboard Guru only if user can access guru pages (ustadz or super_admin)
            if (section.title === "Dashboard Guru") {
                return profile?.role === "ustadz" || profile?.role === "super_admin";
            }
            // Show Dashboard Admin only if user can access admin pages (admin or super_admin)
            if (section.title === "Dashboard Admin") {
                return profile?.role === "admin" || profile?.role === "super_admin";
            }
            return true;
        });
    }

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    // Close mobile menu on resize to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setIsMobileOpen(false);
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const toggleSection = (title: string) => {
        setExpandedSections((prev) =>
            prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
        );
    };

    const handleLogout = async () => {
        if (isWali) {
            logoutWali();
        } else {
            await signOut();
        }
    };

    const isActive = (href: string) => pathname === href;

    // Sidebar content component
    const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
        <>
            {/* Header */}
            <div
                className="flex items-center justify-between p-4"
                style={{ borderBottom: `1px solid ${colors.borderLight}` }}
            >
                {(!isCollapsed || isMobile) && (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                            <Image
                                src="/logo.png"
                                alt="Mulazamah"
                                width={40}
                                height={40}
                                className="object-contain"
                            />
                        </div>
                        <div>
                            <h1 style={{ color: "#ffffff", fontWeight: 700, fontSize: "1.125rem", lineHeight: 1.2 }}>SMS</h1>
                            <p style={{ color: "#bee3f8", fontSize: "0.75rem" }}>Mulazamah</p>
                        </div>
                    </div>
                )}
                {isCollapsed && !isMobile && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex items-center justify-center mx-auto">
                        <Image
                            src="/logo.png"
                            alt="Mulazamah"
                            width={40}
                            height={40}
                            className="object-contain"
                        />
                    </div>
                )}
                {isMobile && (
                    <button
                        onClick={() => setIsMobileOpen(false)}
                        className="p-2 rounded-lg"
                        style={{ color: colors.textWhite }}
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* User Info */}
            {(!isCollapsed || isMobile) && (profile || wali) && (
                <div
                    className="px-4 py-3"
                    style={{ borderBottom: `1px solid ${colors.borderLight}` }}
                >
                    <p className="text-xs" style={{ color: colors.textMuted }}>Masuk sebagai</p>
                    <p className="text-sm font-medium truncate" style={{ color: colors.textWhite }}>
                        {isWali ? wali?.name : (profile?.full_name || profile?.email)}
                    </p>
                    <span
                        className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full"
                        style={{
                            backgroundColor: isWali ? "rgba(72, 187, 120, 0.2)" : // Green for Wali
                                profile?.role === "super_admin" ? "rgba(236, 201, 75, 0.2)" : // Gold/Yellow for Superadmin
                                    isAuthAdmin ? "rgba(246, 224, 94, 0.2)" : // Lighter Yellow for Admin
                                        "rgba(99, 179, 237, 0.2)",
                            color: isWali ? "#48bb78" : // Green
                                profile?.role === "super_admin" ? "#d69e2e" : // Darker Gold
                                    isAuthAdmin ? colors.yellow :
                                        "#63b3ed"
                        }}
                    >
                        {isWali ? "Wali Santri" : (profile?.role === "super_admin" ? "Super Admin" : isAuthAdmin ? "Admin" : "Guru")}
                    </span>
                </div>
            )}

            {/* Toggle Button - Desktop only */}
            {!isMobile && (
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-20 w-6 h-6 rounded-full items-center justify-center shadow-lg transition-colors hidden lg:flex"
                    style={{
                        backgroundColor: colors.yellow,
                        color: colors.sidebarBg
                    }}
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </button>
            )}

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
                {displayMenuSections.map((section) => (
                    <div key={section.title} className="mb-4">
                        {/* Section Header */}
                        <button
                            onClick={() => toggleSection(section.title)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isCollapsed && !isMobile ? "justify-center" : ""
                                }`}
                            style={{ color: colors.textMuted }}
                        >
                            <span style={{ color: colors.yellow }}>{section.icon}</span>
                            {(!isCollapsed || isMobile) && (
                                <>
                                    <span className="font-semibold text-sm flex-1 text-left">
                                        {section.title}
                                    </span>
                                    <ChevronRight
                                        className={`w-4 h-4 transition-transform ${expandedSections.includes(section.title) ? "rotate-90" : ""
                                            }`}
                                    />
                                </>
                            )}
                        </button>

                        {/* Section Items */}
                        {(expandedSections.includes(section.title) || (isCollapsed && !isMobile)) && (
                            <div className={`mt-1 space-y-1 ${isCollapsed && !isMobile ? "" : "ml-4"}`}>
                                {section.items
                                    .filter(item => {
                                        // Hide Super Admin only items from regular admins
                                        if (item.requireSuperAdmin) {
                                            return profile?.role === "super_admin";
                                        }
                                        return true;
                                    })
                                    .map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${isCollapsed && !isMobile ? "justify-center" : ""
                                                }`}
                                            style={isActive(item.href) ? {
                                                backgroundColor: colors.yellow,
                                                color: colors.sidebarBg,
                                                fontWeight: 600,
                                                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
                                            } : {
                                                color: colors.textMuted
                                            }}
                                            title={isCollapsed && !isMobile ? item.label : undefined}
                                        >
                                            {item.icon}
                                            {(!isCollapsed || isMobile) && (
                                                <span className="text-sm">{item.label}</span>
                                            )}
                                        </Link>
                                    ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* Logout Button */}
            <div className="p-4" style={{ borderTop: `1px solid ${colors.borderLight}` }}>
                <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-white/10 text-red-400 ${isCollapsed && !isMobile ? "justify-center" : ""
                        }`}
                >
                    <ChevronLeft className="w-5 h-5 rotate-180" /> {/* Using ChevronLeft as generic logout icon for now or import LogOut */}
                    {(!isCollapsed || isMobile) && (
                        <span className="text-sm font-medium">Keluar</span>
                    )}
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Header Bar */}
            <div
                className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 lg:hidden z-40"
                style={{ backgroundColor: colors.sidebarBg }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                        <Image
                            src="/logo.png"
                            alt="Mulazamah"
                            width={32}
                            height={32}
                            className="object-contain"
                        />
                    </div>
                    <span className="font-bold text-white">SMS</span>
                </div>
                <button
                    onClick={() => setIsMobileOpen(true)}
                    className="p-2 rounded-lg"
                    style={{ color: colors.textWhite }}
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Mobile Sidebar Drawer */}
            <aside
                className={`fixed left-0 top-0 h-screen z-50 flex flex-col w-72 transform transition-transform duration-300 lg:hidden ${isMobileOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
                style={{ backgroundColor: colors.sidebarBg }}
            >
                <SidebarContent isMobile={true} />
            </aside>

            {/* Desktop Sidebar */}
            <aside
                className={`fixed left-0 top-0 h-screen transition-all duration-300 z-50 flex-col hidden lg:flex ${isCollapsed ? "w-20" : "w-64"
                    }`}
                style={{ backgroundColor: colors.sidebarBg }}
            >
                <SidebarContent isMobile={false} />
            </aside>
        </>
    );
}
