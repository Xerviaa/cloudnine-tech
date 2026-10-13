'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import EditUserModal from '@/components/EditUserModal'

type Profile = {
  id: string
  nama_lengkap: string
  email: string
  role: 'karyawan' | 'admin'
}

type AttendanceLog = {
  id: number
  user_id: string
  tipe: 'masuk' | 'keluar'
  waktu_absen: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  profiles: { nama_lengkap: string; email: string } | null
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
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
      setLoading(false)
    }
    checkAdmin()
  }, [])

  useEffect(() => {
    if (profile) loadData()
  }, [profile, filterDate])

  async function loadData() {
    const { data: usersData } = await supabase
      .from('profiles').select('*').order('nama_lengkap')
    setUsers(usersData || [])

    const start = new Date(filterDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(filterDate)
    end.setHours(23, 59, 59, 999)

    const { data: logsData } = await supabase
      .from('attendance_logs')
      .select(`id, user_id, tipe, waktu_absen, latitude, longitude, accuracy, profiles (nama_lengkap, email)`)
      .gte('waktu_absen', start.toISOString())
      .lte('waktu_absen', end.toISOString())
      .order('waktu_absen', { ascending: false })

    setLogs((logsData as any) || [])
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSaveUser(
    id: string,
    data: { nama_lengkap: string; role: 'karyawan' | 'admin' }
  ) {
    const { error } = await supabase.from('profiles').update(data).eq('id', id)
    if (error) throw new Error(error.message)
    await loadData()
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
      await loadData()
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message)
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Memuat data admin...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background subtle */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl" />
      </div>

      {/* Navbar Glass */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur-md opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🏢</span>
              </div>
            </div>
            <div>
              <p className="text-slate-800 font-bold text-lg leading-tight">KantorAbsensi</p>
              <p className="text-slate-500 text-xs">Panel Admin</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/absen"
              className="text-slate-700 hover:text-indigo-700 text-sm bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-4 py-2 rounded-lg transition font-medium"
            >
              Halaman Absen
            </Link>
            <button
              onClick={handleLogout}
              className="text-slate-700 hover:text-rose-700 text-sm bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-4 py-2 rounded-lg transition font-medium"
            >
              Logout
            </button>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full blur opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-lg">
                {profile?.nama_lengkap ? getInitials(profile.nama_lengkap) : 'A'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1 mb-3 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-600">Panel Admin Aktif</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
            Selamat datang, {profile?.nama_lengkap} 👋
          </h1>
          <p className="text-slate-500 mt-2">Berikut ringkasan absensi dan data karyawan hari ini</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="group relative bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 rounded-2xl p-6 shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/40 transition-all hover:-translate-y-1 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-white/90 text-sm font-medium">Total Karyawan</p>
                <p className="text-white text-5xl font-bold mt-2 drop-shadow-sm">{users.length}</p>
                <p className="text-white/70 text-xs mt-2">orang terdaftar</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-2xl shadow-lg">
                👥
              </div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 rounded-2xl p-6 shadow-xl shadow-violet-500/25 hover:shadow-2xl hover:shadow-violet-500/40 transition-all hover:-translate-y-1 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-white/90 text-sm font-medium">Absen Tanggal Ini</p>
                <p className="text-white text-5xl font-bold mt-2 drop-shadow-sm">{logs.length}</p>
                <p className="text-white/70 text-xs mt-2">catatan absensi</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-2xl shadow-lg">
                📋
              </div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-6 shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/40 transition-all hover:-translate-y-1 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-white/90 text-sm font-medium">Sudah Masuk</p>
                <p className="text-white text-5xl font-bold mt-2 drop-shadow-sm">
                  {logs.filter((l) => l.tipe === 'masuk').length}
                </p>
                <p className="text-white/70 text-xs mt-2">dari {users.length} karyawan</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-2xl shadow-lg">
                ✅
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tanggal */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-500/30">
              📅
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block">Filter Tanggal</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="mt-0.5 px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-medium"
              />
            </div>
          </div>
        </div>

        {/* Tabel Absensi */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-violet-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                📋
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Absensi — {new Date(filterDate).toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{logs.length} catatan absensi</p>
              </div>
            </div>
            {logs.length > 0 && (
              <span className="text-xs font-medium bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full shadow-sm">
                {logs.length} data
              </span>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-6xl mb-3 opacity-40">📭</p>
              <p className="text-slate-500 text-sm font-medium">Belum ada absensi pada tanggal ini</p>
              <p className="text-slate-400 text-xs mt-1">Coba ubah filter tanggal di atas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left border-b border-slate-100">
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Nama</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Tipe</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Waktu</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Lokasi</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-slate-100 hover:bg-indigo-50/40 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {log.profiles?.nama_lengkap ? getInitials(log.profiles.nama_lengkap) : '?'}
                          </div>
                          <span className="font-medium text-slate-800">{log.profiles?.nama_lengkap || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{log.profiles?.email || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          log.tipe === 'masuk'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            log.tipe === 'masuk' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`} />
                          {log.tipe === 'masuk' ? 'Masuk' : 'Keluar'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-700 font-medium">
                        {new Date(log.waktu_absen).toLocaleTimeString('id-ID')}
                      </td>
                      <td className="px-6 py-4">
                        {log.latitude && log.longitude ? (
                          <div className="flex flex-col gap-1">
                            <a
                              href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-white bg-sky-50 hover:bg-sky-600 border border-sky-200 hover:border-sky-600 px-3 py-1.5 rounded-lg transition"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                                <circle cx="12" cy="10" r="3"/>
                              </svg>
                              Lihat Peta
                            </a>
                            {log.accuracy && (
                              <p className="text-[10px] text-slate-400 pl-1">
                                Akurasi ± {log.accuracy.toFixed(0)}m
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Tidak ada lokasi</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Daftar Karyawan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50/50 to-fuchsia-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
                👥
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Daftar Karyawan</h2>
                <p className="text-xs text-slate-500 mt-0.5">{users.length} orang terdaftar</p>
              </div>
            </div>
            <span className="text-xs font-medium bg-white border border-violet-200 text-violet-700 px-3 py-1.5 rounded-full shadow-sm">
              {users.length} akun
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-100">
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Karyawan</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100 hover:bg-violet-50/40 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ${
                          u.role === 'admin'
                            ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/30'
                            : 'bg-gradient-to-br from-sky-500 to-cyan-500 shadow-sky-500/30'
                        }`}>
                          {getInitials(u.nama_lengkap)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{u.nama_lengkap}</p>
                          {u.id === profile?.id && (
                            <p className="text-[10px] text-indigo-600 font-medium">Anda</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{u.email}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Edit */}
      <EditUserModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSave={handleSaveUser}
      />
    </main>
  )
}