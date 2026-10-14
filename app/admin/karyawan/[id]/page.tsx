'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { getKeteranganMasuk, getKeteranganKeluar } from '@/lib/utils/attendance'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

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

type TipeAbsen = 'masuk' | 'keluar' | 'istirahat_mulai' | 'istirahat_selesai'

type AttendanceLog = {
  id: number
  user_id: string
  tipe: TipeAbsen
  waktu_absen: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  is_terlambat: boolean
}

type DailyRecord = {
  date: string
  dateObj: Date
  masuk: AttendanceLog | null
  keluar: AttendanceLog | null
  istirahatMulai: AttendanceLog | null
  istirahatSelesai: AttendanceLog | null
  status: 'lengkap' | 'belum_keluar' | 'lupa_absen_keluar' | 'belum_absen' | 'libur'
}

export default function KaryawanDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [exporting, setExporting] = useState(false)

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const supabase = createClient()

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: adminData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (!adminData || adminData.role !== 'admin') {
        alert('Akses ditolak.')
        router.push('/absen')
        return
      }

      if (!userId) return

      const { data: targetUser } = await supabase
        .from('profiles').select('*').eq('id', userId).single()

      if (!targetUser) {
        alert('Karyawan tidak ditemukan.')
        router.push('/admin')
        return
      }
      setProfile(targetUser)
      setLoading(false)
    }
    checkAdmin()
  }, [userId])

  useEffect(() => {
    if (!userId || !profile) return
    loadLogs()
  }, [userId, profile, selectedMonth])

  async function loadLogs() {
    const [year, month] = selectedMonth.split('-').map(Number)
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const end = new Date(year, month, 0, 23, 59, 59, 999)

    const { data } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('waktu_absen', start.toISOString())
      .lte('waktu_absen', end.toISOString())
      .order('waktu_absen', { ascending: true })

    setLogs((data as any) || [])
  }

  const dailyRecords: DailyRecord[] = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const records: DailyRecord[] = []

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day)
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

      const dayLogs = logs.filter((l) => {
        const d = new Date(l.waktu_absen)
        return d.getDate() === day && d.getMonth() === month - 1 && d.getFullYear() === year
      })

      const masuk = dayLogs.find((l) => l.tipe === 'masuk') || null
      const keluar = dayLogs.find((l) => l.tipe === 'keluar') || null
      const istirahatMulai = dayLogs.find((l) => l.tipe === 'istirahat_mulai') || null
      const istirahatSelesai = dayLogs.find((l) => l.tipe === 'istirahat_selesai') || null

      let status: DailyRecord['status'] = 'belum_absen'
      if (isWeekend && !masuk) status = 'libur'
      else if (masuk && keluar) status = 'lengkap'
      else if (masuk && keluar?.is_terlambat) status = 'lupa_absen_keluar'
      else if (masuk) status = 'belum_keluar'

      records.push({
        date: dateStr,
        dateObj,
        masuk,
        keluar,
        istirahatMulai,
        istirahatSelesai,
        status,
      })
    }

    return records
  }, [logs, selectedMonth])

  const stats = useMemo(() => {
    const totalHadir = dailyRecords.filter((r) => r.masuk).length
    const totalTelat = dailyRecords.filter((r) => r.masuk?.is_terlambat).length
    const totalLupaAbsen = dailyRecords.filter((r) => r.status === 'lupa_absen_keluar').length
    const totalBelumAbsen = dailyRecords.filter(
      (r) => r.status === 'belum_absen' && r.dateObj.getDay() !== 0 && r.dateObj.getDay() !== 6
    ).length
    const totalLengkap = dailyRecords.filter((r) => r.status === 'lengkap').length
    return { totalHadir, totalTelat, totalLupaAbsen, totalBelumAbsen, totalLengkap }
  }, [dailyRecords])

  const weeklyChartData = useMemo(() => {
    const weeks: { name: string; hadir: number; telat: number; lupa: number; belum: number }[] = []
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()

    let weekIndex = 1
    let weekData = { name: '', hadir: 0, telat: 0, lupa: 0, belum: 0 }

    for (let day = 1; day <= daysInMonth; day++) {
      const rec = dailyRecords.find((r) => r.dateObj.getDate() === day)
      if (!rec) continue

      if (rec.masuk) weekData.hadir++
      if (rec.masuk?.is_terlambat) weekData.telat++
      if (rec.status === 'lupa_absen_keluar') weekData.lupa++
      if (rec.status === 'belum_absen' && rec.dateObj.getDay() !== 0 && rec.dateObj.getDay() !== 6) weekData.belum++

      if (rec.dateObj.getDay() === 0 || day === daysInMonth) {
        weekData.name = `Minggu ${weekIndex}`
        weeks.push({ ...weekData })
        weekIndex++
        weekData = { name: '', hadir: 0, telat: 0, lupa: 0, belum: 0 }
      }
    }

    return weeks
  }, [dailyRecords, selectedMonth])

  const pieData = useMemo(() => {
    return [
      { name: 'Lengkap', value: stats.totalLengkap, color: '#10b981' },
      { name: 'Terlambat', value: stats.totalTelat, color: '#f59e0b' },
      { name: 'Lupa Absen', value: stats.totalLupaAbsen, color: '#f97316' },
      { name: 'Belum Absen', value: stats.totalBelumAbsen, color: '#94a3b8' },
    ].filter((d) => d.value > 0)
  }, [stats])

  async function handleExportPersonal() {
    if (!profile) return
    setExporting(true)
    try {
      const headers = [
        'Tanggal', 'Hari', 'Masuk', 'Istirahat Mulai', 'Istirahat Selesai',
        'Keluar', 'Status', 'Keterangan Masuk', 'Keterangan Keluar',
      ]

      const statusLabel: Record<string, string> = {
        lengkap: 'Lengkap',
        belum_keluar: 'Belum Keluar',
        lupa_absen_keluar: 'Lupa Absen Keluar',
        belum_absen: 'Belum Absen',
        libur: 'Libur',
      }

      const rows = dailyRecords.map((r) => {
        const ketMasuk = getKeteranganMasuk(r.masuk)?.detail || '-'
        const ketKeluar = getKeteranganKeluar(r.keluar)?.detail || '-'

        return [
          r.dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          r.dateObj.toLocaleDateString('id-ID', { weekday: 'long' }),
          r.masuk ? new Date(r.masuk.waktu_absen).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) : '-',
          r.istirahatMulai ? new Date(r.istirahatMulai.waktu_absen).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) : '-',
          r.istirahatSelesai ? new Date(r.istirahatSelesai.waktu_absen).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) : '-',
          r.keluar ? new Date(r.keluar.waktu_absen).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) : '-',
          statusLabel[r.status] || r.status,
          ketMasuk,
          ketKeluar,
        ]
      })

      const aoa = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
        { wch: 10 }, { wch: 18 }, { wch: 22 }, { wch: 22 },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap')

      const summaryData = [
        ['Nama', profile.nama_lengkap],
        ['Email', profile.email],
        ['Bulan', selectedMonth],
        ['', ''],
        ['Total Hadir', stats.totalHadir],
        ['Total Lengkap', stats.totalLengkap],
        ['Total Terlambat', stats.totalTelat],
        ['Total Lupa Absen Keluar', stats.totalLupaAbsen],
        ['Total Belum Absen', stats.totalBelumAbsen],
      ]
      const ws2 = XLSX.utils.aoa_to_sheet(summaryData)
      ws2['!cols'] = [{ wch: 25 }, { wch: 30 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'Summary')

      const filename = `rekap_${profile.nama_lengkap.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`
      XLSX.writeFile(wb, filename)

      alert(`✅ Berhasil export rekap ${profile.nama_lengkap} bulan ${selectedMonth}.`)
    } catch (err: any) {
      alert('Gagal export: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--'
    return new Date(iso).toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatAlamat = (u: Profile) => {
    const jalan = u.alamat_jalan || ''
    const wilayah = [u.kelurahan, u.kecamatan, u.kabupaten].filter(Boolean).join(', ')
    return { jalan, wilayah }
  }

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      opts.push({ value: val, label })
    }
    return opts
  }, [])

  if (loading || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Memuat data karyawan...</p>
        </div>
      </main>
    )
  }

  const { jalan, wilayah } = formatAlamat(profile)

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur-md opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🏢</span>
              </div>
            </div>
            <div>
              <p className="text-slate-800 font-bold text-lg leading-tight">AbsenKita</p>
              <p className="text-slate-500 text-xs">Detail Karyawan</p>
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
        {/* Card Profil */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.nama_lengkap}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-lg shrink-0"
              />
            ) : (
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0 ${
                profile.role === 'admin'
                  ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600'
                  : 'bg-gradient-to-br from-sky-500 to-cyan-500'
              }`}>
                {getInitials(profile.nama_lengkap)}
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-800">{profile.nama_lengkap}</h1>
              <p className="text-sm text-slate-500 mt-1">{profile.email}</p>

              <span className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                profile.role === 'admin'
                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}>
                {profile.role === 'admin' ? '👑 Admin' : '👤 Karyawan'}
              </span>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 text-sm mt-0.5">📱</span>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Nomor HP</p>
                    <p className="text-sm text-slate-700 font-medium">{profile.nomor_hp || 'Belum diisi'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 text-sm mt-0.5">📍</span>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Alamat</p>
                    <p className="text-sm text-slate-700 font-medium leading-snug">
                      {jalan && <span>{jalan}<br /></span>}
                      {wilayah || 'Belum diisi'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bulan & Export */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg">
                📅
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block">Pilih Bulan</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="mt-0.5 px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-medium cursor-pointer"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleExportPersonal}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" x2="12" y1="15" y2="3"/>
              </svg>
              {exporting ? 'Menyiapkan...' : 'Export Rekap Bulan Ini'}
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-5 shadow-lg shadow-emerald-500/25">
            <p className="text-white/90 text-xs font-medium">Total Hadir</p>
            <p className="text-white text-3xl font-bold mt-1 drop-shadow-sm">{stats.totalHadir}</p>
            <p className="text-white/70 text-[10px] mt-1">hari dalam bulan ini</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 shadow-lg shadow-amber-500/25">
            <p className="text-white/90 text-xs font-medium">Terlambat</p>
            <p className="text-white text-3xl font-bold mt-1 drop-shadow-sm">{stats.totalTelat}</p>
            <p className="text-white/70 text-[10px] mt-1">kali masuk telat</p>
          </div>
          <div className="bg-gradient-to-br from-rose-500 to-pink-500 rounded-2xl p-5 shadow-lg shadow-rose-500/25">
            <p className="text-white/90 text-xs font-medium">Lupa Absen</p>
            <p className="text-white text-3xl font-bold mt-1 drop-shadow-sm">{stats.totalLupaAbsen}</p>
            <p className="text-white/70 text-[10px] mt-1">lupa absen keluar</p>
          </div>
          <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-2xl p-5 shadow-lg shadow-slate-500/25">
            <p className="text-white/90 text-xs font-medium">Belum Absen</p>
            <p className="text-white text-3xl font-bold mt-1 drop-shadow-sm">{stats.totalBelumAbsen}</p>
            <p className="text-white/70 text-[10px] mt-1">hari kerja tanpa absen</p>
          </div>
        </div>

        {/* Grafik */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                📊
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Kehadiran Per Minggu</h2>
                <p className="text-xs text-slate-500">Rekap mingguan bulan {selectedMonth}</p>
              </div>
            </div>
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="hadir" fill="#10b981" name="Hadir" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="telat" fill="#f59e0b" name="Telat" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lupa" fill="#f97316" name="Lupa Absen" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="belum" fill="#94a3b8" name="Belum Absen" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                🥧
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Distribusi Status</h2>
                <p className="text-xs text-slate-500">Perbandingan hari</p>
              </div>
            </div>
            {pieData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center">
                <p className="text-slate-400 text-sm">Belum ada data</p>
              </div>
            ) : (
              <div className="w-full h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-2 space-y-1.5">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-600">{d.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{d.value} hari</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabel Riwayat Harian */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-violet-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                📋
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Riwayat Absensi Harian</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bulan {monthOptions.find((m) => m.value === selectedMonth)?.label} — {dailyRecords.length} hari
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-100">
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Hari</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Masuk</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Istirahat</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Selesai</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Keluar</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {dailyRecords.map((r) => {
                  const dayName = r.dateObj.toLocaleDateString('id-ID', { weekday: 'short' })
                  const dateStr = r.dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
                  const isWeekend = r.dateObj.getDay() === 0 || r.dateObj.getDay() === 6

                  return (
                    <tr
                      key={r.date}
                      className={`border-t border-slate-100 transition ${
                        isWeekend ? 'bg-slate-50/50' : 'hover:bg-indigo-50/30'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-slate-700">{dateStr}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${isWeekend ? 'text-rose-500' : 'text-slate-600'}`}>
                          {dayName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.masuk ? (
                          <span className={`inline-flex items-center gap-1 font-mono text-xs font-medium px-2 py-1 rounded-lg border ${
                            r.masuk.is_terlambat
                              ? 'text-amber-700 bg-amber-50 border-amber-200'
                              : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          }`}>
                            {formatTime(r.masuk.waktu_absen)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">--:--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.istirahatMulai ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                            ☕ {formatTime(r.istirahatMulai.waktu_absen)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">--:--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.istirahatSelesai ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg">
                            💪 {formatTime(r.istirahatSelesai.waktu_absen)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">--:--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.keluar ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                            {formatTime(r.keluar.waktu_absen)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">--:--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'lengkap' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                            ✅ Lengkap
                          </span>
                        )}
                        {r.status === 'belum_keluar' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
                            🟡 Belum Keluar
                          </span>
                        )}
                        {r.status === 'lupa_absen_keluar' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300">
                            🟠 Lupa Keluar
                          </span>
                        )}
                        {r.status === 'belum_absen' && !isWeekend && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300">
                            ⚪ Belum Absen
                          </span>
                        )}
                        {r.status === 'libur' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
                            🏖️ Libur
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}