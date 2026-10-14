'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import PasswordStrength, { checkPasswordStrength } from '@/components/PasswordStrength'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Cek apakah user sudah terautentikasi via link reset password
  useEffect(() => {
    async function checkSession() {
      // Supabase otomatis handle token dari URL
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setReady(true)
      } else {
        // Coba dengarkan event PASSWORD_RECOVERY
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY') {
            setReady(true)
          }
        })
        // Timeout — kalau 3 detik tidak ada session, tampilkan error
        setTimeout(() => {
          setReady((r) => {
            if (!r) {
              setError('Link reset password tidak valid atau sudah kadaluarsa. Silakan minta link baru.')
            }
            return r
          })
        }, 3000)
        return () => subscription.unsubscribe()
      }
    }
    checkSession()
  }, [])

  const passwordMatch = password.length > 0 && password === confirmPassword
  const passwordTidakMatch = confirmPassword.length > 0 && password !== confirmPassword
  const { level } = checkPasswordStrength(password)
  const passwordKuat = level === 'kuat' || level === 'sedang'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 8) {
      setError('Password minimal 8 karakter')
      return
    }
    if (!passwordKuat) {
      setError('Password terlalu lemah. Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol.')
      return
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak sama')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Gagal reset password: ' + error.message)
      setLoading(false)
      return
    }

    setMessage('✅ Password berhasil diubah! Mengarahkan ke login...')
    setTimeout(async () => {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    }, 2000)
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-fuchsia-200/40 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-white shadow-lg rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl items-center justify-center mb-3 shadow-lg shadow-violet-500/30">
            <span className="text-white text-2xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Reset Password</h1>
          <p className="text-slate-500 text-sm">
            Masukkan password baru Anda.
          </p>
        </div>

        {!ready && !error && (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Memverifikasi link...</p>
          </div>
        )}

        {error && !ready && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 rounded-lg mb-4">
            ⚠️ {error}
          </div>
        )}

        {ready && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password Baru
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Minimal 8 karakter"
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              <PasswordStrength password={password} showRequirements={true} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Konfirmasi Password Baru
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
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
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1"
                  tabIndex={-1}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>

              {passwordTidakMatch && (
                <p className="text-xs text-rose-600 mt-1.5 font-medium">✗ Password tidak sama</p>
              )}
              {passwordMatch && (
                <p className="text-xs text-emerald-600 mt-1.5 font-medium">✓ Password cocok</p>
              )}
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 rounded-lg">
                ⚠️ {error}
              </div>
            )}
            {message && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-lg font-medium">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !passwordMatch || !passwordKuat}
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg shadow-lg shadow-violet-500/30 transition"
            >
              {loading ? 'Menyimpan...' : '🔒 Reset Password'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-slate-500 mt-6">
          Ingat password Anda?{' '}
          <Link href="/login" className="text-violet-600 font-medium hover:underline">
            Login di sini
          </Link>
        </p>
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