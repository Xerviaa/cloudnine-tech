'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type CompanySettings = {
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

export default function ProfilPerusahaanPage() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (data) setSettings(data)
      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 dark:border-slate-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Memuat profil perusahaan...</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-slate-500 dark:text-slate-400">Data perusahaan belum diatur.</p>
      </div>
    )
  }

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
      {/* Header Profil Perusahaan */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-6 transition-colors">
        <div className="h-32 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
        <div className="px-8 pb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-12">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl blur-md opacity-50" />
              {settings.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={settings.nama_perusahaan}
                  className="relative w-28 h-28 rounded-2xl object-contain bg-white dark:bg-slate-800 p-2 ring-4 ring-white dark:ring-slate-800 shadow-xl"
                />
              ) : (
                <div className="relative w-28 h-28 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-4xl ring-4 ring-white dark:ring-slate-800 shadow-xl">
                  🏢
                </div>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left pb-2">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors">
                {settings.nama_perusahaan}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Profil & Informasi Perusahaan
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Jam Operasional */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>⏰</span> Jam Operasional
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
              <span className="text-sm text-slate-500 dark:text-slate-400">Jam Masuk</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{settings.jam_masuk} WITA</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
              <span className="text-sm text-slate-500 dark:text-slate-400">Jam Pulang</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{settings.jam_pulang} WITA</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">Jam Istirahat</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                {settings.jam_istirahat_mulai} - {settings.jam_istirahat_selesai} WITA
              </span>
            </div>
          </div>
        </div>

        {/* Lokasi Kantor */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>📍</span> Lokasi Kantor
          </h2>
          {settings.latitude_kantor && settings.longitude_kantor ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
                <span className="text-sm text-slate-500 dark:text-slate-400">Latitude</span>
                <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">{settings.latitude_kantor}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
                <span className="text-sm text-slate-500 dark:text-slate-400">Longitude</span>
                <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">{settings.longitude_kantor}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400">Radius Validasi</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{settings.radius_meter} meter</span>
              </div>
              <a
                href={`https://www.google.com/maps?q=${settings.latitude_kantor},${settings.longitude_kantor}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block w-full text-center py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
              >
                Buka di Google Maps
              </a>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic">Lokasi kantor belum diatur.</p>
          )}
        </div>
      </div>

      {/* Deskripsi / Tentang Perusahaan */}
      <div className="mt-6 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 rounded-2xl p-6 shadow-xl shadow-indigo-500/20 text-white">
        <h2 className="text-lg font-bold mb-2">Tentang {settings.nama_perusahaan}</h2>
        <p className="text-sm text-white/90 leading-relaxed">
          {settings.nama_perusahaan} adalah perusahaan yang berkomitmen untuk memberikan solusi terbaik. 
          Kami menggunakan sistem AbsenKita untuk memastikan kehadiran karyawan tercatat dengan akurat, 
          transparan, dan efisien.
        </p>
      </div>
    </div>
  )
}