'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  nama_lengkap: string
  email: string
  role: 'karyawan' | 'admin'
  avatar_url: string | null
}

type Schedule = {
  id: number
  user_id: string
  tanggal: string
  tipe: 'libur' | 'kerja' | 'lembur'
}

type SwapRequest = {
  id: number
  user_id: string
  tanggal_libur_asal: string
  tanggal_libur_pengganti: string
  alasan: string
  status: 'pending' | 'disetujui' | 'ditolak'
  catatan_admin: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export default function JadwalSayaPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Filter bulan
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [tanggalAsal, setTanggalAsal] = useState('')
  const [tanggalPengganti, setTanggalPengganti] = useState('')
  const [alasan, setAlasan] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (!profileData) {
        router.push('/login')
        return
      }
      setProfile(profileData)

      await Promise.all([
        loadSchedules(user.id),
        loadSwaps(user.id),
      ])
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (profile) loadSchedules(profile.id)
  }, [selectedMonth, profile])

  async function loadSchedules(userId: string) {
    const [year, month] = selectedMonth.split('-').map(Number)
    const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data } = await supabase
      .from('employee_schedules')
      .select('*')
      .eq('user_id', userId)
      .gte('tanggal', firstDayStr)
      .lte('tanggal', lastDayStr)

    setSchedules((data as any) || [])
  }

  async function loadSwaps(userId: string) {
    const { data } = await supabase
      .from('shift_swap_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    setSwaps((data as any) || [])
  }

  // ============================================================
  // FIX: calendarDays return array of string YYYY-MM-DD atau null
  // ============================================================
  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDayOfWeek = firstDay.getDay()
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

    const days: (string | null)[] = []
    for (let i = 0; i < startOffset; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    return days
  }, [selectedMonth])

  function isWeekend(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dateObj = new Date(y, m - 1, d)
    const day = dateObj.getDay()
    return day === 0 || day === 6
  }

  function getScheduleForDate(dateStr: string): Schedule | null {
    return schedules.find((s) => s.tanggal === dateStr) || null
  }

  // Ambil semua hari libur di bulan ini (untuk info referensi)
  const hariLiburBulanIni = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const liburList: { id: string; tanggal: string }[] = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const sch = schedules.find((s) => s.tanggal === dateStr)
      
      let isLibur = false
      if (sch) {
        isLibur = sch.tipe === 'libur'
      } else {
        isLibur = isWeekend(dateStr)
      }

      if (isLibur) {
        liburList.push({
          id: dateStr,
          tanggal: dateStr
        })
      }
    }

    return liburList
  }, [schedules, selectedMonth])

  function isLibur(dateStr: string): boolean {
    const sch = schedules.find((s) => s.tanggal === dateStr)
    if (!sch) {
      return isWeekend(dateStr)
    }
    return sch.tipe === 'libur'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    if (!tanggalAsal || !tanggalPengganti) {
      alert('Tanggal libur asal & pengganti harus diisi.')
      return
    }
    if (tanggalAsal === tanggalPengganti) {
      alert('Tanggal asal dan pengganti tidak boleh sama.')
      return
    }
    if (!alasan.trim() || alasan.length < 10) {
      alert('Alasan minimal 10 karakter.')
      return
    }
    if (!isLibur(tanggalAsal)) {
      alert('Tanggal asal harus hari libur Anda. Silakan cek info hari libur di bawah form.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('shift_swap_requests').insert({
        user_id: profile.id,
        tanggal_libur_asal: tanggalAsal,
        tanggal_libur_pengganti: tanggalPengganti,
        alasan: alasan.trim(),
      })

      if (error) {
        alert('Gagal mengajukan: ' + error.message)
        setSubmitting(false)
        return
      }

      alert('✅ Pengajuan tukar libur berhasil dikirim! Menunggu persetujuan admin.')
      setShowForm(false)
      setTanggalAsal('')
      setTanggalPengganti('')
      setAlasan('')
      await loadSwaps(profile.id)
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteSwap(id: number) {
    if (!confirm('Yakin ingin membatalkan pengajuan tukar libur ini?')) return
    const { error } = await supabase.from('shift_swap_requests').delete().eq('id', id)
    if (error) {
      alert('Gagal hapus: ' + error.message)
      return
    }
    if (profile) await loadSwaps(profile.id)
  }

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    const dateObj = new Date(y, m - 1, d)
    return dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const statusConfig = {
    pending: { label: 'Menunggu', emoji: '⏳', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
    disetujui: { label: 'Disetujui', emoji: '✅', badge: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    ditolak: { label: 'Ditolak', emoji: '❌', badge: 'bg-rose-100 text-rose-700 border-rose-300' },
  }

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = -1; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      opts.push({ value: val, label })
    }
    return opts
  }, [])

  const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

  if (loading || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Memuat jadwal...</p>
        </div>
      </main>
    )
  }

  const stats = {
    libur: schedules.filter((s) => s.tipe === 'libur').length,
    kerja: schedules.filter((s) => s.tipe === 'kerja').length,
    lembur: schedules.filter((s) => s.tipe === 'lembur').length,
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/absen" className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur-md opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🏢</span>
              </div>
            </div>
            <div>
              <p className="text-slate-800 font-bold text-lg leading-tight">AbsenKita</p>
              <p className="text-slate-500 text-xs">Jadwal Saya</p>
            </div>
          </Link>

          <Link
            href="/absen"
            className="text-slate-700 hover:text-indigo-700 text-sm bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-4 py-2 rounded-lg transition font-medium"
          >
            ← Kembali
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            📅 Jadwal Saya
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Lihat jadwal libur/kerja Anda & ajukan tukar libur
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-4 shadow-lg shadow-blue-500/25">
            <p className="text-xs text-white/90 font-medium">🏖️ Libur</p>
            <p className="text-3xl font-bold text-white mt-1">{stats.libur}</p>
            <p className="text-[10px] text-white/70">hari</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-4 shadow-lg shadow-emerald-500/25">
            <p className="text-xs text-white/90 font-medium">💼 Kerja</p>
            <p className="text-3xl font-bold text-white mt-1">{stats.kerja}</p>
            <p className="text-[10px] text-white/70">hari</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-4 shadow-lg shadow-orange-500/25">
            <p className="text-xs text-white/90 font-medium">⚡ Lembur</p>
            <p className="text-3xl font-bold text-white mt-1">{stats.lembur}</p>
            <p className="text-[10px] text-white/70">hari</p>
          </div>
        </div>

        {/* Filter Bulan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                📅
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block">Bulan</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="mt-0.5 px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium cursor-pointer"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => setShowForm(!showForm)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-white font-semibold text-sm rounded-xl shadow-lg transition-all hover:scale-[1.02] ${
                showForm
                  ? 'bg-gradient-to-r from-slate-500 to-slate-600'
                  : 'bg-gradient-to-r from-indigo-500 to-violet-600'
              }`}
            >
              {showForm ? '✕ Tutup' : '🔄 Ajukan Tukar Libur'}
            </button>
          </div>
        </div>

        {/* Form Tukar Libur */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">🔄 Form Tukar Libur</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tanggal Libur Asal - Date Picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tanggal Libur Asal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={tanggalAsal}
                  onChange={(e) => setTanggalAsal(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Pilih tanggal libur Anda yang ingin ditukar (harus hari libur)
                </p>
                
                {/* Info libur bulan ini sebagai referensi */}
                {hariLiburBulanIni.length > 0 && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <p className="text-[10px] text-blue-700 font-semibold mb-1">📅 Hari libur Anda bulan ini:</p>
                    <div className="flex flex-wrap gap-1">
                      {hariLiburBulanIni.map((s) => {
                        const [y, m, d] = s.tanggal.split('-').map(Number)
                        const dateObj = new Date(y, m - 1, d)
                        return (
                          <span key={s.id} className="text-[10px] bg-white border border-blue-300 text-blue-800 px-1.5 py-0.5 rounded">
                            {d} {dateObj.toLocaleDateString('id-ID', { weekday: 'short' })}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Tanggal Libur Pengganti - Date Picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tanggal Libur Pengganti <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={tanggalPengganti}
                  onChange={(e) => setTanggalPengganti(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tanggal libur pengganti yang Anda inginkan (bebas pilih tanggal)
                </p>
              </div>

              {/* Alasan */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Alasan <span className="text-rose-500">*</span> <span className="text-slate-400 font-normal">(min. 10 karakter)</span>
                </label>
                <textarea
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  disabled={submitting}
                  placeholder="Contoh: Ada acara keluarga di hari libur saya, mohon tukar ke hari lain..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">{alasan.length} karakter</p>
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <span className="text-amber-600 text-lg">💡</span>
                <p className="text-xs text-amber-700 leading-snug">
                  <strong>Penting:</strong> Tanggal Libur Asal <strong>harus hari libur Anda</strong> (lihat info di atas). Kalau salah pilih, pengajuan akan ditolak sistem. Admin yang akan approve/reject tukar libur ini.
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 rounded-lg font-semibold shadow-lg inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Mengirim...' : '📤 Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Kalender */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {dayNames.map((day, idx) => (
              <div key={day} className={`text-center text-[10px] font-bold uppercase py-1 ${idx >= 5 ? 'text-rose-500' : 'text-slate-500'}`}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((dateStr, idx) => {
              if (!dateStr) return <div key={`empty-${idx}`} className="aspect-square" />

              const [y, m, d] = dateStr.split('-').map(Number)
              const sch = getScheduleForDate(dateStr)
              const isToday = dateStr === todayStr

              let bg = 'bg-slate-50 border-slate-200 text-slate-400'
              let icon = ''

              if (sch) {
                if (sch.tipe === 'libur') {
                  bg = 'bg-blue-100 border-blue-300 text-blue-800'
                  icon = '🏖️'
                } else if (sch.tipe === 'kerja') {
                  bg = 'bg-emerald-100 border-emerald-300 text-emerald-800'
                  icon = '💼'
                } else if (sch.tipe === 'lembur') {
                  bg = 'bg-orange-100 border-orange-300 text-orange-800'
                  icon = '⚡'
                }
              }

              return (
                <div
                  key={dateStr}
                  className={`aspect-square rounded-lg border-2 ${bg} p-1.5 flex flex-col items-center justify-center text-center ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                >
                  <span className={`text-sm font-bold ${isToday ? 'text-indigo-700' : ''}`}>
                    {d}
                  </span>
                  {icon && <span className="text-base mt-0.5">{icon}</span>}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 flex-wrap text-xs pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
              <span className="text-slate-600">Libur</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
              <span className="text-slate-600">Kerja</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300" />
              <span className="text-slate-600">Lembur</span>
            </div>
          </div>
        </div>

        {/* Riwayat Pengajuan Tukar Libur */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-violet-50/50">
            <h2 className="text-base font-bold text-slate-800">🔄 Riwayat Tukar Libur</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {swaps.length} pengajuan total
            </p>
          </div>

          {swaps.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-5xl mb-3 opacity-40">📭</p>
              <p className="text-slate-500 text-sm font-medium">Belum ada pengajuan tukar libur</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {swaps.map((s) => {
                const cfg = statusConfig[s.status]
                return (
                  <div key={s.id} className="p-5 hover:bg-slate-50/50 transition">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.badge} mb-2`}>
                          {cfg.emoji} {cfg.label}
                        </span>

                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="text-slate-600">Dari:</span>
                          <span className="font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                            {formatDate(s.tanggal_libur_asal)}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="text-slate-600">Ke:</span>
                          <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            {formatDate(s.tanggal_libur_pengganti)}
                          </span>
                        </div>

                        <p className="text-sm text-slate-600 mt-2">{s.alasan}</p>

                        {s.catatan_admin && (
                          <div className={`mt-2 border-l-2 pl-3 py-2 rounded-r ${
                            s.status === 'disetujui' ? 'bg-emerald-50 border-emerald-400' : 'bg-rose-50 border-rose-400'
                          }`}>
                            <p className="text-[10px] text-slate-500 font-medium">Catatan Admin:</p>
                            <p className="text-xs text-slate-700 italic">"{s.catatan_admin}"</p>
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400 mt-2">
                          Diajukan: {formatDateTime(s.created_at)}
                        </p>
                      </div>

                      {s.status === 'pending' && (
                        <button
                          onClick={() => handleDeleteSwap(s.id)}
                          className="text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0"
                        >
                          🗑️ Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1 text-xs text-indigo-800 space-y-1">
              <p className="font-semibold">Cara Kerja Tukar Libur:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Pilih tanggal libur Anda yang ingin ditukar</li>
                <li>Pilih tanggal libur pengganti yang Anda inginkan</li>
                <li>Berikan alasan yang jelas</li>
                <li>Admin akan memutuskan approve/reject</li>
                <li>Kalau disetujui, jadwal libur otomatis berubah</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}