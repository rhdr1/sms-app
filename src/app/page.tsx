"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Users, BarChart3, ChevronRight } from "lucide-react";

// Color constants matching globals.css
const colors = {
  blue900: "#1a365d",
  blue200: "#bee3f8",
  yellow400: "#f6e05e",
  yellow100: "#fffff0",
  surface: "#f8fafc",
  white: "#ffffff",
  gray500: "#a0aec0",
  gray600: "#718096",
};

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.surface }}>
      {/* Hero Section */}
      <header style={{ backgroundColor: colors.blue900, color: colors.white }}>
        <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center overflow-hidden">
              <Image
                src="/logo.png"
                alt="Mulazamah"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <div>
              <span className="font-bold text-xl block text-white">SMS</span>
              <span className="text-xs" style={{ color: colors.blue200 }}>Mulazamah</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/wali/login"
              className="text-sm py-2 px-4 bg-white rounded-xl font-semibold transition-all duration-200 ease-in-out hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 shadow-sm"
              style={{ color: colors.blue900 }}
            >
              Portal Wali
            </Link>
            <Link
              href="/login"
              className="btn-primary text-sm py-2 px-4"
            >
              Masuk
            </Link>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight text-white">
            Sistem Manajemen Santri
          </h1>
          <p
            className="text-lg md:text-xl max-w-2xl mx-auto mb-8"
            style={{ color: colors.blue200 }}
          >
            Digitalisasi pencatatan akademik dan perilaku santri.
            Input nilai secara real-time, pantau perkembangan dengan mudah.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 btn-primary text-lg py-3 px-8"
          >
            Mulai Sekarang
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2
          className="text-2xl md:text-3xl font-bold text-center mb-12"
          style={{ color: colors.blue900 }}
        >
          Fitur Utama
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="card p-6 text-center hover:shadow-lg transition-shadow">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: colors.yellow100 }}
            >
              <Users className="w-8 h-8" style={{ color: colors.yellow400 }} />
            </div>
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: colors.blue900 }}
            >
              Manajemen Santri
            </h3>
            <p style={{ color: colors.gray600 }}>
              Kelola data santri dengan mudah. Lihat profil, halaqah, dan status kualifikasi.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="card p-6 text-center hover:shadow-lg transition-shadow">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: colors.yellow100 }}
            >
              <BookOpen className="w-8 h-8" style={{ color: colors.yellow400 }} />
            </div>
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: colors.blue900 }}
            >
              Input Nilai Real-time
            </h3>
            <p style={{ color: colors.gray600 }}>
              Catat nilai adab, disiplin, dan setoran langsung dari smartphone.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="card p-6 text-center hover:shadow-lg transition-shadow">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: colors.yellow100 }}
            >
              <BarChart3 className="w-8 h-8" style={{ color: colors.yellow400 }} />
            </div>
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: colors.blue900 }}
            >
              Laporan Otomatis
            </h3>
            <p style={{ color: colors.gray600 }}>
              Status kualifikasi (Mutqin/Dhaif) dihitung otomatis berdasarkan rata-rata nilai.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ backgroundColor: colors.blue900, color: colors.white }} className="py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
            Siap Memulai?
          </h2>
          <p className="mb-8" style={{ color: colors.blue200 }}>
            Hubungi administrator untuk mendapatkan akses ke sistem.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 btn-primary text-lg py-3 px-8"
          >
            Masuk ke Dashboard
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t py-8"
        style={{ backgroundColor: colors.white, borderColor: "#e2e8f0" }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center" style={{ color: colors.gray500 }}>
          <p>&copy; 2026 Sistem Manajemen Santri. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
