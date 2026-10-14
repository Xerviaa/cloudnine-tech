'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const router = useRouter()
  const supabase = createClient()

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

  // Upload foto profil
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validasi ukuran (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file terlalu besar. Maksimal 2MB.')
      return
    }

    // Validasi tipe
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar.')
      return
    }

    setUploading(true)
    try {
      // Buat nama file unik
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // Upload ke Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        alert('Gagal upload: ' + uploadError.message)
        setUploading(false)
        return
      }

      // Ambil public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update tabel profiles
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
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Hapus foto profil
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
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Memuat profil...</p>
        </div>
      </main>
    )
  }

  const kecamatanList = kabupaten ? getKecamatanList(kabupaten) : []
  const kelurahanList = kabupaten && kecamatan ? getKelurahanList(kabupaten, kecamatan) : []

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/absen" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur-md opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🏢</span>
              </div>
            </div>
            <div>
              <p className="text-slate-800 font-bold text-lg leading-tight">KantorAbsensi</p>
              <p className="text-slate-500 text-xs">Edit Profil</p>
            </div>
          </Link>

          <button
            onClick={() => router.back()}
            className="text-slate-700 hover:text-indigo-700 text-sm bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-4 py-2 rounded-lg transition font-medium"
          >
            ← Kembali
          </button>
        </div>
      </header>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        {/* Header Profil + Foto */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar Besar */}
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile?.nama_lengkap || 'Avatar'}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-lg"
                />
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full blur-md opacity-50" />
                  <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white font-bold text-2xl ring-4 ring-white shadow-lg">
                    {profile?.nama_lengkap ? getInitials(profile.nama_lengkap) : '?'}
                  </div>
                </>
              )}
            </div>

            {/* Info + Tombol Foto */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-bold text-slate-800">{profile?.nama_lengkap}</h1>
              <p className="text-sm text-slate-500">{profile?.email}</p>
              <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                profile?.role === 'admin'
                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}>
                {profile?.role === 'admin' ? '👑 Admin' : '👤 Karyawan'}
              </span>

              {/* Tombol Foto */}
              <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition disabled:opacity-50"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                    </svg>
                    Hapus
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">📷 Format: JPG, PNG • Maks 50MB</p>
            </div>
          </div>
        </div>

        {/* Form Edit */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <span>📝</span> Data Profil
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
            <input
              type="text"
              value={profile?.nama_lengkap || ''}
              readOnly
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400 mt-1">🔒 Nama tidak dapat diubah</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={profile?.email || ''}
              readOnly
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400 mt-1">🔒 Email tidak dapat diubah</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nomor HP</label>
            <input
              type="tel"
              value={nomorHp}
              onChange={(e) => setNomorHp(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Alamat Jalan</label>
            <textarea
              value={alamatJalan}
              onChange={(e) => setAlamatJalan(e.target.value)}
              placeholder="Contoh: Jl. Raya Kuta No. 123, Gang Melati"
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">📍 Wilayah (Provinsi Bali)</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Kabupaten / Kota</label>
              <select
                value={kabupaten}
                onChange={(e) => {
                  setKabupaten(e.target.value)
                  setKecamatan('')
                  setKelurahan('')
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Pilih Kabupaten/Kota —</option>
                {WILAYAH_BALI.map((kab) => (
                  <option key={kab.nama} value={kab.nama}>{kab.nama}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Kecamatan</label>
              <select
                value={kecamatan}
                onChange={(e) => {
                  setKecamatan(e.target.value)
                  setKelurahan('')
                }}
                disabled={!kabupaten}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">— Pilih Kecamatan —</option>
                {kecamatanList.map((kec) => (
                  <option key={kec.nama} value={kec.nama}>{kec.nama}</option>
                ))}
              </select>
              {!kabupaten && (
                <p className="text-[10px] text-slate-400 mt-1">Pilih kabupaten dulu</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Kelurahan / Desa</label>
              <select
                value={kelurahan}
                onChange={(e) => setKelurahan(e.target.value)}
                disabled={!kecamatan}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">— Pilih Kelurahan/Desa —</option>
                {kelurahanList.map((kel) => (
                  <option key={kel} value={kel}>{kel}</option>
                ))}
              </select>
              {!kecamatan && kabupaten && (
                <p className="text-[10px] text-slate-400 mt-1">Pilih kecamatan dulu</p>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 rounded-xl">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-xl font-medium">
              {message}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium text-sm transition"
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
      </div>
    </main>
  )
}