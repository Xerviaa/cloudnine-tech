'use client'

import { useState, useEffect } from 'react'

type Profile = {
  id: string
  nama_lengkap: string
  email: string
  role: 'karyawan' | 'admin'
}

type Props = {
  user: Profile | null
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, data: { nama_lengkap: string; role: 'karyawan' | 'admin' }) => Promise<void>
}

export default function EditUserModal({ user, isOpen, onClose, onSave }: Props) {
  const [nama, setNama] = useState('')
  const [role, setRole] = useState<'karyawan' | 'admin'>('karyawan')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setNama(user.nama_lengkap)
      setRole(user.role)
      setError('')
    }
  }, [user])

  if (!isOpen || !user) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')

    try {
      await onSave(user.id, { nama_lengkap: nama, role })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header Gradient */}
        <div className="bg-gradient-to-r from-indigo-500 to-violet-600 p-5">
          <h2 className="text-white text-lg font-semibold">Edit Karyawan</h2>
          <p className="text-white/80 text-sm">{user.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'karyawan' | 'admin')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="karyawan">Karyawan</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 disabled:opacity-50 rounded-lg transition"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}