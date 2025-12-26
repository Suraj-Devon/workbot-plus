'use client'

import { FormEvent, useState } from 'react'
import { useAuth } from './../../context/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await login(email, password)
    setLoading(false)

    if (res.success) {
      toast.success('Welcome back!')
      router.push('/dashboard')
    } else {
      toast.error(res.error || 'Login failed')
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-950 px-4">
      <div className="mx-auto grid w-full max-w-4xl gap-8 rounded-2xl bg-slate-900/80 p-6 shadow-xl ring-1 ring-slate-800 md:grid-cols-2">
        {/* Left: pitch */}
        <div className="hidden flex-col justify-between rounded-xl bg-gradient-to-br from-teal-500 via-teal-600 to-sky-500 p-5 text-teal-50 md:flex">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide">
              Log in to your AI team
            </p>
            <h1 className="mb-3 text-2xl font-semibold">
              See what your bots have done while you were offline.
            </h1>
            <p className="text-sm text-teal-50/90">
              Access job history, rerun analyses, and spin up new bot jobs in a few clicks.
            </p>
          </div>
          <div className="mt-6 space-y-1 text-xs text-teal-50/90">
            <p>• Secure JWT‑based auth connected to your backend.</p>
            <p>• One login for all current and future bots.</p>
          </div>
        </div>

        {/* Right: form */}
        <div className="card bg-slate-900 text-slate-50 border-slate-800 p-6">
          <h2 className="mb-2 text-xl font-semibold">Login</h2>
          <p className="mb-6 text-sm text-slate-400">
            Enter your details to access the WorkBot+ dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Email</label>
              <input
                type="email"
                required
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 pr-10 text-sm text-slate-50 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-teal-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                    <span className="text-lg" aria-hidden="true">
                        {showPassword ? '🙈' : '👁️'}
                    </span>
                    </button>

              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-60"
            >
              {loading ? 'Logging in…' : 'Login'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-teal-400 hover:text-teal-300">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
