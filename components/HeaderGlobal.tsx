'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'
import AvatarDropdown from '@/components/AvatarDropdown'

type Props = {
  profile: any
  type: 'karyawan' | 'admin'
}

export default function HeaderGlobal({ profile, type }: Props) {
  const pathname = usePathname()
  const supabase = createClient()

  // State untuk menyimpan data perusahaan
  const [companyName, setCompanyName] = useState('AbsenKita')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  // Ambil data perusahaan dari Supabase saat header dimuat
  useEffect(() => {
    async function fetchCompanyData() {
      const { data } = await supabase
        .from('company_settings')
        .select('nama_perusahaan, logo_url')
        .eq('id', 1)
        .single()

      if (data) {
        if (data.nama_perusahaan) setCompanyName(data.nama_perusahaan)
        if (data.logo_url) setLogoUrl(data.logo_url)
      }
    }
    fetchCompanyData()
  }, [])

  const menuKaryawan = [
    { name: 'Absen', href: '/absen' },
    { name: 'Jadwal Saya', href: '/jadwal-saya' },
    { name: 'Ajukan Izin', href: '/izin' },
  ]

  const menuAdmin = [
    { name: 'Dashboard', href: '/admin' },
    { name: 'Kelola Jadwal', href: '/admin/jadwal' },
    { name: 'Izin & Cuti', href: '/admin/izin' },
    { name: 'Pengaturan', href: '/admin/pengaturan' },
    { name: 'Halaman Absen', href: '/absen' }, 
  ]

  const menus = type === 'admin' ? menuAdmin : menuKaryawan
  const isAdminInKaryawanPage = type === 'karyawan' && profile?.role === 'admin'

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        
        {/* Logo dan Judul Dinamis */}
        <Link href={type === 'admin' ? '/admin' : '/absen'} className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur-md opacity-50" />
            {/* Jika ada logo dari database, tampilkan gambar. Jika tidak, tampilkan ikon gedung */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName}
                className="relative w-9 h-9 rounded-xl object-contain bg-white dark:bg-slate-800 p-0.5"
              />
            ) : (
              <div className="relative w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-lg">🏢</span>
              </div>
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-slate-800 dark:text-slate-100 font-bold text-base leading-tight">{companyName}</p>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] capitalize">{type}</p>
          </div>
        </Link>

        {/* Menu Navigasi Desktop & Tablet */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700 mx-4 overflow-x-auto no-scrollbar">
          {isAdminInKaryawanPage && (
            <Link
              href="/admin"
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800 mr-1"
            >
              👑 Dashboard Admin
            </Link>
          )}

          {menus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                pathname === menu.href
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
            >
              {menu.name}
            </Link>
          ))}
        </nav>

        {/* Tombol Kanan: Dark Mode & Avatar */}
        <div className="flex items-center gap-3 shrink-0">
          <ThemeToggle />
          <AvatarDropdown
            nama={profile?.nama_lengkap || 'User'}
            email={profile?.email || ''}
            role={profile?.role || 'karyawan'}
            avatarUrl={profile?.avatar_url || null}
          />
        </div>
      </div>

      {/* Menu Navigasi HP */}
      <div className="md:hidden px-4 pb-3 overflow-x-auto no-scrollbar flex gap-2">
        {isAdminInKaryawanPage && (
          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800"
          >
            👑 Admin
          </Link>
        )}

        {menus.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              pathname === menu.href
                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {menu.name}
          </Link>
        ))}
      </div>
    </header>
  )
}