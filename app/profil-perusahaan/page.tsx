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
      {/* Header Profil Perusahaan - DIPERCANTIK */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-indigo-500/10 border border-slate-200 dark:border-slate-700 overflow-hidden mb-8 transition-colors relative">
        {/* Background Pattern */}
        <div className="h-40 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10" />
        </div>
        
        <div className="px-8 pb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 relative z-10">
            <div className="relative group">
              <div className="absolute inset-0 bg-white dark:bg-slate-800 rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition" />
              {settings.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={settings.nama_perusahaan}
                  className="relative w-32 h-32 rounded-2xl object-contain bg-white dark:bg-slate-800 p-2 ring-4 ring-white dark:ring-slate-800 shadow-2xl transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="relative w-32 h-32 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-5xl ring-4 ring-white dark:ring-slate-800 shadow-2xl">
                  🏢
                </div>
              )}
              {/* Badge Terverifikasi */}
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full ring-4 ring-white dark:ring-slate-800 shadow-lg" title="Perusahaan Terverifikasi">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
            
            <div className="flex-1 text-center sm:text-left pb-2">
              <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 transition-colors">
                  {settings.nama_perusahaan}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 uppercase tracking-wider">
                  ✨ Tech Company
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-center sm:justify-start gap-2">
                <span>📍 Denpasar, Bali</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span>Est. 2021</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Grid - DIPERCANTIK */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Jam Operasional */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors hover:shadow-md">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Jam Operasional</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Waktu kerja standar (WITA)</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">🌅 Jam Masuk</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg">{settings.jam_masuk}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">🌇 Jam Pulang</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg">{settings.jam_pulang}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">☕ Jam Istirahat</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                {settings.jam_istirahat_mulai} - {settings.jam_istirahat_selesai}
              </span>
            </div>
          </div>
        </div>

        {/* Lokasi Kantor */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors hover:shadow-md">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Lokasi Kantor</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Titik pusat & radius validasi</p>
            </div>
          </div>
          {settings.latitude_kantor && settings.longitude_kantor ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">Latitude</p>
                  <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 truncate">{settings.latitude_kantor}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">Longitude</p>
                  <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 truncate">{settings.longitude_kantor}</p>
                </div>
              </div>
              <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Radius Validasi Absen</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{settings.radius_meter} meter</span>
              </div>
              <a
                href={`https://www.google.com/maps?q=${settings.latitude_kantor},${settings.longitude_kantor}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block w-full text-center py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Buka di Google Maps
              </a>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic">Lokasi kantor belum diatur.</p>
          )}
        </div>
      </div>

      {/* Tentang Perusahaan - DIPERCANTIK & DESKRIPSI BARU */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-3xl p-8 shadow-2xl shadow-indigo-500/30 text-white">
        {/* Dekorasi Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-2xl shadow-lg">
              🚀
            </div>
            <div>
              <h2 className="text-2xl font-bold">Tentang {settings.nama_perusahaan}</h2>
              <p className="text-xs text-white/70 font-medium tracking-wider uppercase">Building the Future</p>
            </div>
          </div>
          
          <p className="text-sm text-white/90 leading-relaxed mb-4">
            <strong>{settings.nama_perusahaan}</strong> adalah perusahaan teknologi yang berdedikasi untuk menciptakan solusi digital inovatif. 
            Berdiri sejak <strong>2021</strong>, kami telah membantu berbagai bisnis bertransformasi melalui pengembangan perangkat lunak, 
            sistem berbasis cloud, dan integrasi kecerdasan artifisial yang andal.
          </p>
          <p className="text-sm text-white/90 leading-relaxed">
            Kami percaya bahwa teknologi terbaik adalah teknologi yang memudahkan hidup manusia. Dengan semangat kolaborasi dan inovasi tanpa henti, 
            <strong>{settings.nama_perusahaan}</strong> siap menjadi mitra digital terpercaya Anda di era modern ini.
          </p>

          {/* Statistik Perusahaan */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/20">
            <div className="text-center">
              <p className="text-3xl font-bold">2021</p>
              <p className="text-xs text-white/70 mt-1">Tahun Berdiri</p>
            </div>
            <div className="text-center border-x border-white/20">
              <p className="text-3xl font-bold">50+</p>
              <p className="text-xs text-white/70 mt-1">Klien Puas</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">100%</p>
              <p className="text-xs text-white/70 mt-1">Komitmen</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}