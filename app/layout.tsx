import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import { ClubProvider } from '@/contexts/ClubContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import { PostHogProvider } from '@/components/PostHogProvider' // <-- Import it here
import "@/app/globals.css"

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })

export const metadata: Metadata = {
  title: "Fees Please",
  description: "Less chasing. More playing.",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  userScalable: true, // Allow zooming for accessibility
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
          {/* Wrap ClubProvider with PostHogProvider */}
          <PostHogProvider>
            <ClubProvider>
              {children}
            </ClubProvider>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}