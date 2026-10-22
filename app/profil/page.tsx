'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WILAYAH_BALI, getKecamatanList, getKelurahanList } from '@/lib/data/bali'

type Profile = {
  id: string
  nama_lengkap: string
  email: string
  role: 'karyawan' | 'admin'
  nomor_hp: string | null
  alamat_jalan: string | null
  kabupaten: string | null
  kecamatan: string | null
  kelurahan: string | null
  avatar_url: string | null
}

export default function ProfilPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')

  // Form state
  const [nomorHp, setNomorHp] = useState('')
  const [alamatJalan, setAlamatJalan] = useState('')
  const [kabupaten, setKabupaten] = useState('')
  const [kecamatan, setKecamatan] = useState('')
  const [kelurahan, setKelurahan] = useState('')

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const ua = navigator.userAgent
    const mobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    setIsMobile(mobile)
  }, [])

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const { data } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (data) {
        setProfile(data)
        setNomorHp(data.nomor_hp || '')
        setAlamatJalan(data.alamat_jalan || '')
        setKabupaten(data.kabupaten || '')
        setKecamatan(data.kecamatan || '')
        setKelurahan(data.kelurahan || '')
        setAvatarUrl(data.avatar_url || null)
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        nomor_hp: nomorHp || null,
        alamat_jalan: alamatJalan || null,
        kabupaten: kabupaten || null,
        kecamatan: kecamatan || null,
        kelurahan: kelurahan || null,
      })
      .eq('id', userId)

    if (updateError) {
      setError('Gagal simpan: ' + updateError.message)
      setSaving(false)
    } else {
      setMessage('✅ Profil berhasil disimpan! Mengarahkan...')
      setTimeout(() => {
        router.push('/absen')
        router.refresh()
      }, 1500)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setShowPhotoMenu(false)

    if (file.size > 50 * 1024 * 1024) {
      alert('Ukuran file terlalu besar. Maksimal 50MB.')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar.')
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        alert('Gagal upload: ' + uploadError.message)
        setUploading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)

      if (updateError) {
        alert('Gagal simpan URL: ' + updateError.message)
        setUploading(false)
        return
      }

      setAvatarUrl(publicUrl)
      alert('✅ Foto profil berhasil diupload!')
    } catch (err: any) {
      alert('Gagal upload: ' + err.message)
    } finally {
      setUploading(false)
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }

  async function handleAvatarDelete() {
    if (!confirm('Yakin hapus foto profil?')) return

    setUploading(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId)

      if (updateError) {
        alert('Gagal hapus: ' + updateError.message)
        setUploading(false)
        return
      }
      setAvatarUrl(null)
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 dark:border-slate-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Memuat profil...</p>
        </div>
      </div>
    )
  }

  const kecamatanList = kabupaten ? getKecamatanList(kabupaten) : []
  const kelurahanList = kabupaten && kecamatan ? getKelurahanList(kabupaten, kecamatan) : []

  return (
    <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
      {/* Header Profil + Foto */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6 transition-colors">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar Besar */}
          <div className="relative group">
            {avatarUrl ? (
              <button
                type="button"
                onClick={() => setShowPhotoModal(true)}
                className="relative cursor-zoom-in group/avatar"
                title="Klik untuk melihat foto"
              >
                <img
                  src={avatarUrl}
                  alt={profile?.nama_lengkap || 'Avatar'}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-white dark:ring-slate-700 shadow-lg transition group-hover/avatar:scale-105 group-hover/avatar:ring-indigo-300"
                />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    <line x1="11" y1="8" x2="11" y2="14"/>
                    <line x1="8" y1="11" x2="14" y2="11"/>
                  </svg>
                </div>
              </button>
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full blur-md opacity-50" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white font-bold text-2xl ring-4 ring-white dark:ring-slate-700 shadow-lg">
                  {profile?.nama_lengkap ? getInitials(profile.nama_lengkap) : '?'}
                </div>
              </>
            )}
          </div>

          {/* Info + Tombol Foto */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 transition-colors">{profile?.nama_lengkap}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">{profile?.email}</p>
            <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
              profile?.role === 'admin'
                ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800'
                : 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800'
            }`}>
              {profile?.role === 'admin' ? '👑 Admin' : '👤 Karyawan'}
            </span>

            {/* Input tersembunyi */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />

            {/* Tombol Foto */}
            <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => setShowPhotoMenu(!showPhotoMenu)}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-lg transition disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" x2="12" y1="3" y2="15"/>
                </svg>
                {uploading ? 'Mengunggah...' : 'Ubah Foto'}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleAvatarDelete}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 rounded-lg transition disabled:opacity-50"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  </svg>
                  Hapus
                </button>
              )}
            </div>

            {/* Menu Pilihan: Kamera / Galeri */}
            {showPhotoMenu && (
              <div className="mt-3 inline-flex gap-2 p-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 px-4 py-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition min-w-[80px]"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                      <circle cx="12" cy="13" r="3"/>
                    </svg>
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Kamera</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 px-4 py-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition min-w-[80px]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600 dark:text-violet-400">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Galeri</span>
                </button>
              </div>
            )}

            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">📷 Format: JPG, PNG • Maks 50MB</p>
          </div>
        </div>
      </div>

      {/* Form Edit */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
          <span>📝</span> Data Profil
        </h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
          <input
            type="text"
            value={profile?.nama_lengkap || ''}
            readOnly
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed"
          />
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">🔒 Nama tidak dapat diubah</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
          <input
            type="email"
            value={profile?.email || ''}
            readOnly
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed"
          />
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">🔒 Email tidak dapat diubah</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nomor HP</label>
          <input
            type="tel"
            value={nomorHp}
            onChange={(e) => setNomorHp(e.target.value)}
            placeholder="Contoh: 081234567890"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Alamat Jalan</label>
          <textarea
            value={alamatJalan}
            onChange={(e) => setAlamatJalan(e.target.value)}
            placeholder="Contoh: Jl. Raya Kuta No. 123, Gang Melati"
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">📍 Wilayah (Provinsi Bali)</p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kabupaten / Kota</label>
            <select
              value={kabupaten}
              onChange={(e) => {
                setKabupaten(e.target.value)
                setKecamatan('')
                setKelurahan('')
              }}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Pilih Kabupaten/Kota —</option>
              {WILAYAH_BALI.map((kab) => (
                <option key={kab.nama} value={kab.nama}>{kab.nama}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kecamatan</label>
            <select
              value={kecamatan}
              onChange={(e) => {
                setKecamatan(e.target.value)
                setKelurahan('')
              }}
              disabled={!kabupaten}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              <option value="">— Pilih Kecamatan —</option>
              {kecamatanList.map((kec) => (
                <option key={kec.nama} value={kec.nama}>{kec.nama}</option>
              ))}
            </select>
            {!kabupaten && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Pilih kabupaten dulu</p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kelurahan / Desa</label>
            <select
              value={kelurahan}
              onChange={(e) => setKelurahan(e.target.value)}
              disabled={!kecamatan}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              <option value="">— Pilih Kelurahan/Desa —</option>
              {kelurahanList.map((kel) => (
                <option key={kel} value={kel}>{kel}</option>
              ))}
            </select>
            {!kecamatan && kabupaten && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Pilih kecamatan dulu</p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm p-3 rounded-xl font-medium">
            {message}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-medium text-sm transition"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Menyimpan...' : '💾 Simpan Profil'}
          </button>
        </div>
      </form>

      {/* Modal Foto Besar */}
      {showPhotoModal && avatarUrl && (
        <div
          className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <button
            onClick={() => setShowPhotoModal(false)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur rounded-full flex items-center justify-center text-white transition z-10"
            aria-label="Tutup"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <img
            src={avatarUrl}
            alt={profile?.nama_lengkap || 'Avatar'}
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-xs bg-black/40 backdrop-blur px-3 py-1.5 rounded-full">
            Klik di luar foto untuk menutup
          </p>
        </div>
      )}
    </div>
  )
}