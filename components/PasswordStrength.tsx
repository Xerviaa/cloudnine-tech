'use client'

type Props = {
  password: string
  showRequirements?: boolean
}

export type StrengthLevel = 'lemah' | 'sedang' | 'kuat' | ''

// Fungsi mengecek kekuatan password
export function checkPasswordStrength(password: string): {
  level: StrengthLevel
  score: number
  checks: {
    length: boolean
    lowercase: boolean
    uppercase: boolean
    number: boolean
    symbol: boolean
  }
} {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password),
  }

  const passed = Object.values(checks).filter(Boolean).length

  let level: StrengthLevel = ''
  let score = 0

  if (password.length === 0) {
    return { level: '', score: 0, checks }
  }

  // Skor berdasarkan jumlah aturan yang terpenuhi
  if (!checks.length) {
    // Terlalu pendek — pasti lemah
    level = 'lemah'
    score = 1
  } else if (passed <= 2) {
    level = 'lemah'
    score = 1
  } else if (passed <= 3) {
    level = 'sedang'
    score = 2
  } else if (passed === 4) {
    level = 'sedang'
    score = 3
  } else {
    level = 'kuat'
    score = 4
  }

  return { level, score, checks }
}

export default function PasswordStrength({ password, showRequirements = false }: Props) {
  const { level, score, checks } = checkPasswordStrength(password)

  if (!password) return null

  const colors = {
    lemah: { bar: 'bg-rose-500', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
    sedang: { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    kuat: { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    '': { bar: 'bg-slate-200', text: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
  }

  const color = colors[level]
  const label = level === 'lemah' ? 'Lemah' : level === 'sedang' ? 'Sedang' : level === 'kuat' ? 'Kuat' : ''

  return (
    <div className="mt-2 space-y-2">
      {/* Bar indikator */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i <= score ? color.bar : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Label kekuatan */}
      <div className="flex items-center justify-between">
        <p className={`text-xs font-medium ${color.text}`}>
          Kekuatan password: <span className="font-bold">{label}</span>
        </p>
      </div>

      {/* Checklist persyaratan (opsional) */}
      {showRequirements && (
        <div className={`${color.bg} ${color.border} border rounded-lg p-3 space-y-1`}>
          <p className="text-[11px] font-semibold text-slate-600 mb-1">Password harus memiliki:</p>
          <RequirementItem ok={checks.length} text="Minimal 8 karakter" />
          <RequirementItem ok={checks.lowercase} text="Huruf kecil (a-z)" />
          <RequirementItem ok={checks.uppercase} text="Huruf besar (A-Z)" />
          <RequirementItem ok={checks.number} text="Angka (0-9)" />
          <RequirementItem ok={checks.symbol} text="Simbol (!@#$%...)" />
        </div>
      )}
    </div>
  )
}

function RequirementItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {ok ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 flex-shrink-0">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 flex-shrink-0">
          <circle cx="12" cy="12" r="10"/>
        </svg>
      )}
      <span className={ok ? 'text-slate-600' : 'text-slate-400'}>{text}</span>
    </div>
  )
}