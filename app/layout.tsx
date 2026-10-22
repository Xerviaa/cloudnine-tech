import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import 'leaflet/dist/leaflet.css';
import InstallPWA from "@/components/InstallPWA";

// 1. IMPORT PROVIDERS DARI NEXT-THEMES
import { Providers } from "./providers"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'AbsenKita - Sistem Absensi Kantor',
  description: 'Aplikasi absensi karyawan dengan GPS tracking',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AbsenKita',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      // 2. TAMBAHKAN suppressHydrationWarning DI SINI
      suppressHydrationWarning 
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 3. BUNGKUS CHILDREN DENGAN PROVIDERS */}
        <Providers attribute="class" defaultTheme="system" enableSystem>
          {children}
          <InstallPWA />
        </Providers>
      </body>
    </html>
  );
}