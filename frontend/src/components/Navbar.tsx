'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const isDashboard = pathname.startsWith('/dashboard')

  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/')
    setMobileOpen(false)
  }

  const handleGoDashboard = () => {
    router.push('/dashboard')
    setMobileOpen(false)
  }

  return (
    <header className="border-b border-slate-200/50 bg-white/90 backdrop-blur-xl shadow-sm sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group" onClick={() => setMobileOpen(false)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg group-hover:shadow-xl transition-all duration-200">
            <span className="text-xl">🤖</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-lg font-bold text-slate-900 tracking-tight">BotHub</div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">AI Automation</div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2 lg:gap-4">
          {/* Public pages nav (home only) */}
          {!isDashboard && (
            <div className="flex items-center gap-6">
              <Link
                href="/#features"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
              >
                Features
              </Link>
              <Link
                href="/#pricing"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
              >
                Pricing
              </Link>
            </div>
          )}

          {/* Auth controls */}
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGoDashboard}
                className="text-sm font-medium text-slate-700 hover:text-slate-900 px-4 py-2 transition-colors hover:bg-slate-50 rounded-lg"
              >
                {isDashboard ? 'Dashboard' : 'Go to Dashboard'}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 px-4 py-2 transition-colors hover:bg-slate-50 rounded-lg"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-teal-600 hover:to-teal-700 active:from-teal-700 active:to-teal-800 transition-all duration-200"
              >
                Get Started
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown (covers both public + dashboard) */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-3 space-y-3">
            {!isDashboard && (
              <div className="flex flex-col gap-1">
                <Link
                  href="/#features"
                  className="text-sm font-medium text-slate-700 px-2 py-1 rounded hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="/#pricing"
                  className="text-sm font-medium text-slate-700 px-2 py-1 rounded hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  Pricing
                </Link>
              </div>
            )}

            {user ? (
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={handleGoDashboard}
                  className="w-full text-left text-sm font-medium text-slate-700 px-2 py-2 rounded-lg hover:bg-slate-50"
                >
                  {isDashboard ? 'Dashboard' : 'Go to Dashboard'}
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  <span>Logout</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-slate-700 px-2 py-2 rounded-lg hover:bg-slate-50"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-teal-600 hover:to-teal-700 transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
