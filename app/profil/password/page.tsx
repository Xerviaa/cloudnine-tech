'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import PasswordStrength, { checkPasswordStrength } from '@/components/PasswordStrength'

export default function UbahPasswordPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [nama, setNama] = useState('')

  const [passwordLama, setPasswordLama] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')

  const [showLama, setShowLama] = useState(false)
  const [showBaru, setShowBaru] = useState(false)
  const [showKonfirmasi, setShowKonfirmasi] = useState(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email || '')

      const { data } = await supabase
        .from('profiles').select('nama_lengkap').eq('id', user.id).single()
      if (data) setNama(data.nama_lengkap)

      setLoading(false)
    }
    loadUser()
  }, [])

  // Cek apakah password baru dan konfirmasi sama
  const passwordMatch = passwordBaru.length > 0 && passwordBaru === konfirmasi
  const passwordTidakMatch = konfirmasi.length > 0 && passwordBaru !== konfirmasi

  // Cek kekuatan password baru
  const { level } = checkPasswordStrength(passwordBaru)
  const passwordKuat = level === 'kuat' || level === 'sedang'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    // Validasi
    if (!passwordLama) {
      setError('Masukkan password lama Anda')
      return
    }
    if (passwordBaru.length < 8) {
      setError('Password baru minimal 8 karakter')
      return
    }
    if (!passwordKuat) {
      setError('Password baru terlalu lemah. Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol.')
      return
    }
    if (passwordBaru !== konfirmasi) {
      setError('Konfirmasi password tidak sama')
      return
    }

    setSaving(true)

    // 1. Verifikasi password lama dengan cara login ulang
    const { error: verifError } = await supabase.auth.signInWithPassword({
      email,
      password: passwordLama,
    })

    if (verifError) {
      setError('Password lama salah')
      setSaving(false)
      return
    }

    // 2. Update password baru
    const { error: updateError } = await supabase.auth.updateUser({
      password: passwordBaru,
    })

    if (updateError) {
      setError('Gagal ubah password: ' + updateError.message)
      setSaving(false)
      return
    }

    // 3. Berhasil
    setMessage('✅ Password berhasil diubah!')
    setPasswordLama('')
    setPasswordBaru('')
    setKonfirmasi('')

    setTimeout(() => {
      setMessage('')
      router.push('/absen')
    }, 2000)

    setSaving(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Memuat...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-fuchsia-200/40 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/absen" className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl blur-md opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🔒</span>
              </div>
            </div>
            <div>
              <p className="text-slate-800 font-bold text-lg leading-tight">Ubah Password</p>
              <p className="text-slate-500 text-xs">Keamanan Akun</p>
            </div>
          </Link>

          <Link href="/absen" className="text-slate-700 hover:text-violet-700 text-sm bg-white hover:bg-violet-50 border border-slate-200 hover:border-violet-200 px-4 py-2 rounded-lg transition font-medium">
            ← Kembali
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="mb-5">
            <h1 className="text-lg font-bold text-slate-800">Ubah Password</h1>
            <p className="text-sm text-slate-500 mt-1">
              Hai <strong>{nama}</strong>, ubah password akun Anda di sini.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password Lama */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password Lama
              </label>
              <div className="relative">
                <input
                  type={showLama ? 'text' : 'password'}
                  value={passwordLama}
                  onChange={(e) => setPasswordLama(e.target.value)}
                  placeholder="Masukkan password lama"
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowLama(!showLama)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1"
                  tabIndex={-1}
                >
                  <EyeIcon open={showLama} />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 mb-3">PASSWORD BARU</p>
            </div>

            {/* Password Baru */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password Baru
              </label>
              <div className="relative">
                <input
                  type={showBaru ? 'text' : 'password'}
                  value={passwordBaru}
                  onChange={(e) => setPasswordBaru(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowBaru(!showBaru)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1"
                  tabIndex={-1}
                >
                  <EyeIcon open={showBaru} />
                </button>
              </div>
              <PasswordStrength password={passwordBaru} showRequirements={true} />
            </div>

            {/* Konfirmasi Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Konfirmasi Password Baru
              </label>
              <div className="relative">
                <input
                  type={showKonfirmasi ? 'text' : 'password'}
                  value={konfirmasi}
                  onChange={(e) => setKonfirmasi(e.target.value)}
                  placeholder="Ulangi password baru"
                  className={`w-full px-3 py-2 pr-10 border rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                    passwordTidakMatch
                      ? 'border-rose-400 focus:ring-rose-500 bg-rose-50'
                      : passwordMatch
                      ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/40'
                      : 'border-slate-300 focus:ring-violet-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowKonfirmasi(!showKonfirmasi)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1"
                  tabIndex={-1}
                >
                  <EyeIcon open={showKonfirmasi} />
                </button>
              </div>

              {/* Pesan konfirmasi */}
              {passwordTidakMatch && (
                <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1 font-medium">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" x2="9" y1="9" y2="15"/>
                    <line x1="9" x2="15" y1="9" y2="15"/>
                  </svg>
                  Password tidak sama
                </p>
              )}
              {passwordMatch && (
                <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1 font-medium">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Password cocok
                </p>
              )}
            </div>

            {/* Pesan Error / Sukses */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 rounded-xl">
                ⚠️ {error}
              </div>
            )}
            {message && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-xl font-medium">
                {message}
              </div>
            )}

            {/* Tombol */}
            <div className="flex gap-3 pt-2">
              <Link
                href="/absen"
                className="px-5 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium text-sm transition"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={saving || !passwordMatch || !passwordKuat}
                className="flex-1 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-violet-500/30 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Menyimpan...' : '🔒 Ubah Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" x2="22" y1="2" y2="22"/>
    </svg>
  )
}