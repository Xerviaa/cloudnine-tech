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
  attachment_url: string | null
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

  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null)

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
      if (e.key === 'Escape') {
        if (viewingPhoto) {
          setViewingPhoto(null)
        } else if (selectedRequest && !processing) {
          setSelectedRequest(null)
          setAction(null)
          setCatatan('')
        }
      }
    }
    if (selectedRequest || viewingPhoto) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [selectedRequest, processing, viewingPhoto])

  useEffect(() => {
    if (selectedRequest || viewingPhoto) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selectedRequest, viewingPhoto])

  async function loadRequests() {
    setLoadError('')
    console.log('🚀 Start loading leave requests...')

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
    izin: { label: 'Izin', emoji: '📋', badge: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800' },
    sakit: { label: 'Sakit', emoji: '🏥', badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800' },
    cuti: { label: 'Cuti', emoji: '🌴', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  }

  const statusConfig = {
    pending: { label: 'Menunggu', emoji: '⏳', badge: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
    disetujui: { label: 'Disetujui', emoji: '✅', badge: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
    ditolak: { label: 'Ditolak', emoji: '❌', badge: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800' },
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
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 dark:border-slate-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Memuat data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 transition-colors">
          📋 Kelola Izin & Cuti
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">
          Setujui atau tolak pengajuan izin, sakit, dan cuti karyawan
        </p>
      </div>

      {loadError && (
        <div className="mb-6 bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-300 dark:border-rose-800 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="text-rose-800 dark:text-rose-400 font-bold text-sm">Gagal Memuat Data</p>
            <p className="text-rose-700 dark:text-rose-300 text-xs mt-1">{loadError}</p>
            <button
              onClick={() => loadRequests()}
              className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 underline"
            >
              🔄 Coba Lagi
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Pengajuan</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats.total}</p>
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

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6 transition-colors">
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
              className="pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
          >
            <option value="semua">Semua Status</option>
            <option value="pending">⏳ Menunggu</option>
            <option value="disetujui">✅ Disetujui</option>
            <option value="ditolak">❌ Ditolak</option>
          </select>

          <select
            value={filterTipe}
            onChange={(e) => setFilterTipe(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
          >
            <option value="semua">Semua Tipe</option>
            <option value="izin">📋 Izin</option>
            <option value="sakit">🏥 Sakit</option>
            <option value="cuti">🌴 Cuti</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 dark:from-slate-800 dark:to-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Daftar Pengajuan</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Menampilkan {filteredRequests.length} dari {requests.length} pengajuan
            </p>
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-6xl mb-3 opacity-40">📭</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {requests.length === 0 ? 'Belum ada pengajuan' : 'Tidak ada data yang cocok dengan filter'}
            </p>
            {requests.length === 0 && (
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                Coba buat pengajuan baru di halaman <a href="/izin" className="text-indigo-600 dark:text-indigo-400 underline">/izin</a>
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredRequests.map((r) => {
              const tipeCfg = tipeConfig[r.tipe]
              const statusCfg = statusConfig[r.status]
              const user = r.profiles
              return (
                <div key={r.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition">
                  <div className="flex items-start gap-4">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.nama_lengkap}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-slate-700 shadow-md shrink-0"
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
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {user?.nama_lengkap || 'Unknown User'}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{user?.email || '-'}</span>
                      </div>

                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${tipeCfg.badge}`}>
                          {tipeCfg.emoji} {tipeCfg.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusCfg.badge}`}>
                          {statusCfg.emoji} {statusCfg.label}
                        </span>
                        {r.attachment_url && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                            📎 Ada Lampiran
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-800 dark:text-slate-100 font-semibold">
                        {formatDate(r.tanggal_mulai)} — {formatDate(r.tanggal_selesai)}
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-normal">
                          ({hitungHari(r.tanggal_mulai, r.tanggal_selesai)} hari)
                        </span>
                      </p>

                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">{r.alasan}</p>

                      {r.attachment_url && (
                        <div className="mt-3">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                            📎 Surat Dokter:
                          </p>
                          <button
                            type="button"
                            onClick={() => setViewingPhoto(r.attachment_url)}
                            className="relative group inline-block"
                          >
                            <img
                              src={r.attachment_url}
                              alt="Surat dokter"
                              className="w-28 h-28 object-cover rounded-xl border-2 border-slate-200 dark:border-slate-600 shadow-md transition group-hover:scale-105 group-hover:border-indigo-400"
                            />
                            <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                <line x1="11" y1="8" x2="11" y2="14"/>
                                <line x1="8" y1="11" x2="14" y2="11"/>
                              </svg>
                            </div>
                          </button>
                        </div>
                      )}

                      {r.catatan_admin && (
                        <div className={`mt-3 border-l-2 pl-3 py-2 rounded-r ${
                          r.status === 'disetujui'
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-700'
                            : 'bg-rose-50 dark:bg-rose-900/20 border-rose-400 dark:border-rose-700'
                        }`}>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">
                            Catatan Admin {r.approved_at && `(${formatDateTime(r.approved_at)})`}:
                          </p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 italic">"{r.catatan_admin}"</p>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
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

      {/* Modal Approve/Reject */}
      {selectedRequest && action && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !processing && (setSelectedRequest(null), setAction(null), setCatatan(''))}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col transition-colors"
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

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 w-20">Tipe:</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${tipeConfig[selectedRequest.tipe].badge}`}>
                    {tipeConfig[selectedRequest.tipe].emoji} {tipeConfig[selectedRequest.tipe].label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 w-20">Tanggal:</span>
                  <span className="text-slate-800 dark:text-slate-100 font-medium">
                    {formatDate(selectedRequest.tanggal_mulai)} — {formatDate(selectedRequest.tanggal_selesai)}
                    <span className="ml-1 text-slate-500 dark:text-slate-400">({hitungHari(selectedRequest.tanggal_mulai, selectedRequest.tanggal_selesai)} hari)</span>
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 w-20 shrink-0">Alasan:</span>
                  <span className="text-slate-700 dark:text-slate-300 italic">{selectedRequest.alasan}</span>
                </div>
              </div>

              {selectedRequest.attachment_url && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    📎 Surat Dokter:
                  </label>
                  <button
                    type="button"
                    onClick={() => setViewingPhoto(selectedRequest.attachment_url)}
                    className="relative group w-full"
                  >
                    <img
                      src={selectedRequest.attachment_url}
                      alt="Surat dokter"
                      className="w-full max-h-64 object-contain rounded-xl border-2 border-slate-200 dark:border-slate-600 shadow-md transition group-hover:border-indigo-400 bg-slate-50 dark:bg-slate-900"
                    />
                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition bg-white/90 dark:bg-slate-800/90 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-lg">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                          <line x1="11" y1="8" x2="11" y2="14"/>
                          <line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                        Klik untuk perbesar
                      </div>
                    </div>
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Admin <span className="text-slate-400 dark:text-slate-500 font-normal">(opsional)</span>
                </label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  disabled={!!processing}
                  placeholder={action === 'disetujui'
                    ? 'Contoh: Disetujui, jangan lupa lapor ke atasan...'
                    : 'Contoh: Ditolak karena tanggal berbenturan dengan jadwal...'}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-slate-50 dark:disabled:bg-slate-900 text-sm"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex gap-2 justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequest(null)
                  setAction(null)
                  setCatatan('')
                }}
                disabled={!!processing}
                className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg transition disabled:opacity-50"
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

      {/* Modal Preview Foto Surat Dokter (Fullscreen) */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-[10001] bg-black/95 backdrop-blur-sm"
          onClick={() => setViewingPhoto(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setViewingPhoto(null)
            }}
            className="fixed top-4 right-4 z-[10002] w-12 h-12 bg-white/30 hover:bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-white transition shadow-lg"
            aria-label="Tutup"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div
            className="w-full h-full flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewingPhoto}
              alt="Surat dokter"
              className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}