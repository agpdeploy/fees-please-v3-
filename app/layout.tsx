import { Inter } from 'next/font/google'
import { ClubProvider } from '@/contexts/ClubContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import "./globals.css"

const inter = Inter({ subsets: ['latin'] })

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