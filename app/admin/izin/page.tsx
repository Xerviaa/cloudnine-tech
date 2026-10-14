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
  profiles?: Profile | null
}

export default function AdminIzinPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [processing, setProcessing] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string>('')

  const [filterStatus, setFilterStatus] = useState<'semua' | 'pending' | 'disetujui' | 'ditolak'>('semua')
  const [filterTipe, setFilterTipe] = useState<'semua' | 'izin' | 'sakit' | 'cuti'>('semua')
  const [searchUser, setSearchUser] = useState('')

  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [action, setAction] = useState<'disetujui' | 'ditolak' | null>(null)
  const [catatan, setCatatan] = useState('')

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
      await loadRequests()
      setLoading(false)
    }
    checkAdmin()
  }, [])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && !processing) {
        setSelectedRequest(null)
        setAction(null)
        setCatatan('')
      }
    }
    if (selectedRequest) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [selectedRequest, processing])

  useEffect(() => {
    if (selectedRequest) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selectedRequest])

  // ============================================================
  // QUERY TERPISAH: Ambil leave_requests, lalu ambil profiles
  // ============================================================
  async function loadRequests() {
    setLoadError('')
    console.log('🚀 Start loading leave requests...')

    // STEP 1: Ambil semua leave_requests
    const { data: requestsData, error: requestsError } = await supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (requestsError) {
      console.error('❌ ERROR STEP 1 (leave_requests):', requestsError)
      setLoadError(`Gagal memuat pengajuan: ${requestsError.message}`)
      return
    }

    console.log('✅ STEP 1 OK. Dapat', requestsData?.length || 0, 'pengajuan')

    if (!requestsData || requestsData.length === 0) {
      setRequests([])
      return
    }

    // STEP 2: Ambil profile untuk semua user_id yang ada
    const userIds = [...new Set(requestsData.map((r: any) => r.user_id))]
    console.log('📋 User IDs yang perlu di-load:', userIds.length)

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, email, avatar_url, role')
      .in('id', userIds)

    if (profilesError) {
      console.error('❌ ERROR STEP 2 (profiles):', profilesError)
      setLoadError(`Gagal memuat profil: ${profilesError.message}`)
      return
    }

    console.log('✅ STEP 2 OK. Dapat', profilesData?.length || 0, 'profiles')

    // STEP 3: Gabungkan
    const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]))
    const merged = requestsData.map((r: any) => ({
      ...r,
      profiles: profilesMap.get(r.user_id) || null,
    }))

    console.log('✅ Selesai. Total', merged.length, 'pengajuan siap ditampilkan')
    setRequests(merged as any)
  }

  async function handleAction() {
    if (!selectedRequest || !action || !profile) return

    setProcessing(selectedRequest.id)
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: action,
          catatan_admin: catatan.trim() || null,
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id)

      if (error) {
        alert('Gagal update: ' + error.message)
        setProcessing(null)
        return
      }

      alert(`✅ Pengajuan ${action === 'disetujui' ? 'disetujui' : 'ditolak'}!`)
      setSelectedRequest(null)
      setAction(null)
      setCatatan('')
      await loadRequests()
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    } finally {
      setProcessing(null)
    }
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
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  const tipeConfig = {
    izin: { label: 'Izin', emoji: '📋', badge: 'bg-sky-100 text-sky-700 border-sky-200' },
    sakit: { label: 'Sakit', emoji: '🏥', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
    cuti: { label: 'Cuti', emoji: '🌴', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  }

  const statusConfig = {
    pending: { label: 'Menunggu', emoji: '⏳', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
    disetujui: { label: 'Disetujui', emoji: '✅', badge: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    ditolak: { label: 'Ditolak', emoji: '❌', badge: 'bg-rose-100 text-rose-700 border-rose-300' },
  }

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchStatus = filterStatus === 'semua' || r.status === filterStatus
      const matchTipe = filterTipe === 'semua' || r.tipe === filterTipe
      const matchSearch = !searchUser ||
        (r.profiles?.nama_lengkap?.toLowerCase().includes(searchUser.toLowerCase()) ||
         r.profiles?.email?.toLowerCase().includes(searchUser.toLowerCase()))
      return matchStatus && matchTipe && matchSearch
    })
  }, [requests, filterStatus, filterTipe, searchUser])

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
              <p className="text-slate-500 text-xs">Kelola Izin & Cuti</p>
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
            📋 Kelola Izin & Cuti
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Setujui atau tolak pengajuan izin, sakit, dan cuti karyawan
          </p>
        </div>

        {/* Error Alert */}
        {loadError && (
          <div className="mb-6 bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-rose-800 font-bold text-sm">Gagal Memuat Data</p>
              <p className="text-rose-700 text-xs mt-1">{loadError}</p>
              <button
                onClick={() => loadRequests()}
                className="mt-2 text-xs font-semibold text-rose-700 hover:text-rose-900 underline"
              >
                🔄 Coba Lagi
              </button>
            </div>
          </div>
        )}

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

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Cari nama atau email karyawan..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
            >
              <option value="semua">Semua Status</option>
              <option value="pending">⏳ Menunggu</option>
              <option value="disetujui">✅ Disetujui</option>
              <option value="ditolak">❌ Ditolak</option>
            </select>

            <select
              value={filterTipe}
              onChange={(e) => setFilterTipe(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
            >
              <option value="semua">Semua Tipe</option>
              <option value="izin">📋 Izin</option>
              <option value="sakit">🏥 Sakit</option>
              <option value="cuti">🌴 Cuti</option>
            </select>
          </div>
        </div>

        {/* Daftar Pengajuan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-800">Daftar Pengajuan</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan {filteredRequests.length} dari {requests.length} pengajuan
              </p>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-6xl mb-3 opacity-40">📭</p>
              <p className="text-slate-500 text-sm font-medium">
                {requests.length === 0 ? 'Belum ada pengajuan' : 'Tidak ada data yang cocok dengan filter'}
              </p>
              {requests.length === 0 && (
                <p className="text-slate-400 text-xs mt-1">
                  Coba buat pengajuan baru di halaman <a href="/izin" className="text-indigo-600 underline">/izin</a>
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRequests.map((r) => {
                const tipeCfg = tipeConfig[r.tipe]
                const statusCfg = statusConfig[r.status]
                const user = r.profiles
                return (
                  <div key={r.id} className="p-5 hover:bg-slate-50/50 transition">
                    <div className="flex items-start gap-4">
                      {user?.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.nama_lengkap}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-md shrink-0"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md shrink-0 ${
                          user?.role === 'admin'
                            ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600'
                            : 'bg-gradient-to-br from-sky-500 to-cyan-500'
                        }`}>
                          {user?.nama_lengkap ? getInitials(user.nama_lengkap) : '?'}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-800">
                            {user?.nama_lengkap || 'Unknown User'}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500">{user?.email || '-'}</span>
                        </div>

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
                          <div className={`mt-3 border-l-2 pl-3 py-2 rounded-r ${
                            r.status === 'disetujui'
                              ? 'bg-emerald-50 border-emerald-400'
                              : 'bg-rose-50 border-rose-400'
                          }`}>
                            <p className="text-[10px] text-slate-500 font-medium mb-0.5">
                              Catatan Admin {r.approved_at && `(${formatDateTime(r.approved_at)})`}:
                            </p>
                            <p className="text-xs text-slate-700 italic">"{r.catatan_admin}"</p>
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400 mt-2">
                          Diajukan: {formatDateTime(r.created_at)}
                        </p>

                        {r.status === 'pending' && (
                          <div className="mt-3 flex gap-2 flex-wrap">
                            <button
                              onClick={() => {
                                setSelectedRequest(r)
                                setAction('disetujui')
                                setCatatan('')
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-lg shadow-md shadow-emerald-500/30 transition"
                            >
                              ✅ Setujui
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequest(r)
                                setAction('ditolak')
                                setCatatan('')
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 rounded-lg shadow-md shadow-rose-500/30 transition"
                            >
                              ❌ Tolak
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Approve/Reject */}
      {selectedRequest && action && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !processing && (setSelectedRequest(null), setAction(null), setCatatan(''))}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-5 ${
              action === 'disetujui'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : 'bg-gradient-to-r from-rose-500 to-pink-500'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white text-lg">
                  {action === 'disetujui' ? '✅' : '❌'}
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">
                    {action === 'disetujui' ? 'Setujui Pengajuan' : 'Tolak Pengajuan'}
                  </h2>
                  <p className="text-white/80 text-xs">
                    {selectedRequest.profiles?.nama_lengkap || 'Karyawan'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-20">Tipe:</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${tipeConfig[selectedRequest.tipe].badge}`}>
                    {tipeConfig[selectedRequest.tipe].emoji} {tipeConfig[selectedRequest.tipe].label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-20">Tanggal:</span>
                  <span className="text-slate-800 font-medium">
                    {formatDate(selectedRequest.tanggal_mulai)} — {formatDate(selectedRequest.tanggal_selesai)}
                    <span className="ml-1 text-slate-500">({hitungHari(selectedRequest.tanggal_mulai, selectedRequest.tanggal_selesai)} hari)</span>
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-slate-500 w-20 shrink-0">Alasan:</span>
                  <span className="text-slate-700 italic">{selectedRequest.alasan}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Catatan Admin <span className="text-slate-400 font-normal">(opsional)</span>
                </label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  disabled={!!processing}
                  placeholder={action === 'disetujui'
                    ? 'Contoh: Disetujui, jangan lupa lapor ke atasan...'
                    : 'Contoh: Ditolak karena tanggal berbenturan dengan jadwal...'}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-slate-50 text-sm"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequest(null)
                  setAction(null)
                  setCatatan('')
                }}
                disabled={!!processing}
                className="px-4 py-2 text-sm text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAction}
                disabled={!!processing}
                className={`px-4 py-2 text-sm text-white rounded-lg transition disabled:opacity-50 inline-flex items-center gap-2 font-semibold shadow-lg ${
                  action === 'disetujui'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-rose-500/30'
                }`}
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    {action === 'disetujui' ? '✅ Setujui' : '❌ Tolak'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}