'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import EditUserModal from '@/components/EditUserModal'
import AvatarDropdown from '@/components/AvatarDropdown'
import * as XLSX from 'xlsx'
import { LABEL_JAM } from '@/lib/config/jam-kantor'
import { getKeteranganMasuk, getKeteranganKeluar } from '@/lib/utils/attendance'

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

type UserAttendance = {
  user: Profile
  masuk: AttendanceLog | null
  keluar: AttendanceLog | null
  menyusul: AttendanceLog | null
  istirahatMulai: AttendanceLog | null
  istirahatSelesai: AttendanceLog | null
  status: 'belum_absen' | 'belum_keluar' | 'lengkap' | 'lupa_absen_keluar'
}

function pairMasukKeluar(logs: AttendanceLog[]): Map<number, AttendanceLog | null> {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.waktu_absen).getTime() - new Date(b.waktu_absen).getTime()
  )

  const queueMasuk: AttendanceLog[] = []
  const pasangan = new Map<number, AttendanceLog | null>()

  for (const log of sorted) {
    if (log.tipe === 'masuk') {
      queueMasuk.push(log)
      pasangan.set(log.id, null)
    } else if (log.tipe === 'keluar') {
      const masukTerpasang = queueMasuk.shift()
      if (masukTerpasang) {
        pasangan.set(masukTerpasang.id, log)
      }
    }
  }

  return pasangan
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [rawLogs, setRawLogs] = useState<AttendanceLog[]>([])
  const [allLogs, setAllLogs] = useState<AttendanceLog[]>([])
  const [attendance, setAttendance] = useState<UserAttendance[]>([])
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [exporting, setExporting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [viewingPhoto, setViewingPhoto] = useState<Profile | null>(null)

  // ============================================================
  // TAMBAHAN: State untuk jumlah pengajuan izin pending
  // ============================================================
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0)

  const [searchKaryawan, setSearchKaryawan] = useState('')
  const [filterRole, setFilterRole] = useState<'semua' | 'admin' | 'karyawan'>('semua')
  const [searchAbsensi, setSearchAbsensi] = useState('')
  const [filterStatus, setFilterStatus] = useState<'semua' | 'lengkap' | 'belum_keluar' | 'lupa_absen_keluar' | 'belum_absen'>('semua')

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportStartDate, setExportStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d.toISOString().split('T')[0]
  })
  const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().split('T')[0])
  const [exportTipe, setExportTipe] = useState<'semua' | TipeAbsen>('semua')

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

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setViewingPhoto(null)
        setShowExportModal(false)
      }
    }
    if (viewingPhoto || showExportModal) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [viewingPhoto, showExportModal])

  useEffect(() => {
    if (viewingPhoto || showExportModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [viewingPhoto, showExportModal])

  useEffect(() => {
    if (!users.length) {
      setAttendance([])
      return
    }

    const start = new Date(filterDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(filterDate)
    end.setHours(23, 59, 59, 999)

    const todayLogs = rawLogs.filter((log) => {
      const t = new Date(log.waktu_absen).getTime()
      return t >= start.getTime() && t <= end.getTime()
    })

    const grouped: UserAttendance[] = users.map((u) => {
      const userAllLogs = allLogs.filter((l) => l.user_id === u.id)
      const pasangan = pairMasukKeluar(userAllLogs)

      const masuk = todayLogs.find((l) => l.user_id === u.id && l.tipe === 'masuk') || null
      const istirahatMulai = todayLogs.find((l) => l.user_id === u.id && l.tipe === 'istirahat_mulai') || null
      const istirahatSelesai = todayLogs.find((l) => l.user_id === u.id && l.tipe === 'istirahat_selesai') || null

      let keluar: AttendanceLog | null = null
      let menyusul: AttendanceLog | null = null

      if (masuk) {
        const pasanganLog = pasangan.get(masuk.id) || null
        if (pasanganLog) {
          if (!pasanganLog.is_terlambat) {
            keluar = pasanganLog
          } else {
            menyusul = pasanganLog
          }
        }
      }

      let status: UserAttendance['status'] = 'belum_absen'
      if (masuk && keluar) status = 'lengkap'
      else if (masuk && menyusul) status = 'lupa_absen_keluar'
      else if (masuk) status = 'belum_keluar'
      else status = 'belum_absen'

      return { user: u, masuk, keluar, menyusul, istirahatMulai, istirahatSelesai, status }
    })

    setAttendance(grouped)
  }, [users, rawLogs, allLogs, filterDate])

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
      .select('*')
      .gte('waktu_absen', start.toISOString())
      .lte('waktu_absen', end.toISOString())
      .order('waktu_absen', { ascending: true })

    setRawLogs((logsData as any) || [])

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: allLogsData } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('waktu_absen', thirtyDaysAgo.toISOString())
      .order('waktu_absen', { ascending: true })

    setAllLogs((allLogsData as any) || [])

    // ============================================================
    // TAMBAHAN: Hitung jumlah pengajuan izin yang pending
    // ============================================================
    const { count: pendingCount } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    setPendingLeaveCount(pendingCount || 0)
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = u.nama_lengkap.toLowerCase().includes(searchKaryawan.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchKaryawan.toLowerCase())
      const matchRole = filterRole === 'semua' || u.role === filterRole
      return matchSearch && matchRole
    })
  }, [users, searchKaryawan, filterRole])

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      const matchSearch = a.user.nama_lengkap.toLowerCase().includes(searchAbsensi.toLowerCase())
      const matchStatus = filterStatus === 'semua' || a.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [attendance, searchAbsensi, filterStatus])

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

  async function handleCopyPhone(userId: string, phone: string) {
    try {
      await navigator.clipboard.writeText(phone)
      setCopiedId(userId)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (err) {
      alert('Gagal menyalin nomor HP')
    }
  }

  async function handleExportCustom() {
    setExporting(true)
    try {
      const start = new Date(exportStartDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(exportEndDate)
      end.setHours(23, 59, 59, 999)

      if (start > end) {
        alert('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.')
        setExporting(false)
        return
      }

      let query = supabase
        .from('attendance_logs')
        .select(`id, tipe, waktu_absen, latitude, longitude, accuracy, is_terlambat, profiles (nama_lengkap, email)`)
        .gte('waktu_absen', start.toISOString())
        .lte('waktu_absen', end.toISOString())

      if (exportTipe !== 'semua') {
        query = query.eq('tipe', exportTipe)
      }

      const { data: logsData, error } = await query.order('waktu_absen', { ascending: true })

      if (error) {
        alert('Gagal ambil data: ' + error.message)
        setExporting(false)
        return
      }

      if (!logsData || logsData.length === 0) {
        alert('Tidak ada data absensi di rentang tanggal tersebut.')
        setExporting(false)
        return
      }

      const headers = [
        'Tanggal', 'Jam', 'Nama', 'Email', 'Tipe',
        'Absen Menyusul', 'Keterangan', 'Latitude', 'Longitude', 'Akurasi (m)',
      ]

      const tipeLabel = (tipe: string) => {
        switch (tipe) {
          case 'masuk': return 'Masuk'
          case 'keluar': return 'Keluar'
          case 'istirahat_mulai': return 'Istirahat Mulai'
          case 'istirahat_selesai': return 'Istirahat Selesai'
          default: return tipe
        }
      }

      const rows = logsData.map((log: any) => {
        const dt = new Date(log.waktu_absen)
        let keterangan = '-'
        if (log.tipe === 'masuk') {
          const k = getKeteranganMasuk(log)
          keterangan = k?.detail || '-'
        } else if (log.tipe === 'keluar') {
          const k = getKeteranganKeluar(log)
          keterangan = k?.detail || '-'
        } else {
          const wita = dt.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false })
          const [h, m] = wita.split('.').map(Number)
          const menit = h * 60 + m
          const batas = 13 * 60
          if (menit > batas) {
            keterangan = `Terlambat ${menit - batas} menit`
          } else {
            keterangan = 'Tepat waktu'
          }
        }

        return [
          dt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          log.profiles?.nama_lengkap || '-',
          log.profiles?.email || '-',
          tipeLabel(log.tipe),
          log.is_terlambat ? 'Ya' : 'Tidak',
          keterangan,
          log.latitude || '-',
          log.longitude || '-',
          log.accuracy ? Number(log.accuracy.toFixed(0)) : '-',
        ]
      })

      const aoa = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(aoa)

      ws['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 30 }, { wch: 18 },
        { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Absensi')

      const filename = `absensi_${exportStartDate}_sd_${exportEndDate}.xlsx`
      XLSX.writeFile(wb, filename)

      alert(`✅ Berhasil export ${logsData.length} data absensi.`)
      setShowExportModal(false)
    } catch (err: any) {
      alert('Gagal export: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return '--:--'
    return new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' })
  }

  const formatAlamat = (u: Profile) => {
    const jalan = u.alamat_jalan || ''
    const wilayah = [u.kelurahan, u.kecamatan, u.kabupaten].filter(Boolean).join(', ')
    return { jalan, wilayah }
  }

  const isIstirahatTelat = (log: AttendanceLog | null): boolean => {
    if (!log) return false
    const dt = new Date(log.waktu_absen)
    const wita = dt.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false })
    const [h, m] = wita.split('.').map(Number)
    return h * 60 + m > 13 * 60
  }

  const totalKaryawan = users.length
  const sudahMasuk = attendance.filter((a) => a.masuk).length
  const totalCatatan = rawLogs.length
  const adaLupaAbsenKeluar = attendance.filter((a) => a.status === 'lupa_absen_keluar').length

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
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl" />
      </div>

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
              <p className="text-slate-800 font-bold text-lg leading-tight">AbsenKita</p>
              <p className="text-slate-500 text-xs">Panel Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* ============================================================ */}
            {/* TOMBOL KELOLA JADWAL BARU */}
            {/* ============================================================ */}
            <Link
              href="/admin/jadwal"
              className="text-slate-700 hover:text-indigo-700 text-sm bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-4 py-2 rounded-lg transition font-medium inline-flex items-center gap-2"
            >
              <span>📅</span>
              <span className="hidden sm:inline">Kelola Jadwal</span>
            </Link>

            {/* ============================================================ */}
            {/* TAMBAHAN: Tombol Kelola Izin & Cuti dengan badge notifikasi */}
            {/* ============================================================ */}
            <Link
              href="/admin/izin"
              className="relative text-slate-700 hover:text-indigo-700 text-sm bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-4 py-2 rounded-lg transition font-medium inline-flex items-center gap-2"
            >
              <span>📋</span>
              <span className="hidden sm:inline">Izin & Cuti</span>
              {pendingLeaveCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {pendingLeaveCount > 99 ? '99+' : pendingLeaveCount}
                </span>
              )}
            </Link>

            <Link href="/absen" className="text-slate-700 hover:text-indigo-700 text-sm bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-4 py-2 rounded-lg transition font-medium">
              Halaman Absen
            </Link>
            <AvatarDropdown
              nama={profile?.nama_lengkap || 'Admin'}
              email={profile?.email || ''}
              role={profile?.role || 'admin'}
              avatarUrl={profile?.avatar_url || null}
            />
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
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

        {/* ============================================================ */}
        {/* TAMBAHAN: Card Alert jika ada pengajuan izin pending          */}
        {/* ============================================================ */}
        {pendingLeaveCount > 0 && (
          <Link
            href="/admin/izin"
            className="block mb-6 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-5 shadow-xl shadow-amber-500/25 hover:shadow-2xl hover:shadow-amber-500/40 transition-all hover:-translate-y-1 relative overflow-hidden group"
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl shadow-lg shrink-0">
                📋
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-lg leading-tight">
                  Ada {pendingLeaveCount} pengajuan menunggu persetujuan
                </p>
                <p className="text-white/80 text-sm mt-0.5">
                  Klik untuk melihat & memproses pengajuan izin/cuti karyawan →
                </p>
              </div>
              <div className="hidden sm:flex items-center justify-center w-10 h-10 bg-white/20 backdrop-blur rounded-full text-white text-xl group-hover:translate-x-1 transition">
                →
              </div>
            </div>
          </Link>
        )}

        {/* Info Jam */}
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0">
              ⏰
            </div>
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">Jam Kantor</p>
                <p className="text-xs font-bold text-slate-800">{LABEL_JAM.JAM_KANTOR}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">Jam Pelayanan</p>
                <p className="text-xs font-bold text-slate-800">{LABEL_JAM.JAM_PELAYANAN}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">Jam Istirahat</p>
                <p className="text-xs font-bold text-amber-700">{LABEL_JAM.JAM_ISTIRAHAT}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="group relative bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 rounded-2xl p-6 shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/40 transition-all hover:-translate-y-1 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-white/90 text-sm font-medium">Total Karyawan</p>
                <p className="text-white text-4xl font-bold mt-2 drop-shadow-sm">{totalKaryawan}</p>
                <p className="text-white/70 text-xs mt-2">orang terdaftar</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-2xl shadow-lg">👥</div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 rounded-2xl p-6 shadow-xl shadow-violet-500/25 hover:shadow-2xl hover:shadow-violet-500/40 transition-all hover:-translate-y-1 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-white/90 text-sm font-medium">Total Catatan</p>
                <p className="text-white text-4xl font-bold mt-2 drop-shadow-sm">{totalCatatan}</p>
                <p className="text-white/70 text-xs mt-2">catatan absensi</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-2xl shadow-lg">📋</div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-6 shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/40 transition-all hover:-translate-y-1 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-white/90 text-sm font-medium">Sudah Masuk</p>
                <p className="text-white text-4xl font-bold mt-2 drop-shadow-sm">{sudahMasuk}</p>
                <p className="text-white/70 text-xs mt-2">dari {totalKaryawan} karyawan</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-2xl shadow-lg">✅</div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-6 shadow-xl shadow-amber-500/25 hover:shadow-2xl hover:shadow-amber-500/40 transition-all hover:-translate-y-1 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-white/90 text-sm font-medium">Lupa Absen Keluar</p>
                <p className="text-white text-4xl font-bold mt-2 drop-shadow-sm">{adaLupaAbsenKeluar}</p>
                <p className="text-white/70 text-xs mt-2">perlu perhatian</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-2xl shadow-lg">⏰</div>
            </div>
          </div>
        </div>

        {/* Filter Tanggal & Export */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
          <div className="flex items-center gap-3 flex-wrap justify-between">
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
                  className="mt-0.5 px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-medium"
                />
              </div>
            </div>

            <button
              onClick={() => setShowExportModal(true)}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" x2="12" y1="15" y2="3"/>
              </svg>
              Export Excel
            </button>
          </div>
        </div>

        {/* Tabel Absensi */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-violet-50/50 flex-wrap gap-3">
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
                <p className="text-xs text-slate-500 mt-0.5">
                  {filteredAttendance.filter((a) => a.status !== 'belum_absen').length} dari {filteredAttendance.length} karyawan sudah absen
                  {filteredAttendance.length !== attendance.length && ` (filtered dari ${attendance.length})`}
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
                  placeholder="Cari nama karyawan..."
                  value={searchAbsensi}
                  onChange={(e) => setSearchAbsensi(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-56"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
              >
                <option value="semua">Semua Status</option>
                <option value="lengkap">✅ Lengkap</option>
                <option value="belum_keluar">🟡 Belum Keluar</option>
                <option value="lupa_absen_keluar">🟠 Lupa Keluar</option>
                <option value="belum_absen">⚪ Belum Absen</option>
              </select>
            </div>
          </div>

          {filteredAttendance.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-6xl mb-3 opacity-40">📭</p>
              <p className="text-slate-500 text-sm font-medium">
                {attendance.length === 0 ? 'Belum ada karyawan terdaftar' : 'Tidak ada data yang cocok dengan filter'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left border-b border-slate-100">
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Karyawan</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Masuk</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Istirahat</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Selesai</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Keluar</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Lokasi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.map((a) => {
                    const telatIstirahatMulai = isIstirahatTelat(a.istirahatMulai)
                    const telatIstirahatSelesai = isIstirahatTelat(a.istirahatSelesai)

                    return (
                      <tr key={a.user.id} className={`border-t border-slate-100 hover:bg-indigo-50/40 transition ${
                        a.status === 'lupa_absen_keluar' ? 'bg-amber-50/30' : ''
                      }`}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {a.user.avatar_url ? (
                              <button
                                type="button"
                                onClick={() => setViewingPhoto(a.user)}
                                className="relative cursor-zoom-in group/photo shrink-0"
                                title="Klik untuk lihat foto"
                              >
                                <img
                                  src={a.user.avatar_url}
                                  alt={a.user.nama_lengkap}
                                  className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-md transition group-hover/photo:scale-110 group-hover/photo:ring-indigo-400"
                                />
                                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/photo:opacity-100 transition flex items-center justify-center">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"/>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                    <line x1="11" y1="8" x2="11" y2="14"/>
                                    <line x1="8" y1="11" x2="14" y2="11"/>
                                  </svg>
                                </div>
                              </button>
                            ) : (
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0 ${
                                a.user.role === 'admin'
                                  ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/30'
                                  : 'bg-gradient-to-br from-sky-500 to-cyan-500 shadow-sky-500/30'
                              }`}>
                                {getInitials(a.user.nama_lengkap)}
                              </div>
                            )}
                            <div>
                              <Link
                                href={`/admin/karyawan/${a.user.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-slate-800 text-xs hover:text-indigo-600 hover:underline transition inline-flex items-center gap-1"
                              >
                                {a.user.nama_lengkap}
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                  <polyline points="15 3 21 3 21 9"/>
                                  <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                              </Link>
                              {a.user.role === 'admin' && (
                                <p className="text-[10px] text-violet-600 font-medium">Admin</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {a.masuk ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                              {formatTime(a.masuk.waktu_absen)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">--:--</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {a.istirahatMulai ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                                ☕ {formatTime(a.istirahatMulai.waktu_absen)}
                              </span>
                              {telatIstirahatMulai && (
                                <span className="text-[9px] text-amber-600 font-medium pl-1">Terlambat</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">--:--</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {a.istirahatSelesai ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex items-center gap-1 font-mono text-xs font-medium border px-2 py-1 rounded-lg ${
                                telatIstirahatSelesai
                                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                                  : 'text-blue-700 bg-blue-50 border-blue-200'
                              }`}>
                                💪 {formatTime(a.istirahatSelesai.waktu_absen)}
                              </span>
                              {telatIstirahatSelesai && (
                                <span className="text-[9px] text-amber-600 font-medium pl-1">Terlambat</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">--:--</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {a.keluar ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                              {formatTime(a.keluar.waktu_absen)}
                            </span>
                          ) : a.menyusul ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-1 rounded-lg">
                              ⏰ {formatTime(a.menyusul.waktu_absen)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">--:--</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {a.status === 'lengkap' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                              ✅ Lengkap
                            </span>
                          )}
                          {a.status === 'belum_keluar' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
                              🟡 Belum Keluar
                            </span>
                          )}
                          {a.status === 'lupa_absen_keluar' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300">
                              🟠 Lupa Keluar
                            </span>
                          )}
                          {a.status === 'belum_absen' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300">
                              ⚪ Belum Absen
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {(a.masuk?.latitude || a.keluar?.latitude || a.menyusul?.latitude) ? (
                            <div className="flex flex-col gap-1">
                              {(a.masuk?.latitude && a.masuk?.longitude) && (
                                <a
                                  href={`https://www.google.com/maps?q=${a.masuk.latitude},${a.masuk.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 px-2 py-1 rounded-lg transition"
                                >
                                  🟢 Masuk
                                </a>
                              )}
                              {(a.keluar?.latitude && a.keluar?.longitude) && (
                                <a
                                  href={`https://www.google.com/maps?q=${a.keluar.latitude},${a.keluar.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 px-2 py-1 rounded-lg transition"
                                >
                                  🔴 Keluar
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Kelola Karyawan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50/50 to-fuchsia-50/50 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
                👥
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Kelola Karyawan</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {filteredUsers.length} dari {users.length} orang terdaftar
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

      {/* TAHAP 2: MODAL EXPORT CUSTOM */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !exporting && setShowExportModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white text-lg">
                    📥
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">Export Excel</h2>
                    <p className="text-white/80 text-xs">Pilih rentang tanggal & tipe absen</p>
                  </div>
                </div>
                <button
                  onClick={() => !exporting && setShowExportModal(false)}
                  disabled={exporting}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition disabled:opacity-50"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  disabled={exporting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Akhir</label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  disabled={exporting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Absen</label>
                <select
                  value={exportTipe}
                  onChange={(e) => setExportTipe(e.target.value as any)}
                  disabled={exporting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-50 cursor-pointer"
                >
                  <option value="semua">Semua Tipe</option>
                  <option value="masuk">Masuk</option>
                  <option value="keluar">Keluar</option>
                  <option value="istirahat_mulai">Istirahat Mulai</option>
                  <option value="istirahat_selesai">Istirahat Selesai</option>
                </select>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                <span className="text-emerald-600 text-lg">💡</span>
                <p className="text-xs text-emerald-700 leading-snug">
                  File akan di-export sebagai <strong>Excel (.xlsx)</strong> dengan nama otomatis sesuai rentang tanggal.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
                className="px-4 py-2 text-sm text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExportCustom}
                disabled={exporting}
                className="px-4 py-2 text-sm text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-lg transition disabled:opacity-50 inline-flex items-center gap-2 font-semibold shadow-lg shadow-emerald-500/30"
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menyiapkan...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" x2="12" y1="15" y2="3"/>
                    </svg>
                    Export Sekarang
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FOTO PEGAWAI */}
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