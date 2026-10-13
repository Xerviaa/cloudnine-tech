'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AttendanceLog = {
  id: number
  tipe: 'masuk' | 'keluar'
  waktu_absen: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
}

export default function AbsenPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [now, setNow] = useState(new Date())
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number; acc: number } | null>(null)
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
      await loadTodayLogs(user.id)
    }
    loadUser()
  }, [])

  async function loadTodayLogs(userId: string) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('attendance_logs').select('*').eq('user_id', userId)
      .gte('waktu_absen', startOfDay.toISOString())
      .order('waktu_absen', { ascending: true })
    setLogs(data || [])
  }

  // Ambil lokasi GPS dengan timeout
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

  async function handleAbsen(tipe: 'masuk' | 'keluar') {
    if (!user) return
    setLoading(true)
    setMessage('')

    const sudahAbsen = logs.some((log) => log.tipe === tipe)
    if (sudahAbsen) {
      setMessage(`Anda sudah absen ${tipe} hari ini.`)
      setLoading(false)
      return
    }

    // Ambil koordinat GPS
    setMessage('📡 Mengambil lokasi Anda...')
    let lat: number | null = null
    let lng: number | null = null
    let acc: number | null = null

    try {
      const pos = await getCurrentPosition()
      lat = pos.coords.latitude
      lng = pos.coords.longitude
      acc = pos.coords.accuracy
      setLastLocation({ lat, lng, acc })
    } catch (err: any) {
      // Kalau GPS gagal, tetap izinkan absen tanpa koordinat
      console.warn('GPS error:', err)
      setMessage('⚠️ Lokasi tidak terdeteksi, melanjutkan absen tanpa koordinat...')
      await new Promise((r) => setTimeout(r, 800))
    }

    // Simpan ke database
    const { error } = await supabase.from('attendance_logs').insert({
      user_id: user.id,
      tipe,
      waktu_absen: new Date().toISOString(),
      latitude: lat,
      longitude: lng,
      accuracy: acc,
    })

    if (error) {
      setMessage('Gagal absen: ' + error.message)
    } else {
      setMessage(
        lat
          ? `Absen ${tipe} berhasil! 📍 Lokasi tercatat.`
          : `Absen ${tipe} berhasil! ✨`
      )
      await loadTodayLogs(user.id)
    }
    setLoading(false)
    setTimeout(() => setMessage(''), 5000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Memuat data...</p>
        </div>
      </main>
    )
  }

  const jamMasuk = logs.find((l) => l.tipe === 'masuk')
  const jamKeluar = logs.find((l) => l.tipe === 'keluar')
  const sudahMasuk = !!jamMasuk
  const sudahKeluar = !!jamKeluar
  const progress = (sudahMasuk ? 50 : 0) + (sudahKeluar ? 50 : 0)

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background subtle */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl" />
      </div>

      {/* Navbar */}
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
              <p className="text-slate-800 font-bold text-lg leading-tight">KantorAbsensi</p>
              <p className="text-slate-500 text-xs">Halaman Absen</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile?.role === 'admin' && (
              <a
                href="/admin"
                className="text-slate-700 hover:text-indigo-700 text-sm bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-3 py-2 rounded-lg transition font-medium"
              >
                Panel Admin
              </a>
            )}
            <button
              onClick={handleLogout}
              className="text-slate-700 hover:text-rose-700 text-sm bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-3 py-2 rounded-lg transition font-medium"
            >
              Logout
            </button>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full blur opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-lg">
                {profile?.nama_lengkap ? getInitials(profile.nama_lengkap) : '?'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Konten */}
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
              <p className="text-white/70 text-xs mb-6">Waktu saat ini</p>

              <div className="text-6xl md:text-7xl font-bold font-mono tracking-tight text-white tabular-nums drop-shadow-lg">
                {now.toLocaleTimeString('id-ID')}
              </div>

              <p className="text-white/80 text-sm mt-4">
                {now.toLocaleDateString('id-ID', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>

              <div className="mt-6 max-w-xs mx-auto">
                <div className="flex justify-between text-xs text-white/80 mb-2">
                  <span>Progres Hari Ini</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-300 to-teal-300 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(52,211,153,0.6)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Kartu Ringkasan */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`relative bg-white border rounded-2xl p-5 transition shadow-sm ${
            sudahMasuk ? 'border-emerald-200 shadow-emerald-500/5' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                sudahMasuk
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-400 shadow-md shadow-emerald-400/30'
                  : 'bg-slate-100'
              }`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={sudahMasuk ? 'text-white' : 'text-slate-400'}>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" x2="3" y1="12" y2="12"/>
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600">Jam Masuk</p>
            </div>
            <p className={`text-2xl font-bold font-mono tabular-nums ${
              sudahMasuk ? 'text-emerald-500' : 'text-slate-300'
            }`}>
              {jamMasuk
                ? new Date(jamMasuk.waktu_absen).toLocaleTimeString('id-ID')
                : '--:--:--'}
            </p>
            {sudahMasuk && (
              <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1 font-medium">
                <span>✓</span> Tercatat
              </p>
            )}
          </div>

          <div className={`relative bg-white border rounded-2xl p-5 transition shadow-sm ${
            sudahKeluar ? 'border-rose-200 shadow-rose-500/5' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                sudahKeluar
                  ? 'bg-gradient-to-br from-rose-400 to-pink-400 shadow-md shadow-rose-400/30'
                  : 'bg-slate-100'
              }`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={sudahKeluar ? 'text-white' : 'text-slate-400'}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" x2="9" y1="12" y2="12"/>
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600">Jam Keluar</p>
            </div>
            <p className={`text-2xl font-bold font-mono tabular-nums ${
              sudahKeluar ? 'text-rose-500' : 'text-slate-300'
            }`}>
              {jamKeluar
                ? new Date(jamKeluar.waktu_absen).toLocaleTimeString('id-ID')
                : '--:--:--'}
            </p>
            {sudahKeluar && (
              <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1 font-medium">
                <span>✓</span> Tercatat
              </p>
            )}
          </div>
        </div>

        {/* Tombol Absen */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-slate-800 font-bold mb-4 flex items-center gap-2">
            <span>📋</span> Absensi Hari Ini
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => handleAbsen('masuk')}
              disabled={loading || sudahMasuk}
              className={`relative py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 group overflow-hidden ${
                sudahMasuk
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white shadow-lg shadow-emerald-400/30 hover:shadow-xl hover:shadow-emerald-400/40 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {!sudahMasuk && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              )}
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
              onClick={() => handleAbsen('keluar')}
              disabled={loading || sudahKeluar || !sudahMasuk}
              className={`relative py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 group overflow-hidden ${
                sudahKeluar || !sudahMasuk
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-gradient-to-r from-rose-400 to-pink-400 text-white shadow-lg shadow-rose-400/30 hover:shadow-xl hover:shadow-rose-400/40 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {!sudahKeluar && sudahMasuk && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              )}
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

          {/* Info Lokasi Terakhir */}
          {lastLocation && (
            <div className="mt-4 p-3 bg-sky-50 border border-sky-200 rounded-xl">
              <p className="text-xs text-sky-700 flex items-center gap-2 font-medium">
                <span>📍</span>
                Lokasi terdeteksi: {lastLocation.lat.toFixed(6)}, {lastLocation.lng.toFixed(6)}
                <span className="text-sky-500">(± {lastLocation.acc.toFixed(0)}m)</span>
              </p>
            </div>
          )}

          {!sudahMasuk && (
            <p className="text-xs text-slate-500 mt-3 text-center">
              💡 Lokasi Anda akan diambil otomatis saat klik tombol absen
            </p>
          )}

          {message && (
            <div className={`mt-4 text-sm text-center p-3 rounded-xl font-medium border ${
              message.includes('berhasil')
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : message.includes('sudah') || message.includes('Mengambil') || message.includes('Lokasi')
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* Riwayat */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-slate-800 font-bold flex items-center gap-2">
              <span>🕐</span> Riwayat Hari Ini
            </h2>
            {logs.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full font-medium">
                {logs.length} catatan
              </span>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-5xl mb-3 opacity-40">📭</p>
              <p className="text-slate-500 text-sm font-medium">Belum ada absensi hari ini</p>
              <p className="text-slate-400 text-xs mt-1">Klik tombol absen di atas untuk mulai</p>
            </div>
          ) : (
            <div className="relative space-y-3">
              {logs.map((log, idx) => (
                <div key={log.id} className="relative">
                  {idx < logs.length - 1 && (
                    <div className="absolute left-5 top-20 bottom-0 w-px bg-gradient-to-b from-slate-200 to-transparent" />
                  )}
                  <div className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-4 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                          log.tipe === 'masuk'
                            ? 'bg-gradient-to-br from-emerald-400 to-teal-400 shadow-emerald-400/30'
                            : 'bg-gradient-to-br from-rose-400 to-pink-400 shadow-rose-400/30'
                        }`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            {log.tipe === 'masuk' ? (
                              <>
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                                <polyline points="10 17 15 12 10 7"/>
                                <line x1="15" x2="3" y1="12" y2="12"/>
                              </>
                            ) : (
                              <>
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16 17 21 12 16 7"/>
                                <line x1="21" x2="9" y1="12" y2="12"/>
                              </>
                            )}
                          </svg>
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${
                            log.tipe === 'masuk' ? 'text-emerald-600' : 'text-rose-500'
                          }`}>
                            Absen {log.tipe === 'masuk' ? 'Masuk' : 'Keluar'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(log.waktu_absen).toLocaleDateString('id-ID', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <span className={`text-lg font-bold font-mono tabular-nums ${
                        log.tipe === 'masuk' ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {new Date(log.waktu_absen).toLocaleTimeString('id-ID', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Info lokasi di riwayat */}
                    {log.latitude && log.longitude ? (
                      <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                          <span>📍</span>
                          {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                          {log.accuracy && (
                            <span className="text-slate-400">(± {log.accuracy.toFixed(0)}m)</span>
                          )}
                        </p>
                        <a
                          href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-sky-600 hover:text-sky-700 font-medium flex items-center gap-0.5"
                        >
                          Buka Peta →
                        </a>
                      </div>
                    ) : (
                      <p className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-400 flex items-center gap-1">
                        <span>📍</span> Lokasi tidak terekam
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}