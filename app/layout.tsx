import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ClubProvider } from '@/contexts/ClubContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import "./globals.css"

const inter = Inter({ subsets: ['latin'] })

// --- PWA & SEO METADATA ---
export const metadata: Metadata = {
  title: "Fees Please",
  description: "Match fee collection for legends.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fees Please",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

// --- VIEWPORT SETTINGS (Makes it feel native) ---
export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Prevents annoying zoom on mobile tap
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" />
      </head>
      <body className={`${inter.className} bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-[#e5e5e5] overflow-x-hidden antialiased transition-colors duration-300`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClubProvider>
            {children}
          </ClubProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}