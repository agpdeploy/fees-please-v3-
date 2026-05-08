import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import { ClubProvider } from '@/contexts/ClubContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import "@/app/globals.css"

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })

// --- SEO METADATA ---
export const metadata: Metadata = {
  title: "Fees Please",
  description: "Less chasing. More playing.",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

// --- VIEWPORT SETTINGS ---
export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* 🔥 FIX: Restored the correct CSS path for Font Awesome! */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" />
      </head>
      <body 
        className={`${manrope.className} bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-[#e5e5e5] antialiased transition-colors duration-300`} 
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
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