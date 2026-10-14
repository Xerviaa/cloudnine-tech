'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
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
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preview foto besar
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null)

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

  // Reset file kalau tipe bukan sakit
  useEffect(() => {
    if (tipe !== 'sakit') {
      setFile(null)
      setFilePreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [tipe])

  // Lock body scroll saat preview foto
  useEffect(() => {
    if (viewingPhoto) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [viewingPhoto])

  async function loadRequests(userId: string) {
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    setRequests((data as any) || [])
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validasi tipe file
    if (!selectedFile.type.startsWith('image/')) {
      alert('File harus berupa gambar (JPG, PNG, dll).')
      e.target.value = ''
      return
    }

    // Validasi ukuran max 5MB
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB.')
      e.target.value = ''
      return
    }

    setFile(selectedFile)

    // Buat preview
    const reader = new FileReader()
    reader.onload = (ev) => setFilePreview(ev.target?.result as string)
    reader.readAsDataURL(selectedFile)
  }

  function removeFile() {
    setFile(null)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadAttachment(userId: string, selectedFile: File): Promise<string | null> {
    try {
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('leave_attachments')
        .upload(fileName, selectedFile, { upsert: false })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error(uploadError.message)
      }

      const { data: { publicUrl } } = supabase.storage
        .from('leave_attachments')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (err: any) {
      console.error('Upload failed:', err)
      throw err
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    // Validasi dasar
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

    // Validasi wajib foto untuk tipe SAKIT
    if (tipe === 'sakit' && !file) {
      alert('Untuk pengajuan Sakit, wajib upload foto Surat Dokter.')
      return
    }

    setSubmitting(true)
    try {
      let attachmentUrl: string | null = null

      // Upload foto jika ada
      if (file) {
        setUploading(true)
        try {
          attachmentUrl = await uploadAttachment(profile.id, file)
        } catch (err: any) {
          alert('Gagal upload foto: ' + err.message)
          setSubmitting(false)
          setUploading(false)
          return
        } finally {
          setUploading(false)
        }
      }

      // Insert pengajuan
      const { error } = await supabase.from('leave_requests').insert({
        user_id: profile.id,
        tipe,
        tanggal_mulai: tanggalMulai,
        tanggal_selesai: tanggalSelesai,
        alasan: alasan.trim(),
        attachment_url: attachmentUrl,
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
      setFile(null)
      setFilePreview(null)
      await loadRequests(profile.id)
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number, attachmentUrl: string | null) {
    if (!confirm('Yakin ingin menghapus pengajuan ini?')) return

    // Hapus file dari storage kalau ada
    if (attachmentUrl) {
      try {
        // Extract path dari URL
        const urlParts = attachmentUrl.split('/leave_attachments/')
        if (urlParts.length > 1) {
          const filePath = decodeURIComponent(urlParts[1])
          await supabase.storage.from('leave_attachments').remove([filePath])
        }
      } catch (err) {
        console.warn('Gagal hapus file dari storage:', err)
        // Lanjut hapus data DB walau file gagal
      }
    }

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

              {/* Info wajib upload untuk sakit */}
              {tipe === 'sakit' && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-lg">ℹ️</span>
                  <p className="text-xs text-rose-700 leading-snug">
                    Untuk pengajuan <strong>Sakit</strong>, wajib melampirkan <strong>foto Surat Dokter</strong>.
                  </p>
                </div>
              )}

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

              {/* Upload Surat Dokter (muncul untuk tipe sakit) */}
              {tipe === 'sakit' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Foto Surat Dokter <span className="text-rose-500 font-normal">*</span>
                  </label>
                  
                  {!filePreview ? (
                    <label className="cursor-pointer block">
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition">
                        <div className="text-4xl mb-2">📷</div>
                        <p className="text-sm font-medium text-slate-700">Klik untuk upload foto</p>
                        <p className="text-xs text-slate-400 mt-1">JPG, PNG • Maks 5MB</p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        disabled={submitting}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="relative border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                      <img
                        src={filePreview}
                        alt="Preview surat dokter"
                        className="w-full max-h-72 object-contain"
                      />
                      <button
                        type="button"
                        onClick={removeFile}
                        disabled={submitting}
                        className="absolute top-2 right-2 w-8 h-8 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg transition disabled:opacity-50"
                      >
                        ✕
                      </button>
                      <div className="px-3 py-2 bg-white border-t border-slate-200">
                        <p className="text-xs text-slate-600 truncate font-medium">{file?.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {file && (file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                  )}
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
                  onClick={() => {
                    setShowForm(false)
                    setFile(null)
                    setFilePreview(null)
                  }}
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
                      {uploading ? 'Upload foto...' : 'Mengirim...'}
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

                        {/* Foto Surat Dokter */}
                        {r.attachment_url && (
                          <div className="mt-3">
                            <p className="text-[10px] text-slate-500 font-medium mb-1">
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
                                className="w-32 h-32 object-cover rounded-xl border-2 border-slate-200 shadow-md transition group-hover:scale-105 group-hover:border-indigo-400"
                              />
                              <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                          onClick={() => handleDelete(r.id, r.attachment_url)}
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
                <li>Pengajuan <strong>Sakit</strong> wajib upload Surat Dokter</li>
                <li>Pengajuan yang <strong>pending</strong> bisa dibatalkan sendiri</li>
                <li>Pengajuan yang sudah <strong>disetujui/ditolak</strong> tidak bisa diubah</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Preview Foto Surat Dokter */}
      {viewingPhoto && (
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
    </main>
  )
}