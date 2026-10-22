'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import EditUserModal from '@/components/EditUserModal'

type Profile = {
  id: string
  nama_lengkap: string
  email: string
  role: 'karyawan' | 'admin'
  avatar_url: string | null
  nomor_hp: string | null
  alamat_jalan: string | null
  kabupaten: string | null
  kecamatan: string | null
  kelurahan: string | null
}

export default function AdminKaryawanPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [viewingPhoto, setViewingPhoto] = useState<Profile | null>(null)
  const [searchKaryawan, setSearchKaryawan] = useState('')
  const [filterRole, setFilterRole] = useState<'semua' | 'admin' | 'karyawan'>('semua')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (!profileData || profileData.role !== 'admin') {
        alert('Akses ditolak. Halaman ini hanya untuk admin.')
        router.push('/absen')
        return
      }
      setProfile(profileData)
      await loadUsers()
      setLoading(false)
    }
    checkAdmin()
  }, [])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setViewingPhoto(null)
    }
    if (viewingPhoto) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [viewingPhoto])

  useEffect(() => {
    if (viewingPhoto) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [viewingPhoto])

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('nama_lengkap')
    setUsers(data || [])
  }

  async function handleSaveUser(
    id: string,
    data: { nama_lengkap: string; role: 'karyawan' | 'admin' }
  ) {
    const { error } = await supabase.from('profiles').update(data).eq('id', id)
    if (error) throw new Error(error.message)
    await loadUsers()
  }

  async function handleDeleteUser(user: Profile) {
    if (user.id === profile?.id) {
      alert('Tidak bisa menghapus akun sendiri!')
      return
    }
    const konfirmasi = confirm(
      `Yakin hapus karyawan "${user.nama_lengkap}"?\n\nAkun login & data absensinya akan terhapus permanen.`
    )
    if (!konfirmasi) return

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('Gagal hapus: ' + (data.error || 'Terjadi kesalahan'))
        return
      }
      alert('Karyawan berhasil dihapus permanen.')
      await loadUsers()
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message)
    }
  }

  async function handleCopyPhone(userId: string, phone: string) {
    try {
      await navigator.clipboard.writeText(phone)
      setCopiedId(userId)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (err) {
      alert('Gagal menyalin nomor HP')
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  const formatAlamat = (u: Profile) => {
    const jalan = u.alamat_jalan || ''
    const wilayah = [u.kelurahan, u.kecamatan, u.kabupaten].filter(Boolean).join(', ')
    return { jalan, wilayah }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = u.nama_lengkap.toLowerCase().includes(searchKaryawan.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchKaryawan.toLowerCase())
      const matchRole = filterRole === 'semua' || u.role === filterRole
      return matchSearch && matchRole
    })
  }, [users, searchKaryawan, filterRole])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Memuat data karyawan...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur-md opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🏢</span>
              </div>
            </div>
            <div>
              <p className="text-slate-800 font-bold text-lg leading-tight">AbsenKita</p>
              <p className="text-slate-500 text-xs">Kelola Karyawan</p>
            </div>
          </Link>

          <Link
            href="/admin"
            className="text-slate-700 hover:text-indigo-700 text-sm bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-4 py-2 rounded-lg transition font-medium"
          >
            ← Kembali
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            👥 Kelola Karyawan
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {users.length} orang terdaftar
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50/50 to-fuchsia-50/50 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
                👥
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Daftar Karyawan</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {filteredUsers.length} dari {users.length} orang
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={searchKaryawan}
                  onChange={(e) => setSearchKaryawan(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent w-56"
                />
              </div>

              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent cursor-pointer"
              >
                <option value="semua">Semua Role</option>
                <option value="admin">👑 Admin</option>
                <option value="karyawan">👤 Karyawan</option>
              </select>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-6xl mb-3 opacity-40">📭</p>
              <p className="text-slate-500 text-sm font-medium">
                {users.length === 0 ? 'Belum ada karyawan terdaftar' : 'Tidak ada data yang cocok dengan filter'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left border-b border-slate-100">
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Karyawan</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Nomor HP</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Alamat</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const { jalan, wilayah } = formatAlamat(u)
                    return (
                      <tr key={u.id} className="border-t border-slate-100 hover:bg-violet-50/40 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? (
                              <button
                                type="button"
                                onClick={() => setViewingPhoto(u)}
                                className="relative cursor-zoom-in group/photo shrink-0"
                                title="Klik untuk lihat foto"
                              >
                                <img
                                  src={u.avatar_url}
                                  alt={u.nama_lengkap}
                                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-md transition group-hover/photo:scale-110 group-hover/photo:ring-indigo-400"
                                />
                                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/photo:opacity-100 transition flex items-center justify-center">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"/>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                    <line x1="11" y1="8" x2="11" y2="14"/>
                                    <line x1="8" y1="11" x2="14" y2="11"/>
                                  </svg>
                                </div>
                              </button>
                            ) : (
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0 ${
                                u.role === 'admin'
                                  ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/30'
                                  : 'bg-gradient-to-br from-sky-500 to-cyan-500 shadow-sky-500/30'
                              }`}>
                                {getInitials(u.nama_lengkap)}
                              </div>
                            )}
                            <div>
                              <Link
                                href={`/admin/karyawan/${u.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline transition inline-flex items-center gap-1"
                              >
                                {u.nama_lengkap}
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                  <polyline points="15 3 21 3 21 9"/>
                                  <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                              </Link>
                              {u.id === profile?.id && (
                                <p className="text-[10px] text-indigo-600 font-medium">Anda</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-slate-500 text-xs">{u.email}</td>

                        <td className="px-6 py-4">
                          {u.nomor_hp ? (
                            <button
                              onClick={() => handleCopyPhone(u.id, u.nomor_hp || '')}
                              title="Klik untuk salin nomor HP"
                              className={`inline-flex items-center gap-1 font-mono text-xs font-medium border px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                copiedId === u.id
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                              }`}
                            >
                              {copiedId === u.id ? '✓ Tersalin' : `📱 ${u.nomor_hp}`}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">-</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {jalan || wilayah ? (
                            <div className="flex flex-col gap-0.5 max-w-xs">
                              {jalan && (
                                <p className="text-xs text-slate-700 font-medium leading-snug">{jalan}</p>
                              )}
                              {wilayah && (
                                <p className="text-[11px] text-slate-500 leading-snug">{wilayah}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Belum diisi</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                            u.role === 'admin'
                              ? 'bg-violet-50 text-violet-700 border-violet-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}>
                            {u.role === 'admin' ? '👑 Admin' : '👤 Karyawan'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setEditingUser(u)}
                            className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 px-3 py-1.5 rounded-lg text-xs font-medium transition mr-1"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={u.id === profile?.id}
                            className="text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-rose-600 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                          >
                            🗑️ Hapus
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <EditUserModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSave={handleSaveUser}
      />

      {viewingPhoto && viewingPhoto.avatar_url && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm"
          onClick={() => setViewingPhoto(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setViewingPhoto(null)
            }}
            className="fixed top-4 right-4 z-[10000] w-12 h-12 bg-white/30 hover:bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-white transition shadow-lg"
            aria-label="Tutup"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div
            className="w-full h-full flex flex-col items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewingPhoto.avatar_url}
              alt={viewingPhoto.nama_lengkap}
              className="max-w-full max-h-[75vh] rounded-2xl shadow-2xl object-contain"
            />
            <div className="mt-4 text-center">
              <p className="text-white font-semibold text-lg">{viewingPhoto.nama_lengkap}</p>
              <p className="text-white/70 text-sm mt-1">{viewingPhoto.email}</p>
              <div className="mt-2 inline-flex items-center gap-1 bg-white/20 backdrop-blur border border-white/30 rounded-full px-3 py-1">
                <span className="text-[11px] text-white font-medium">
                  {viewingPhoto.role === 'admin' ? '👑 Admin' : '👤 Karyawan'}
                </span>
              </div>
              <p className="text-white/50 text-xs mt-3">
                Klik di luar foto atau tekan ESC untuk menutup
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}