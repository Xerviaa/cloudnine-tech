'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

// IMPORT KOMPONEN PETA YANG BARU KITA BUAT
const MapComponent = dynamic(() => import('./MapComponent'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400">Memuat Peta...</div>
})

type CompanySettings = {
  id: number
  nama_perusahaan: string
  logo_url: string | null
  jam_masuk: string
  jam_pulang: string
  jam_istirahat_mulai: string
  jam_istirahat_selesai: string
  latitude_kantor: number | null
  longitude_kantor: number | null
  radius_meter: number
}

export default function AdminPengaturanPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [mounted, setMounted] = useState(false)

  // Form State
  const [namaPerusahaan, setNamaPerusahaan] = useState('')
  const [jamMasuk, setJamMasuk] = useState('08:00')
  const [jamPulang, setJamPulang] = useState('16:30')
  const [jamIstirahatMulai, setJamIstirahatMulai] = useState('12:00')
  const [jamIstirahatSelesai, setJamIstirahatSelesai] = useState('13:00')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radius, setRadius] = useState('100')

  // State Berlaku Mulai
  const [berlakuMulai, setBerlakuMulai] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

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
      
      await loadSettings()
      setLoading(false)
    }
    checkAdmin()
  }, [])

  async function loadSettings() {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (data) {
      setSettings(data as any)
      setNamaPerusahaan(data.nama_perusahaan)
      setJamMasuk(data.jam_masuk)
      setJamPulang(data.jam_pulang)
      setJamIstirahatMulai(data.jam_istirahat_mulai)
      setJamIstirahatSelesai(data.jam_istirahat_selesai)
      setLatitude(data.latitude_kantor?.toString() || '')
      setLongitude(data.longitude_kantor?.toString() || '')
      setRadius(data.radius_meter?.toString() || '100')
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const { error: updateError } = await supabase
        .from('company_settings')
        .update({
          nama_perusahaan: namaPerusahaan,
          jam_masuk: jamMasuk,
          jam_pulang: jamPulang,
          jam_istirahat_mulai: jamIstirahatMulai,
          jam_istirahat_selesai: jamIstirahatSelesai,
          latitude_kantor: latitude ? Number(latitude) : null,
          longitude_kantor: longitude ? Number(longitude) : null,
          radius_meter: radius ? Number(radius) : 100,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)

      if (updateError) throw updateError

      const { data: { user } } = await supabase.auth.getUser()
      
      const { error: historyError } = await supabase
        .from('company_settings_history')
        .insert({
          jam_masuk: jamMasuk,
          jam_pulang: jamPulang,
          jam_istirahat_mulai: jamIstirahatMulai,
          jam_istirahat_selesai: jamIstirahatSelesai,
          berlaku_mulai: berlakuMulai,
          created_by: user?.id,
        })

      if (historyError) throw historyError

      alert(`✅ Pengaturan disimpan!\n\nJam kantor baru berlaku mulai: ${new Date(berlakuMulai).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`)
      await loadSettings()
    } catch (err: any) {
      alert('Gagal simpan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran logo maksimal 2MB.')
      return
    }
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar.')
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('company_assets')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('company_assets')
        .getPublicUrl(fileName)

      await supabase
        .from('company_settings')
        .update({ logo_url: publicUrl })
        .eq('id', 1)

      alert('✅ Logo berhasil diupload!')
      await loadSettings()
    } catch (err: any) {
      alert('Gagal upload: ' + err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleGetCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung GPS.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6))
        setLongitude(pos.coords.longitude.toFixed(6))
        alert('✅ Lokasi kantor berhasil diambil dari GPS Anda. Klik "Simpan Pengaturan" untuk menerapkan.')
      },
      (err) => {
        alert('Gagal ambil lokasi: ' + err.message)
      },
      { enableHighAccuracy: true }
    )
  }

  function handleMapClick(lat: number, lng: number) {
    setLatitude(lat.toFixed(6))
    setLongitude(lng.toFixed(6))
  }

  if (loading || !mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Memuat pengaturan...</p>
        </div>
      </main>
    )
  }

  const mapCenter: [number, number] = [
    latitude ? Number(latitude) : -8.650000,
    longitude ? Number(longitude) : 115.216667,
  ]
  const radiusNum = Number(radius) || 100

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur-md opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⚙️</span>
              </div>
            </div>
            <div>
              <p className="text-slate-800 font-bold text-lg leading-tight">AbsenKita</p>
              <p className="text-slate-500 text-xs">Pengaturan Perusahaan</p>
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

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">⚙️ Pengaturan Perusahaan</h1>
          <p className="text-slate-500 text-sm mt-1">
            Atur identitas perusahaan, jam kantor, dan lokasi untuk validasi GPS
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Kartu Identitas */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>🏢</span> Identitas Perusahaan
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Perusahaan</label>
              <input
                type="text"
                value={namaPerusahaan}
                onChange={(e) => setNamaPerusahaan(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Logo Perusahaan</label>
              <div className="flex items-center gap-4">
                {settings?.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt="Logo"
                    className="w-24 h-24 rounded-xl object-contain bg-slate-100 border border-slate-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <span className="text-3xl">🏢</span>
                  </div>
                )}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition disabled:opacity-50"
                  >
                    {uploading ? 'Mengunggah...' : '📷 Ganti Logo'}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">Format: PNG, JPG. Maks 2MB</p>
                </div>
              </div>
            </div>
          </div>

          {/* Kartu Jam Kantor */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>⏰</span> Jam Operasional
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jam Masuk</label>
                <input
                  type="time"
                  value={jamMasuk}
                  onChange={(e) => setJamMasuk(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jam Pulang</label>
                <input
                  type="time"
                  value={jamPulang}
                  onChange={(e) => setJamPulang(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Istirahat Mulai</label>
                <input
                  type="time"
                  value={jamIstirahatMulai}
                  onChange={(e) => setJamIstirahatMulai(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Istirahat Selesai</label>
                <input
                  type="time"
                  value={jamIstirahatSelesai}
                  onChange={(e) => setJamIstirahatSelesai(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* INPUT BARU: Berlaku Mulai */}
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <label className="block text-sm font-bold text-amber-800 mb-1">
                ⚠️ Jam Kantor Baru Berlaku Mulai Tanggal:
              </label>
              <input
                type="date"
                value={berlakuMulai}
                onChange={(e) => setBerlakuMulai(e.target.value)}
                required
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[10px] text-amber-700 mt-1">
                Perubahan jam kantor TIDAK akan mengubah data absensi sebelum tanggal ini. Direkomendasikan memilih <strong>besok</strong> atau tanggal mendatang.
              </p>
            </div>
          </div>

          {/* Kartu Lokasi Kantor (Geofencing) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📍</span> Lokasi Kantor (Validasi GPS)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Klik pada peta untuk memilih lokasi kantor. Pin bisa digeser. Lingkaran abu-abu adalah radius validasi.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="-8.650000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="115.216667"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Radius Maksimal (meter)</label>
              <input
                type="number"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                placeholder="100"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Karyawan tidak bisa absen jika di luar radius ini.</p>
            </div>

            {/* ============================================================ */}
            {/* PETA LEAFLET (SUDAH DIGANTI DENGAN KOMPONEN BARU)            */}
            {/* ============================================================ */}
            <div className="mb-4 rounded-xl overflow-hidden border border-slate-300 shadow-inner" style={{ height: '400px' }}>
              <MapComponent 
                center={mapCenter} 
                radius={radiusNum} 
                onMapClick={handleMapClick} 
              />
            </div>

            <button
              type="button"
              onClick={handleGetCurrentLocation}
              className="w-full py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center justify-center gap-2"
            >
              📡 Ambil Lokasi dari GPS Saat Ini
            </button>
          </div>

          {/* Tombol Simpan */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>💾 Simpan Pengaturan</>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}