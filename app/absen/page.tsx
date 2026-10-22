'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AvatarDropdown from '@/components/AvatarDropdown'
import { LABEL_JAM } from '@/lib/config/jam-kantor'
import { getKeteranganMasuk, getKeteranganKeluar } from '@/lib/utils/attendance'

type TipeAbsen = 'masuk' | 'keluar' | 'istirahat_mulai' | 'istirahat_selesai'

type AttendanceLog = {
  id: number
  tipe: TipeAbsen
  waktu_absen: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  is_terlambat: boolean
}

type JamKantorAktif = {
  jam_masuk: string
  jam_pulang: string
  jam_istirahat_mulai: string
  jam_istirahat_selesai: string
}

export default function AbsenPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [now, setNow] = useState(new Date())
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([])
  const [pendingLog, setPendingLog] = useState<AttendanceLog | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0)
  const [jamKantor, setJamKantor] = useState<JamKantorAktif | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)

      // Ambil jam kantor yang berlaku hari ini
      await loadJamKantorHariIni()

      await loadData(user.id)
      await loadPendingLeave(user.id)
    }
    loadUser()
  }, [])

  // ============================================================
  // Ambil jam kantor dari HISTORY (sesuai tanggal hari ini)
  // ============================================================
  async function loadJamKantorHariIni() {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const { data } = await supabase
      .from('company_settings_history')
      .select('jam_masuk, jam_pulang, jam_istirahat_mulai, jam_istirahat_selesai')
      .lte('berlaku_mulai', todayStr)
      .order('berlaku_mulai', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setJamKantor(data as JamKantorAktif)
    } else {
      // Fallback dari company_settings
      const { data: current } = await supabase
        .from('company_settings')
        .select('jam_masuk, jam_pulang, jam_istirahat_mulai, jam_istirahat_selesai')
        .eq('id', 1)
        .single()
      setJamKantor(current as JamKantorAktif)
    }
  }

  async function loadData(userId: string) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const { data: today } = await supabase
      .from('attendance_logs').select('*').eq('user_id', userId)
      .gte('waktu_absen', startOfDay.toISOString())
      .order('waktu_absen', { ascending: true })
    setTodayLogs(today || [])

    const { data: pending } = await supabase
      .from('attendance_logs').select('*').eq('user_id', userId)
      .eq('tipe', 'masuk')
      .lt('waktu_absen', startOfDay.toISOString())
      .order('waktu_absen', { ascending: false })
      .limit(10)

    let foundPending: AttendanceLog | null = null
    if (pending && pending.length > 0) {
      for (const log of pending) {
        const { data: keluarAfter } = await supabase
          .from('attendance_logs').select('id')
          .eq('user_id', userId)
          .eq('tipe', 'keluar')
          .gt('waktu_absen', log.waktu_absen)
          .limit(1)
        if (!keluarAfter || keluarAfter.length === 0) {
          foundPending = log
          break
        }
      }
    }
    setPendingLog(foundPending)
  }

  async function loadPendingLeave(userId: string) {
    const { count } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')
    setPendingLeaveCount(count || 0)
  }

  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Browser tidak mendukung GPS'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      })
    })
  }

  // ============================================================
  // Cek keterlambatan berdasarkan jam kantor yang AKTIF hari ini
  // ============================================================
  function cekTerlambatMasukDinamis(jamMasukStr: string): { terlambat: boolean; menit: number } {
    if (!jamKantor) return { terlambat: false, menit: 0 }

    const now = new Date()
    const wita = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false })
    const [h, m] = wita.split('.').map(Number)
    const menitSekarang = h * 60 + m

    const [jamH, jamM] = jamMasukStr.split(':').map(Number)
    const menitBatas = jamH * 60 + jamM

    const diff = menitSekarang - menitBatas
    return { terlambat: diff > 0, menit: diff > 0 ? diff : 0 }
  }

  function cekStatusKeluarDinamis(): { status: 'normal' | 'pulang_cepat' | 'lewat_batas'; menitCepat: number } {
    if (!jamKantor) return { status: 'normal', menitCepat: 0 }

    const now = new Date()
    const wita = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false })
    const [h, m] = wita.split('.').map(Number)
    const menitSekarang = h * 60 + m

    const [jamPH, jamPM] = jamKantor.jam_pulang.split(':').map(Number)
    const menitPulang = jamPH * 60 + jamPM

    // Batas maksimal pulang = jam pulang + 4 jam (misal 16:30 + 4 = 20:30)
    const batasMaksimal = menitPulang + (4 * 60)

    if (menitSekarang > batasMaksimal) {
      return { status: 'lewat_batas', menitCepat: 0 }
    }
    if (menitSekarang < menitPulang) {
      return { status: 'pulang_cepat', menitCepat: menitPulang - menitSekarang }
    }
    return { status: 'normal', menitCepat: 0 }
  }

  function cekStatusIstirahatDinamis(waktuAbsen: Date): { status: 'normal' | 'terlambat'; menit: number } {
    if (!jamKantor) return { status: 'normal', menit: 0 }

    const wita = waktuAbsen.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false })
    const [h, m] = wita.split('.').map(Number)
    const menitSekarang = h * 60 + m

    const [jamSH, jamSM] = jamKantor.jam_istirahat_selesai.split(':').map(Number)
    const menitBatas = jamSH * 60 + jamSM

    const diff = menitSekarang - menitBatas
    return { status: diff > 0 ? 'terlambat' : 'normal', menit: diff > 0 ? diff : 0 }
  }

  async function handleAbsen(tipe: TipeAbsen, isTerlambat = false) {
    if (!user || !jamKantor) {
      alert('Jam kantor belum dimuat. Coba refresh halaman.')
      return
    }
    setLoading(true)
    setMessage('')

    if (tipe === 'masuk' && pendingLog) {
      setMessage('⚠️ Anda masih punya absen masuk yang belum keluar. Selesaikan dulu.')
      setLoading(false)
      return
    }

    if (tipe === 'keluar' && !isTerlambat) {
      const istirahatMulai = todayLogs.find((l) => l.tipe === 'istirahat_mulai')
      const istirahatSelesai = todayLogs.find((l) => l.tipe === 'istirahat_selesai')
      if (istirahatMulai && !istirahatSelesai) {
        setMessage('⚠️ Anda sedang istirahat. Klik "Selesai Istirahat" dulu sebelum absen keluar.')
        setLoading(false)
        return
      }

      const { status, menitCepat } = cekStatusKeluarDinamis()

      if (status === 'lewat_batas') {
        setMessage(
          `⚠️ Sudah lewat jam operasional (batas: ${jamKantor.jam_pulang} + 4 jam). ` +
          `Silakan absen keluar besok (Absen Menyusul).`
        )
        setLoading(false)
        return
      }

      if (status === 'pulang_cepat') {
        const konfirmasi = confirm(
          `⏰ Anda akan absen keluar sebelum jam ${jamKantor.jam_pulang} WITA.\n\n` +
          `Status akan tercatat "Pulang Cepat" (${menitCepat} menit lebih awal).\n\n` +
          `Yakin ingin melanjutkan?`
        )
        if (!konfirmasi) {
          setLoading(false)
          return
        }
      }
    }

    setMessage('📡 Mengambil lokasi Anda...')
    let lat: number | null = null
    let lng: number | null = null
    let acc: number | null = null

    try {
      const pos = await getCurrentPosition()
      lat = pos.coords.latitude
      lng = pos.coords.longitude
      acc = pos.coords.accuracy
    } catch (err) {
      console.warn('GPS error:', err)
    }

    // Snapshot jam kantor saat ini untuk disimpan di log
    const snapshotJamKantor = {
      jam_masuk: jamKantor.jam_masuk,
      jam_pulang: jamKantor.jam_pulang,
      jam_istirahat_mulai: jamKantor.jam_istirahat_mulai,
      jam_istirahat_selesai: jamKantor.jam_istirahat_selesai,
    }

    const { error } = await supabase.from('attendance_logs').insert({
      user_id: user.id,
      tipe,
      waktu_absen: new Date().toISOString(),
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      is_terlambat: isTerlambat,
      jam_kantor_saat_absen: snapshotJamKantor,
    })

    if (error) {
      setMessage('Gagal absen: ' + error.message)
    } else {
      if (isTerlambat) {
        setMessage('✅ Absen keluar (terlambat) tercatat. Sekarang Anda bisa absen masuk.')
      } else if (tipe === 'masuk') {
        const { terlambat, menit } = cekTerlambatMasukDinamis(jamKantor.jam_masuk)
        if (terlambat) {
          setMessage(`✅ Absen masuk berhasil! ⚠️ Anda terlambat ${menit} menit dari jam ${jamKantor.jam_masuk}.`)
        } else {
          setMessage(`✅ Absen masuk berhasil! ${lat ? '📍 Lokasi tercatat.' : ''}`)
        }
      } else if (tipe === 'istirahat_mulai') {
        const { status, menit } = cekStatusIstirahatDinamis(new Date())
        if (status === 'terlambat') {
          setMessage(`✅ Istirahat mulai tercatat! ⚠️ Terlambat ${menit} menit dari jam ${jamKantor.jam_istirahat_selesai}.`)
        } else {
          setMessage(`✅ Istirahat mulai tercatat. Selamat istirahat! ☕`)
        }
      } else if (tipe === 'istirahat_selesai') {
        const { status, menit } = cekStatusIstirahatDinamis(new Date())
        if (status === 'terlambat') {
          setMessage(`✅ Istirahat selesai tercatat! ⚠️ Terlambat ${menit} menit dari jam ${jamKantor.jam_istirahat_selesai}.`)
        } else {
          setMessage(`✅ Istirahat selesai. Selamat bekerja kembali! 💪`)
        }
      } else {
        const { status, menitCepat } = cekStatusKeluarDinamis()
        if (status === 'pulang_cepat') {
          setMessage(`✅ Absen keluar berhasil! ⚠️ Anda pulang ${menitCepat} menit lebih awal.`)
        } else {
          setMessage(`✅ Absen keluar berhasil! ${lat ? '📍 Lokasi tercatat.' : ''}`)
        }
      }
      await loadData(user.id)
    }
    setLoading(false)
    setTimeout(() => setMessage(''), 7000)
  }

  if (!user || !jamKantor) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Memuat data...</p>
        </div>
      </main>
    )
  }

  const jamMasukLog = todayLogs.find((l) => l.tipe === 'masuk' && !l.is_terlambat)
  const jamKeluarLog = todayLogs.find((l) => l.tipe === 'keluar' && !l.is_terlambat)
  const istirahatMulai = todayLogs.find((l) => l.tipe === 'istirahat_mulai')
  const istirahatSelesai = todayLogs.find((l) => l.tipe === 'istirahat_selesai')

  const sudahMasuk = !!jamMasukLog
  const sudahKeluar = !!jamKeluarLog
  const sedangIstirahat = !!istirahatMulai && !istirahatSelesai
  const sudahIstirahat = !!istirahatMulai && !!istirahatSelesai

  const progress =
    (sudahMasuk ? 25 : 0) +
    (istirahatMulai ? 25 : 0) +
    (istirahatSelesai ? 25 : 0) +
    (sudahKeluar ? 25 : 0)

  const ketMasuk = getKeteranganMasuk(jamMasukLog || null)
  const ketKeluar = getKeteranganKeluar(jamKeluarLog || null)
  const ketIstirahatMulai = istirahatMulai ? cekStatusIstirahatDinamis(new Date(istirahatMulai.waktu_absen)) : null
  const ketIstirahatSelesai = istirahatSelesai ? cekStatusIstirahatDinamis(new Date(istirahatSelesai.waktu_absen)) : null

  const getTipeLabel = (tipe: TipeAbsen) => {
    switch (tipe) {
      case 'masuk': return { label: 'Masuk', color: 'text-emerald-600', bg: 'from-emerald-400 to-teal-400', icon: '→' }
      case 'keluar': return { label: 'Keluar', color: 'text-rose-500', bg: 'from-rose-400 to-pink-400', icon: '←' }
      case 'istirahat_mulai': return { label: 'Istirahat Mulai', color: 'text-amber-600', bg: 'from-amber-400 to-orange-400', icon: '☕' }
      case 'istirahat_selesai': return { label: 'Istirahat Selesai', color: 'text-blue-600', bg: 'from-blue-400 to-indigo-400', icon: '💪' }
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur-md opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🏢</span>
              </div>
            </div>
            <div>
              <p className="text-slate-800 font-bold text-lg leading-tight">AbsenKita</p>
              <p className="text-slate-500 text-xs">Halaman Absen</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/izin"
              className="relative text-white text-xs sm:text-sm bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 border-0 px-3 sm:px-4 py-2 rounded-lg transition font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl inline-flex items-center gap-1.5"
            >
              <span>📝</span>
              <span className="hidden sm:inline">Ajukan Izin</span>
              <span className="sm:hidden">Izin</span>
              {pendingLeaveCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full flex items-center justify-center border border-white">
                  {pendingLeaveCount > 9 ? '9+' : pendingLeaveCount}
                </span>
              )}
            </Link>

            <Link
              href="/jadwal-saya"
              className="relative text-white text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 border-0 px-3 sm:px-4 py-2 rounded-lg transition font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl inline-flex items-center gap-1.5"
            >
              <span>📅</span>
              <span className="hidden sm:inline">Jadwal Saya</span>
              <span className="sm:hidden">Jadwal</span>
            </Link>

            {profile?.role === 'admin' && (
              <a href="/admin" className="text-slate-700 hover:text-indigo-700 text-sm bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-3 py-2 rounded-lg transition font-medium">
                Admin
              </a>
            )}
            <AvatarDropdown
              nama={profile?.nama_lengkap || 'User'}
              email={profile?.email || ''}
              role={profile?.role || 'karyawan'}
              avatarUrl={profile?.avatar_url || null}
            />
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        {/* Kartu Jam */}
        <div className="relative group mb-6">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-40 transition" />
          <div className="relative bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 rounded-3xl p-8 shadow-2xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur border border-white/30 rounded-full px-3 py-1 mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                <span className="text-white text-xs font-medium">Live</span>
              </div>
              <p className="text-white/90 text-sm mb-1">
                Halo, <span className="text-white font-semibold">{profile?.nama_lengkap}</span> 👋
              </p>
              <p className="text-white/70 text-xs mb-6">Waktu saat ini (WITA)</p>
              <div className="text-6xl md:text-7xl font-bold font-mono tracking-tight text-white tabular-nums drop-shadow-lg">
                {now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar' })}
              </div>
              <p className="text-white/80 text-sm mt-4">
                {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' })}
              </p>
              <div className="mt-6 max-w-xs mx-auto">
                <div className="flex justify-between text-xs text-white/80 mb-2">
                  <span>Progres Hari Ini</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-300 to-teal-300 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Banner Ajukan Izin */}
        <Link
          href="/izin"
          className="block mb-6 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-2xl p-5 shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/40 transition-all hover:-translate-y-1 relative overflow-hidden group"
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl shadow-lg shrink-0">
              📝
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-base leading-tight">
                Butuh Izin, Sakit, atau Cuti?
              </p>
              <p className="text-white/80 text-xs mt-0.5">
                Ajukan di sini, admin akan memproses pengajuan Anda
              </p>
            </div>
            <div className="hidden sm:flex items-center justify-center w-10 h-10 bg-white/20 backdrop-blur rounded-full text-white text-xl group-hover:translate-x-1 transition">
              →
            </div>
          </div>
          {pendingLeaveCount > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-amber-400 text-amber-900 px-3 py-1 rounded-full text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-900 animate-pulse" />
              Anda punya {pendingLeaveCount} pengajuan yang menunggu
            </div>
          )}
        </Link>

        {/* Info Jam (dinamis dari history) */}
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0">
              ⏰
            </div>
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">Jam Masuk</p>
                <p className="text-xs font-bold text-slate-800">{jamKantor.jam_masuk} WITA</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">Jam Pulang</p>
                <p className="text-xs font-bold text-slate-800">{jamKantor.jam_pulang} WITA</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">Istirahat</p>
                <p className="text-xs font-bold text-amber-700">{jamKantor.jam_istirahat_mulai} – {jamKantor.jam_istirahat_selesai}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Peringatan Pending */}
        {pendingLog && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 mb-6 shadow-md">
            <div className="flex items-start gap-3">
              <span className="text-3xl">⚠️</span>
              <div className="flex-1">
                <p className="font-bold text-amber-800">Anda Lupa Absen Keluar!</p>
                <p className="text-sm text-amber-700 mt-1">
                  Absen masuk pada <strong>{new Date(pendingLog.waktu_absen).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Makassar' })}</strong> pukul <strong>{new Date(pendingLog.waktu_absen).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar' })}</strong> belum ada absen keluar.
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Silakan lakukan absen keluar (terlambat) dulu untuk bisa absen masuk hari ini.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tombol Absen */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-slate-800 font-bold mb-4 flex items-center gap-2">
            <span>📋</span> Absensi Hari Ini
          </h2>

          {pendingLog ? (
            <button
              onClick={() => handleAbsen('keluar', true)}
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Absen Keluar (Terlambat)
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => handleAbsen('masuk')}
                  disabled={loading || sudahMasuk}
                  className={`py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    sudahMasuk
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white shadow-lg shadow-emerald-400/30 hover:shadow-xl hover:shadow-emerald-400/40 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {sudahMasuk ? '✓ Sudah Masuk' : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                      </svg>
                      Absen Masuk
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleAbsen('istirahat_mulai')}
                  disabled={loading || !sudahMasuk || sudahIstirahat || sedangIstirahat}
                  className={`py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    !sudahMasuk || sudahIstirahat || sedangIstirahat
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-lg shadow-amber-400/30 hover:shadow-xl hover:shadow-amber-400/40 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {sedangIstirahat ? '☕ Sedang Istirahat' : sudahIstirahat ? '✓ Sudah Istirahat' : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                      </svg>
                      Istirahat Mulai
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => handleAbsen('istirahat_selesai')}
                  disabled={loading || !sedangIstirahat}
                  className={`py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    !sedangIstirahat
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-gradient-to-r from-blue-400 to-indigo-400 text-white shadow-lg shadow-blue-400/30 hover:shadow-xl hover:shadow-blue-400/40 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {sudahIstirahat ? '✓ Istirahat Selesai' : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                      </svg>
                      Selesai Istirahat
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleAbsen('keluar')}
                  disabled={loading || sudahKeluar || !sudahMasuk || sedangIstirahat}
                  className={`py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    sudahKeluar || !sudahMasuk || sedangIstirahat
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-gradient-to-r from-rose-400 to-pink-400 text-white shadow-lg shadow-rose-400/30 hover:shadow-xl hover:shadow-rose-400/40 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {sudahKeluar ? '✓ Sudah Keluar' : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" x2="9" y1="12" y2="12"/>
                      </svg>
                      Absen Keluar
                    </>
                  )}
                </button>
              </div>

              {!sudahMasuk && (
                <p className="text-xs text-slate-500 text-center">
                  💡 Lokasi Anda akan diambil otomatis saat klik tombol absen
                </p>
              )}
              {sudahMasuk && !sudahIstirahat && !sedangIstirahat && (
                <p className="text-xs text-amber-600 text-center font-medium">
                  ☕ Jangan lupa istirahat jam {jamKantor.jam_istirahat_mulai} WITA
                </p>
              )}
            </div>
          )}

          {message && (
            <div className={`mt-4 text-sm text-center p-3 rounded-xl font-medium border ${
              message.includes('berhasil') || message.includes('tercatat')
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : message.includes('sudah') || message.includes('Mengambil') || message.includes('istirahat')
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* Kartu Ringkasan */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`bg-white border rounded-2xl p-5 transition shadow-sm ${sudahMasuk ? 'border-emerald-200' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sudahMasuk ? 'bg-gradient-to-br from-emerald-400 to-teal-400' : 'bg-slate-100'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sudahMasuk ? 'text-white' : 'text-slate-400'}>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" x2="3" y1="12" y2="12"/>
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600">Jam Masuk</p>
            </div>
            <p className={`text-xl font-bold font-mono ${sudahMasuk ? 'text-emerald-500' : 'text-slate-300'}`}>
              {jamMasukLog ? new Date(jamMasukLog.waktu_absen).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
            {ketMasuk && (
              <p className={`text-[10px] mt-1 font-medium ${ketMasuk.warna === 'terlambat' ? 'text-amber-600' : 'text-emerald-600'}`}>
                {ketMasuk.detail}
              </p>
            )}
          </div>

          <div className={`bg-white border rounded-2xl p-5 transition shadow-sm ${istirahatMulai ? 'border-amber-200' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${istirahatMulai ? 'bg-gradient-to-br from-amber-400 to-orange-400' : 'bg-slate-100'}`}>
                <span className="text-base">☕</span>
              </div>
              <p className="text-xs font-semibold text-slate-600">Istirahat</p>
            </div>
            <p className={`text-xl font-bold font-mono ${istirahatMulai ? 'text-amber-500' : 'text-slate-300'}`}>
              {istirahatMulai ? new Date(istirahatMulai.waktu_absen).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
            {ketIstirahatMulai && (
              <p className={`text-[10px] mt-1 font-medium ${ketIstirahatMulai.status === 'terlambat' ? 'text-amber-600' : 'text-emerald-600'}`}>
                {ketIstirahatMulai.status === 'terlambat' ? `Terlambat ${ketIstirahatMulai.menit} menit` : 'Tepat waktu'}
              </p>
            )}
          </div>

          <div className={`bg-white border rounded-2xl p-5 transition shadow-sm ${istirahatSelesai ? 'border-blue-200' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${istirahatSelesai ? 'bg-gradient-to-br from-blue-400 to-indigo-400' : 'bg-slate-100'}`}>
                <span className="text-base">💪</span>
              </div>
              <p className="text-xs font-semibold text-slate-600">Selesai Istirahat</p>
            </div>
            <p className={`text-xl font-bold font-mono ${istirahatSelesai ? 'text-blue-500' : 'text-slate-300'}`}>
              {istirahatSelesai ? new Date(istirahatSelesai.waktu_absen).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
            {ketIstirahatSelesai && (
              <p className={`text-[10px] mt-1 font-medium ${ketIstirahatSelesai.status === 'terlambat' ? 'text-amber-600' : 'text-emerald-600'}`}>
                {ketIstirahatSelesai.status === 'terlambat' ? `Terlambat ${ketIstirahatSelesai.menit} menit` : 'Tepat waktu'}
              </p>
            )}
          </div>

          <div className={`bg-white border rounded-2xl p-5 transition shadow-sm ${sudahKeluar ? 'border-rose-200' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sudahKeluar ? 'bg-gradient-to-br from-rose-400 to-pink-400' : 'bg-slate-100'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sudahKeluar ? 'text-white' : 'text-slate-400'}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" x2="9" y1="12" y2="12"/>
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600">Jam Keluar</p>
            </div>
            <p className={`text-xl font-bold font-mono ${sudahKeluar ? 'text-rose-500' : 'text-slate-300'}`}>
              {jamKeluarLog ? new Date(jamKeluarLog.waktu_absen).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
            {ketKeluar && (
              <p className={`text-[10px] mt-1 font-medium ${ketKeluar.warna === 'normal' ? 'text-emerald-600' : 'text-orange-600'}`}>
                {ketKeluar.detail}
              </p>
            )}
          </div>
        </div>

        {/* Riwayat */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-slate-800 font-bold flex items-center gap-2">
              <span>🕐</span> Riwayat Hari Ini
            </h2>
            {todayLogs.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full font-medium">
                {todayLogs.length} catatan
              </span>
            )}
          </div>

          {todayLogs.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-5xl mb-3 opacity-40">📭</p>
              <p className="text-slate-500 text-sm font-medium">Belum ada absensi hari ini</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayLogs.map((log) => {
                const info = getTipeLabel(log.tipe)
                const ket = log.tipe === 'masuk' ? getKeteranganMasuk(log) :
                            log.tipe === 'keluar' ? getKeteranganKeluar(log) :
                            cekStatusIstirahatDinamis(new Date(log.waktu_absen))

                return (
                  <div key={log.id} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-4 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-gradient-to-br ${info.bg}`}>
                          <span className="text-white font-bold text-lg">{info.icon}</span>
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${info.color}`}>
                            {info.label}
                            {log.is_terlambat && (
                              <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                                MENYUSUL
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(log.waktu_absen).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
                          </p>
                          {ket && 'detail' in ket && (
                            <p className={`text-[10px] mt-0.5 font-medium ${
                              ket.warna === 'terlambat' ? 'text-amber-600'
                              : ket.warna === 'pulang_cepat' ? 'text-orange-600'
                              : ket.warna === 'menyusul' ? 'text-amber-600'
                              : 'text-emerald-600'
                            }`}>
                              {ket.detail}
                            </p>
                          )}
                          {ket && 'status' in ket && ket.status === 'terlambat' && (
                            <p className="text-[10px] mt-0.5 font-medium text-amber-600">
                              Terlambat {ket.menit} menit
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-lg font-bold font-mono ${info.color}`}>
                        {new Date(log.waktu_absen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}