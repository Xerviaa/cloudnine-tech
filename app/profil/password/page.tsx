'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PasswordStrength, { checkPasswordStrength } from '@/components/PasswordStrength'

export default function UbahPasswordPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [nama, setNama] = useState('')
  const [role, setRole] = useState<'karyawan' | 'admin'>('karyawan')

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
        .from('profiles').select('nama_lengkap, role').eq('id', user.id).single()
      
      if (data) {
        setNama(data.nama_lengkap)
        setRole(data.role)
      }

      setLoading(false)
    }
    loadUser()
  }, [])

  const passwordMatch = passwordBaru.length > 0 && passwordBaru === konfirmasi
  const passwordTidakMatch = konfirmasi.length > 0 && passwordBaru !== konfirmasi

  const { level } = checkPasswordStrength(passwordBaru)
  const passwordKuat = level === 'kuat' || level === 'sedang'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

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

    const { error: verifError } = await supabase.auth.signInWithPassword({
      email,
      password: passwordLama,
    })

    if (verifError) {
      setError('Password lama salah')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: passwordBaru,
    })

    if (updateError) {
      setError('Gagal ubah password: ' + updateError.message)
      setSaving(false)
      return
    }

    setMessage('✅ Password berhasil diubah!')
    setPasswordLama('')
    setPasswordBaru('')
    setKonfirmasi('')

    setTimeout(() => {
      setMessage('')
      // Redirect berdasarkan role
      if (role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/profil')
      }
    }, 2000)

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-violet-200 dark:border-slate-700 border-t-violet-600 dark:border-t-violet-500 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Ubah Password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Hai <strong>{nama}</strong>, ubah password akun Anda di sini.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password Lama
            </label>
            <div className="relative">
              <input
                type={showLama ? 'text' : 'password'}
                value={passwordLama}
                onChange={(e) => setPasswordLama(e.target.value)}
                placeholder="Masukkan password lama"
                className="w-full px-3 py-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={() => setShowLama(!showLama)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-1"
                tabIndex={-1}
              >
                <EyeIcon open={showLama} />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">PASSWORD BARU</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password Baru
            </label>
            <div className="relative">
              <input
                type={showBaru ? 'text' : 'password'}
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full px-3 py-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={() => setShowBaru(!showBaru)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-1"
                tabIndex={-1}
              >
                <EyeIcon open={showBaru} />
              </button>
            </div>
            <PasswordStrength password={passwordBaru} showRequirements={true} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Konfirmasi Password Baru
            </label>
            <div className="relative">
              <input
                type={showKonfirmasi ? 'text' : 'password'}
                value={konfirmasi}
                onChange={(e) => setKonfirmasi(e.target.value)}
                placeholder="Ulangi password baru"
                className={`w-full px-3 py-2 pr-10 border rounded-lg text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition ${
                  passwordTidakMatch
                    ? 'border-rose-400 focus:ring-rose-500 bg-rose-50 dark:bg-rose-900/20'
                    : passwordMatch
                    ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/20'
                    : 'border-slate-300 dark:border-slate-600 focus:ring-violet-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowKonfirmasi(!showKonfirmasi)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-1"
                tabIndex={-1}
              >
                <EyeIcon open={showKonfirmasi} />
              </button>
            </div>

            {passwordTidakMatch && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 flex items-center gap-1 font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" x2="9" y1="9" y2="15"/>
                  <line x1="9" x2="15" y1="9" y2="15"/>
                </svg>
                Password tidak sama
              </p>
            )}
            {passwordMatch && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Password cocok
              </p>
            )}
          </div>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm p-3 rounded-xl">
              ⚠️ {error}
            </div>
          )}
          {message && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm p-3 rounded-xl font-medium">
              {message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (role === 'admin') {
                  router.push('/admin')
                } else {
                  router.back()
                }
              }}
              className="px-5 py-2.5 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-medium text-sm transition"
            >
              Batal
            </button>
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