import { Inter } from 'next/font/google'
import { ClubProvider } from '@/contexts/ClubContext'
import "./globals.css" // Make sure your CSS import is still there too!

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" />
      </head>
      <body className={`${inter.className} bg-zinc-950 text-e5e5e5 overflow-x-hidden antialiased`}>
        <ClubProvider>
          {children}
        </ClubProvider>
      </body>
    </html>
  );
}