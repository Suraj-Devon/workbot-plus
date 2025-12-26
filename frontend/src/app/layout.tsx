import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'WorkBot+ – AI-Powered HR Automation',
  description: 'AI bots for recruitment and HR automation.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <AuthProvider>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  )
}
