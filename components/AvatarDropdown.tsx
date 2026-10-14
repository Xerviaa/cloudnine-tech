'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  nama: string
  email: string
  role: 'karyawan' | 'admin'
  avatarUrl?: string | null
}

export default function AvatarDropdown({ nama, email, role, avatarUrl }: Props) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    setOpen(false)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ============================================================ */}
      {/* TOMBOL AVATAR UTAMA - HANYA MEMBUKA DROPDOWN MENU            */}
      {/* ============================================================ */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative group"
        aria-label="Menu profil"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full blur opacity-50 group-hover:opacity-70 transition" />
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={nama}
            className="relative w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-lg group-hover:scale-105 transition"
          />
        ) : (
          <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-lg group-hover:scale-105 transition">
            {getInitials(nama)}
          </div>
        )}
        {open && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
        )}
      </button>

      {/* ============================================================ */}
      {/* DROPDOWN MENU                                                */}
      {/* ============================================================ */}
      {open && (
        <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
          {/* Header - Info User */}
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-4">
            <div className="flex items-center gap-3">
              {/* Foto profil - TIDAK BISA DIKLIK, hanya tampilan */}
              {avatarUrl ? (
                <div className="shrink-0">
                  <img
                    src={avatarUrl}
                    alt={nama}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-white/30"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white font-bold ring-2 ring-white/30 shrink-0">
                  {getInitials(nama)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{nama}</p>
                <p className="text-white/70 text-xs truncate">{email}</p>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 bg-white/20 backdrop-blur border border-white/30 rounded-full px-2.5 py-0.5">
              <span className="text-[10px] text-white font-medium">
                {role === 'admin' ? '👑 Admin' : '👤 Karyawan'}
              </span>
            </div>
            <p className="text-[10px] text-white/60 mt-2">
              💡 Buka Edit Profil untuk lihat/ganti foto
            </p>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <Link
              href="/profil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center text-indigo-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium">Edit Profil</p>
                <p className="text-[10px] text-slate-400">Lihat/ganti foto, nomor HP & alamat</p>
              </div>
            </Link>

            <Link
              href="/profil/password"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center text-violet-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium">Ubah Password</p>
                <p className="text-[10px] text-slate-400">Ganti password akun</p>
              </div>
            </Link>

            <div className="my-1 border-t border-slate-100" />

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-rose-600 hover:bg-rose-50 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-100 group-hover:bg-rose-200 flex items-center justify-center text-rose-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" x2="9" y1="12" y2="12"/>
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">Logout</p>
                <p className="text-[10px] text-rose-400">Keluar dari aplikasi</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}