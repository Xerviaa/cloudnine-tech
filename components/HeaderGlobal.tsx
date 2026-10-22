'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import AvatarDropdown from '@/components/AvatarDropdown'

type Props = {
  profile: any
  type: 'karyawan' | 'admin'
}

export default function HeaderGlobal({ profile, type }: Props) {
  const pathname = usePathname()

  // Daftar menu untuk karyawan
  const menuKaryawan = [
    { name: 'Absen', href: '/absen' },
    { name: 'Jadwal Saya', href: '/jadwal-saya' },
    { name: 'Ajukan Izin', href: '/izin' },
    { name: 'Profil', href: '/profil' },
  ]

  // Daftar menu untuk admin
  const menuAdmin = [
    { name: 'Dashboard', href: '/admin' },
    { name: 'Kelola Jadwal', href: '/admin/jadwal' },
    { name: 'Izin & Cuti', href: '/admin/izin' },
    { name: 'Pengaturan', href: '/admin/pengaturan' },
  ]

  const menus = type === 'admin' ? menuAdmin : menuKaryawan

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        
        {/* Logo */}
        <Link href={type === 'admin' ? '/admin' : '/absen'} className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur-md opacity-50" />
            <div className="relative w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">🏢</span>
            </div>
          </div>
          <div className="hidden sm:block">
            <p className="text-slate-800 dark:text-slate-100 font-bold text-base leading-tight">AbsenKita</p>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] capitalize">{type}</p>
          </div>
        </Link>

        {/* Menu Navigasi */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          {menus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pathname === menu.href
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
            >
              {menu.name}
            </Link>
          ))}
        </nav>

        {/* Tombol Kanan */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <AvatarDropdown
            nama={profile?.nama_lengkap || 'User'}
            email={profile?.email || ''}
            role={profile?.role || 'karyawan'}
            avatarUrl={profile?.avatar_url || null}
          />
        </div>
      </div>
    </header>
  )
}