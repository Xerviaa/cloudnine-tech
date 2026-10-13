'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function VerifyOtpForm() {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    } else {
      setError('Email tidak ditemukan. Silakan daftar ulang.')
    }
  }, [searchParams])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup',
    })

    if (verifyError) {
      setError('Verifikasi gagal: ' + verifyError.message)
      setLoading(false)
      return
    }

    alert('Verifikasi berhasil! Silakan login.')
    router.push('/login')
  }

  async function handleResend() {
    setError('')
    setLoading(true)

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (resendError) {
      setError('Gagal kirim ulang: ' + resendError.message)
    } else {
      alert('Kode verifikasi baru sudah dikirim ke email Anda.')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">
          Verifikasi Email
        </h1>
        <p className="text-slate-500 mb-6 text-center text-sm">
          Kode 6 digit sudah dikirim ke <strong>{email}</strong>
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Kode Verifikasi
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              maxLength={6}
              className="w-full px-3 py-3 border border-slate-300 rounded-lg text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000000"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {loading ? 'Memverifikasi...' : 'Verifikasi'}
          </button>
        </form>

        <button
          onClick={handleResend}
          disabled={loading}
          className="w-full text-blue-600 text-sm mt-4 hover:underline"
        >
          Kirim ulang kode
        </button>
      </div>
    </main>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <VerifyOtpForm />
    </Suspense>
  )
}