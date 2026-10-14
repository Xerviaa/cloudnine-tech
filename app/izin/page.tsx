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

type LeaveRequest = {
  id: number
  user_id: string
  tipe: 'izin' | 'sakit' | 'cuti'
  tanggal_mulai: string
  tanggal_selesai: string
  alasan: string
  status: 'pending' | 'disetujui' | 'ditolak'
  catatan_admin: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export default function IzinPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [tipe, setTipe] = useState<'izin' | 'sakit' | 'cuti'>('izin')
  const [tanggalMulai, setTanggalMulai] = useState('')
  const [tanggalSelesai, setTanggalSelesai] = useState('')
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

      await loadRequests(user.id)
      setLoading(false)
    }
    loadData()
  }, [])

  async function loadRequests(userId: string) {
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    setRequests((data as any) || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    // Validasi
    if (!tanggalMulai || !tanggalSelesai) {
      alert('Tanggal mulai & selesai harus diisi.')
      return
    }
    if (new Date(tanggalMulai) > new Date(tanggalSelesai)) {
      alert('Tanggal mulai tidak boleh lebih besar dari tanggal selesai.')
      return
    }
    if (!alasan.trim()) {
      alert('Alasan harus diisi.')
      return
    }
    if (alasan.length < 10) {
      alert('Alasan minimal 10 karakter.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('leave_requests').insert({
        user_id: profile.id,
        tipe,
        tanggal_mulai: tanggalMulai,
        tanggal_selesai: tanggalSelesai,
        alasan: alasan.trim(),
      })

      if (error) {
        alert('Gagal mengajukan: ' + error.message)
        setSubmitting(false)
        return
      }

      alert('✅ Pengajuan berhasil dikirim! Menunggu persetujuan admin.')
      setShowForm(false)
      setTipe('izin')
      setTanggalMulai('')
      setTanggalSelesai('')
      setAlasan('')
      await loadRequests(profile.id)
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Yakin ingin menghapus pengajuan ini?')) return
    const { error } = await supabase.from('leave_requests').delete().eq('id', id)
    if (error) {
      alert('Gagal hapus: ' + error.message)
      return
    }
    if (profile) await loadRequests(profile.id)
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const hitungHari = (mulai: string, selesai: string) => {
    const start = new Date(mulai)
    const end = new Date(selesai)
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return diff
  }

  const tipeConfig = {
    izin: { label: 'Izin', emoji: '📋', color: 'from-sky-500 to-cyan-500', badge: 'bg-sky-100 text-sky-700 border-sky-200' },
    sakit: { label: 'Sakit', emoji: '🏥', color: 'from-rose-500 to-pink-500', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
    cuti: { label: 'Cuti', emoji: '🌴', color: 'from-emerald-500 to-teal-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  }

  const statusConfig = {
    pending: { label: 'Menunggu', emoji: '⏳', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
    disetujui: { label: 'Disetujui', emoji: '✅', badge: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    ditolak: { label: 'Ditolak', emoji: '❌', badge: 'bg-rose-100 text-rose-700 border-rose-300' },
  }

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      disetujui: requests.filter((r) => r.status === 'disetujui').length,
      ditolak: requests.filter((r) => r.status === 'ditolak').length,
    }
  }, [requests])

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
              <p className="text-slate-500 text-xs">Izin & Cuti</p>
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
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              📝 Izin & Cuti
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Ajukan izin, sakit, atau cuti. Lihat status persetujuan di sini.
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-white font-semibold text-sm rounded-xl shadow-lg transition-all hover:scale-[1.02] ${
              showForm
                ? 'bg-gradient-to-r from-slate-500 to-slate-600 shadow-slate-500/30'
                : 'bg-gradient-to-r from-indigo-500 to-violet-600 shadow-indigo-500/30'
            }`}
          >
            {showForm ? (
              <>✕ Tutup Form</>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Ajukan Baru
              </>
            )}
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">Total Pengajuan</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 shadow-lg shadow-amber-500/25">
            <p className="text-xs text-white/90 font-medium">Menunggu</p>
            <p className="text-3xl font-bold text-white mt-1">{stats.pending}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-4 shadow-lg shadow-emerald-500/25">
            <p className="text-xs text-white/90 font-medium">Disetujui</p>
            <p className="text-3xl font-bold text-white mt-1">{stats.disetujui}</p>
          </div>
          <div className="bg-gradient-to-br from-rose-500 to-pink-500 rounded-2xl p-4 shadow-lg shadow-rose-500/25">
            <p className="text-xs text-white/90 font-medium">Ditolak</p>
            <p className="text-3xl font-bold text-white mt-1">{stats.ditolak}</p>
          </div>
        </div>

        {/* Form Pengajuan */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📝</span> Form Pengajuan Baru
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipe */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipe Pengajuan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['izin', 'sakit', 'cuti'] as const).map((t) => {
                    const cfg = tipeConfig[t]
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipe(t)}
                        className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition font-medium text-sm ${
                          tipe === t
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-2xl">{cfg.emoji}</span>
                        <span>{cfg.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    disabled={submitting}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={tanggalSelesai}
                    onChange={(e) => setTanggalSelesai(e.target.value)}
                    disabled={submitting}
                    min={tanggalMulai}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 text-sm"
                  />
                </div>
              </div>

              {tanggalMulai && tanggalSelesai && new Date(tanggalMulai) <= new Date(tanggalSelesai) && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-indigo-700 font-medium">
                    📅 Total: <strong>{hitungHari(tanggalMulai, tanggalSelesai)} hari</strong>
                  </p>
                </div>
              )}

              {/* Alasan */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Alasan <span className="text-slate-400 font-normal">(min. 10 karakter)</span>
                </label>
                <textarea
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  disabled={submitting}
                  placeholder="Contoh: Ada acara keluarga di luar kota..."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-slate-50 text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">{alasan.length} karakter</p>
              </div>

              {/* Tombol */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 rounded-lg transition disabled:opacity-50 inline-flex items-center gap-2 font-semibold shadow-lg shadow-indigo-500/30"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    <>📤 Kirim Pengajuan</>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Daftar Pengajuan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-violet-50/50">
            <h2 className="text-base font-bold text-slate-800">Riwayat Pengajuan</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {requests.length} pengajuan total
            </p>
          </div>

          {requests.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-6xl mb-3 opacity-40">📭</p>
              <p className="text-slate-500 text-sm font-medium">Belum ada pengajuan</p>
              <p className="text-slate-400 text-xs mt-1">Klik "Ajukan Baru" untuk memulai</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map((r) => {
                const tipeCfg = tipeConfig[r.tipe]
                const statusCfg = statusConfig[r.status]
                return (
                  <div key={r.id} className="p-5 hover:bg-slate-50/50 transition">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${tipeCfg.badge}`}>
                            {tipeCfg.emoji} {tipeCfg.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusCfg.badge}`}>
                            {statusCfg.emoji} {statusCfg.label}
                          </span>
                        </div>

                        <p className="text-sm text-slate-800 font-semibold">
                          {formatDate(r.tanggal_mulai)} — {formatDate(r.tanggal_selesai)}
                          <span className="ml-2 text-xs text-slate-500 font-normal">
                            ({hitungHari(r.tanggal_mulai, r.tanggal_selesai)} hari)
                          </span>
                        </p>

                        <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{r.alasan}</p>

                        {r.catatan_admin && (
                          <div className="mt-3 bg-slate-50 border-l-2 border-slate-400 pl-3 py-2 rounded-r">
                            <p className="text-[10px] text-slate-500 font-medium mb-0.5">Catatan Admin:</p>
                            <p className="text-xs text-slate-700 italic">"{r.catatan_admin}"</p>
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400 mt-2">
                          Diajukan: {formatDateTime(r.created_at)}
                        </p>
                      </div>

                      {r.status === 'pending' && (
                        <button
                          onClick={() => handleDelete(r.id)}
                          title="Batalkan pengajuan"
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
              <p className="font-semibold">Informasi:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Pengajuan akan diperiksa oleh admin</li>
                <li>Pengajuan yang <strong>pending</strong> bisa dibatalkan sendiri</li>
                <li>Pengajuan yang sudah <strong>disetujui/ditolak</strong> tidak bisa diubah</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}