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

export default function AdminJadwalPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [employees, setEmployees] = useState<Profile[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [saving, setSaving] = useState(false)

  // Filter bulan
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Modal kelola tanggal
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())

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
        alert('Akses ditolak.')
        router.push('/absen')
        return
      }
      setProfile(profileData)

      // Load semua karyawan (kecuali admin sendiri)
      const { data: empData } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .order('nama_lengkap')
      setEmployees(empData || [])

      await loadSchedules()
      setLoading(false)
    }
    checkAdmin()
  }, [])

  useEffect(() => {
    if (profile) loadSchedules()
  }, [selectedMonth, profile])

  async function loadSchedules() {
    const [year, month] = selectedMonth.split('-').map(Number)
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)

    const { data } = await supabase
      .from('employee_schedules')
      .select('*')
      .gte('tanggal', start.toISOString().split('T')[0])
      .lte('tanggal', end.toISOString().split('T')[0])

    setSchedules((data as any) || [])
  }

  // ============================================================
  // Generate kalender bulan
  // ============================================================
  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const daysInMonth = lastDay.getDate()

    // Hari pertama dalam minggu (0 = Minggu, 1 = Senin, ...)
    const firstDayOfWeek = firstDay.getDay()
    // Konversi ke Senin = 0, Minggu = 6
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

    const days: (Date | null)[] = []

    // Padding kosong di awal
    for (let i = 0; i < startOffset; i++) {
      days.push(null)
    }

    // Isi tanggal
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month - 1, d))
    }

    return days
  }, [selectedMonth])

  // Cek apakah hari ini adalah weekend
  function isWeekend(date: Date) {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  // Ambil jumlah karyawan masuk per tanggal
  function getDayStats(date: Date) {
    const dateStr = date.toISOString().split('T')[0]
    const daySchedules = schedules.filter((s) => s.tanggal === dateStr)
    
    const lemburCount = daySchedules.filter((s) => s.tipe === 'lembur').length
    const kerjaCount = daySchedules.filter((s) => s.tipe === 'kerja').length
    const liburCount = daySchedules.filter((s) => s.tipe === 'libur').length

    return { lemburCount, kerjaCount, liburCount, total: employees.length }
  }

  // Buka modal untuk atur tanggal
  function openDateModal(date: Date) {
    const dateStr = date.toISOString().split('T')[0]
    const daySchedules = schedules.filter((s) => s.tanggal === dateStr)
    
    // Isi selected employees = yang tipenya 'kerja' atau 'lembur'
    const selected = new Set<string>()
    daySchedules.forEach((s) => {
      if (s.tipe === 'kerja' || s.tipe === 'lembur') {
        selected.add(s.user_id)
      }
    })
    
    setSelectedDate(dateStr)
    setSelectedEmployees(selected)
  }

  // Toggle checkbox karyawan
  function toggleEmployee(userId: string) {
    const newSet = new Set(selectedEmployees)
    if (newSet.has(userId)) {
      newSet.delete(userId)
    } else {
      newSet.add(userId)
    }
    setSelectedEmployees(newSet)
  }

  // Simpan jadwal untuk tanggal terpilih
  async function saveDateSchedule() {
    if (!selectedDate || !profile) return
    setSaving(true)

    try {
      const dateObj = new Date(selectedDate)
      const isWeekendDay = isWeekend(dateObj)
      const defaultTipe = isWeekendDay ? 'lembur' : 'kerja'

      // Hapus semua jadwal untuk tanggal ini
      await supabase
        .from('employee_schedules')
        .delete()
        .eq('tanggal', selectedDate)

      // Insert jadwal baru
      const rows = Array.from(selectedEmployees).map((userId) => ({
        user_id: userId,
        tanggal: selectedDate,
        tipe: defaultTipe,
        created_by: profile.id,
      }))

      // Insert yang masuk kerja/lembur
      if (rows.length > 0) {
        const { error } = await supabase.from('employee_schedules').insert(rows)
        if (error) throw error
      }

      // Insert yang libur (yang tidak dipilih)
      const liburRows = employees
        .filter((emp) => !selectedEmployees.has(emp.id))
        .map((emp) => ({
          user_id: emp.id,
          tanggal: selectedDate,
          tipe: 'libur',
          created_by: profile.id,
        }))

      if (liburRows.length > 0) {
        const { error } = await supabase.from('employee_schedules').insert(liburRows)
        if (error) throw error
      }

      await loadSchedules()
      setSelectedDate(null)
      alert('✅ Jadwal berhasil disimpan!')
    } catch (err: any) {
      alert('Gagal simpan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Bulk action: Set semua Minggu libur
  async function setAllSundaysOff() {
    if (!confirm('Set semua hari MINGGU di bulan ini sebagai libur untuk semua karyawan?')) return
    if (!profile) return
    
    setSaving(true)
    try {
      const [year, month] = selectedMonth.split('-').map(Number)
      const lastDay = new Date(year, month, 0).getDate()

      const rows: any[] = []
      for (let d = 1; d <= lastDay; d++) {
        const date = new Date(year, month - 1, d)
        if (date.getDay() === 0) {
          const dateStr = date.toISOString().split('T')[0]
          employees.forEach((emp) => {
            rows.push({
              user_id: emp.id,
              tanggal: dateStr,
              tipe: 'libur',
              created_by: profile.id,
            })
          })
        }
      }

      // Hapus dulu jadwal Minggu yang ada
      for (let d = 1; d <= lastDay; d++) {
        const date = new Date(year, month - 1, d)
        if (date.getDay() === 0) {
          const dateStr = date.toISOString().split('T')[0]
          await supabase.from('employee_schedules').delete().eq('tanggal', dateStr)
        }
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('employee_schedules').insert(rows)
        if (error) throw error
      }

      await loadSchedules()
      alert(`✅ ${rows.length} jadwal libur Minggu berhasil diset!`)
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Bulk action: Reset bulan ini
  async function resetMonth() {
    if (!confirm('Hapus semua jadwal di bulan ini? (Tindakan tidak bisa dibatalkan)')) return
    
    setSaving(true)
    try {
      const [year, month] = selectedMonth.split('-').map(Number)
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0)

      const { error } = await supabase
        .from('employee_schedules')
        .delete()
        .gte('tanggal', start.toISOString().split('T')[0])
        .lte('tanggal', end.toISOString().split('T')[0])

      if (error) throw error

      await loadSchedules()
      alert('✅ Jadwal bulan ini berhasil direset!')
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = -2; i <= 6; i++) {
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
          <p className="text-slate-500 text-sm">Memuat data...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
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
              <p className="text-slate-500 text-xs">Kelola Jadwal</p>
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
            📅 Kelola Jadwal Karyawan
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Atur siapa yang masuk & siapa yang libur setiap harinya
          </p>
        </div>

        {/* Filter & Bulk Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg">
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

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={setAllSundaysOff}
                disabled={saving}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-2"
              >
                🗓️ Set Libur Minggu
              </button>
              <button
                onClick={resetMonth}
                disabled={saving}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold text-sm rounded-xl shadow-lg shadow-rose-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-2"
              >
                🗑️ Reset Bulan Ini
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-300" />
              <span className="text-slate-600">Hari Kerja</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-300" />
              <span className="text-slate-600">Hari Libur</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-orange-400" />
              <span className="text-slate-600">Lembur (Sabtu/Minggu Masuk)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-200" />
              <span className="text-slate-600">Belum Diset</span>
            </div>
          </div>
        </div>

        {/* Kalender */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {/* Header Hari */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dayNames.map((day, idx) => (
              <div
                key={day}
                className={`text-center text-xs font-bold uppercase tracking-wider py-2 ${
                  idx >= 5 ? 'text-rose-500' : 'text-slate-500'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid Tanggal */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className="aspect-square" />
              }

              const dateStr = date.toISOString().split('T')[0]
              const weekend = isWeekend(date)
              const stats = getDayStats(date)
              const hasSchedule = stats.kerjaCount + stats.lemburCount + stats.liburCount > 0
              const isToday = dateStr === new Date().toISOString().split('T')[0]

              // Determine background color
              let bgColor = 'bg-white hover:bg-slate-50'
              let borderColor = 'border-slate-200'
              let textColor = 'text-slate-800'

              if (hasSchedule) {
                if (stats.lemburCount > 0) {
                  bgColor = 'bg-orange-50 hover:bg-orange-100'
                  borderColor = 'border-orange-300'
                  textColor = 'text-orange-900'
                } else if (weekend) {
                  bgColor = 'bg-blue-50 hover:bg-blue-100'
                  borderColor = 'border-blue-300'
                  textColor = 'text-blue-900'
                } else {
                  bgColor = 'bg-emerald-50 hover:bg-emerald-100'
                  borderColor = 'border-emerald-300'
                  textColor = 'text-emerald-900'
                }
              } else if (weekend) {
                bgColor = 'bg-slate-50 hover:bg-slate-100'
                borderColor = 'border-slate-200'
                textColor = 'text-slate-400'
              }

              return (
                <button
                  key={dateStr}
                  onClick={() => openDateModal(date)}
                  className={`aspect-square rounded-xl border-2 ${borderColor} ${bgColor} ${textColor} p-2 flex flex-col items-start justify-between text-left transition-all hover:scale-[1.02] hover:shadow-md ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-sm font-bold ${weekend ? 'text-rose-600' : ''}`}>
                      {date.getDate()}
                    </span>
                    {isToday && (
                      <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                        HARI INI
                      </span>
                    )}
                  </div>

                  {hasSchedule && (
                    <div className="w-full space-y-0.5">
                      {(stats.kerjaCount + stats.lemburCount) > 0 && (
                        <div className={`text-[9px] font-semibold ${stats.lemburCount > 0 ? 'text-orange-700' : 'text-emerald-700'} truncate`}>
                          👥 {stats.kerjaCount + stats.lemburCount} masuk
                        </div>
                      )}
                      {stats.liburCount > 0 && (
                        <div className="text-[9px] font-semibold text-blue-600 truncate">
                          🏖️ {stats.liburCount} libur
                        </div>
                      )}
                    </div>
                  )}

                  {!hasSchedule && (
                    <div className="text-[9px] text-slate-400">
                      Belum diset
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal Atur Tanggal */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !saving && setSelectedDate(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-violet-600 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white text-lg">
                  📅
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-bold text-lg">
                    Atur Jadwal
                  </h2>
                  <p className="text-white/80 text-xs">
                    {new Date(selectedDate).toLocaleDateString('id-ID', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => !saving && setSelectedDate(null)}
                  disabled={saving}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  Pilih karyawan yang <strong>MASUK</strong>:
                </p>
                <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                  {selectedEmployees.size} / {employees.length} dipilih
                </span>
              </div>

              <div className="space-y-1.5">
                {employees.map((emp) => {
                  const isChecked = selectedEmployees.has(emp.id)
                  const isWeekendDay = isWeekend(new Date(selectedDate))
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                        isChecked
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEmployee(emp.id)}
                        disabled={saving}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      {emp.avatar_url ? (
                        <img
                          src={emp.avatar_url}
                          alt={emp.nama_lengkap}
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold bg-gradient-to-br from-sky-500 to-cyan-500 shadow-sm">
                          {getInitials(emp.nama_lengkap)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {emp.nama_lengkap}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">{emp.email}</p>
                      </div>
                      {isChecked && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          isWeekendDay
                            ? 'bg-orange-100 text-orange-700 border border-orange-300'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        }`}>
                          {isWeekendDay ? 'LEMBUR' : 'KERJA'}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  if (selectedEmployees.size === employees.length) {
                    setSelectedEmployees(new Set())
                  } else {
                    setSelectedEmployees(new Set(employees.map((e) => e.id)))
                  }
                }}
                disabled={saving}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline disabled:opacity-50"
              >
                {selectedEmployees.size === employees.length ? 'Uncheck Semua' : 'Check Semua'}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={saveDateSchedule}
                  disabled={saving}
                  className="px-5 py-2 text-sm text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 rounded-lg transition disabled:opacity-50 inline-flex items-center gap-2 font-semibold shadow-lg shadow-indigo-500/30"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>💾 Simpan Jadwal</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}