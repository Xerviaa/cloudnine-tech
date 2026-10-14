// Konfigurasi Jam Kantor
// Zona waktu: WITA (UTC+8) — Asia/Makassar

export const JAM_KANTOR = {
  // Jam Kantor (jam kerja normal)
  JAM_MASUK_BATAS: '08:00', // Lewat dari ini = terlambat

  // Jam Pelayanan (jam operasional kantor)
  JAM_KELUAR_MULAI: '16:30', // Sebelum ini = pulang cepat (perlu konfirmasi)
  JAM_KELUAR_BATAS: '20:00', // Lewat ini = tidak bisa absen keluar hari ini
}

// Label tampilan untuk UI
export const LABEL_JAM = {
  JAM_KANTOR: '08.00 – 16.30',
  JAM_PELAYANAN: '08.00 – 20.00',
}

// Helper: ambil jam:menit WITA dari Date
export function getWitaTime(date: Date = new Date()): { hours: number; minutes: number; string: string } {
  const witaString = date.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const [hours, minutes] = witaString.split('.').map(Number)
  return { hours, minutes, string: witaString }
}

// Helper: parse "HH:MM" jadi total menit
export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

// Helper: cek apakah user terlambat masuk
export function cekTerlambatMasuk(waktuAbsen: Date): { terlambat: boolean; menit: number } {
  const wita = getWitaTime(waktuAbsen)
  const absenMenit = wita.hours * 60 + wita.minutes
  const batasMenit = parseTimeToMinutes(JAM_KANTOR.JAM_MASUK_BATAS)

  if (absenMenit > batasMenit) {
    return { terlambat: true, menit: absenMenit - batasMenit }
  }
  return { terlambat: false, menit: 0 }
}

// Helper: cek status absen keluar
export type StatusKeluar = 'pulang_cepat' | 'normal' | 'lewat_batas'

export function cekStatusKeluar(waktuAbsen: Date): { status: StatusKeluar; menitCepat?: number } {
  const wita = getWitaTime(waktuAbsen)
  const absenMenit = wita.hours * 60 + wita.minutes
  const mulaiMenit = parseTimeToMinutes(JAM_KANTOR.JAM_KELUAR_MULAI)
  const batasMenit = parseTimeToMinutes(JAM_KANTOR.JAM_KELUAR_BATAS)

  if (absenMenit > batasMenit) {
    return { status: 'lewat_batas' }
  }
  if (absenMenit < mulaiMenit) {
    return { status: 'pulang_cepat', menitCepat: mulaiMenit - absenMenit }
  }
  return { status: 'normal' }
}

// Helper: format menit jadi teks
export function formatMenit(menit: number): string {
  if (menit < 60) return `${menit} menit`
  const jam = Math.floor(menit / 60)
  const sisa = menit % 60
  if (sisa === 0) return `${jam} jam`
  return `${jam} jam ${sisa} menit`
}