import { cekTerlambatMasuk, cekStatusKeluar } from '@/lib/config/jam-kantor'

type AttendanceLog = {
  id: number
  tipe: 'masuk' | 'keluar'
  waktu_absen: string
  is_terlambat: boolean
}

// Hitung keterangan untuk absen masuk
export function getKeteranganMasuk(log: AttendanceLog | null): {
  label: string
  warna: 'normal' | 'terlambat'
  detail: string
} | null {
  if (!log) return null
  
  const waktu = new Date(log.waktu_absen)
  const { terlambat, menit } = cekTerlambatMasuk(waktu)
  
  if (terlambat) {
    return {
      label: 'Terlambat',
      warna: 'terlambat',
      detail: `Terlambat ${menit} menit`,
    }
  }
  return {
    label: 'Normal',
    warna: 'normal',
    detail: 'Tepat waktu',
  }
}

// Hitung keterangan untuk absen keluar
export function getKeteranganKeluar(log: AttendanceLog | null): {
  label: string
  warna: 'normal' | 'pulang_cepat' | 'menyusul'
  detail: string
} | null {
  if (!log) return null
  
  // Kalau absen menyusul (dilakukan di hari berbeda)
  if (log.is_terlambat) {
    return {
      label: 'Absen Menyusul',
      warna: 'menyusul',
      detail: 'Absen keluar dilakukan di hari berbeda',
    }
  }
  
  const waktu = new Date(log.waktu_absen)
  const { status, menitCepat } = cekStatusKeluar(waktu)
  
  if (status === 'pulang_cepat') {
    return {
      label: 'Pulang Cepat',
      warna: 'pulang_cepat',
      detail: `Pulang ${menitCepat} menit lebih awal`,
    }
  }
  if (status === 'lewat_batas') {
    return {
      label: 'Lewat Batas',
      warna: 'pulang_cepat',
      detail: 'Absen keluar melewati jam operasional',
    }
  }
  return {
    label: 'Normal',
    warna: 'normal',
    detail: 'Sesuai jam kerja',
  }
}