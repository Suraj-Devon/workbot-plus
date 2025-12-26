'use client'

import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const stats = [
  { label: 'Hours saved / month', value: '120+' },
  { label: 'Manual tasks automated', value: '30+' },
  { label: 'Bots ready to hire', value: '2 → ∞' },
]

const bots = [
  {
    icon: '📊',
    name: 'Data Analyst Bot',
    tagline: 'Your junior analyst that never sleeps.',
    description: 'Upload CSV or JSON and get instant summaries, trends, and key metrics without touching Excel.',
    href: '/dashboard/bots/data-analyst',
  },
  {
    icon: '📄',
    name: 'Resume Screener Bot',
    tagline: 'Your 24/7 recruiter.',
    description:
      'Drop in resumes and a job description. The bot scores and ranks candidates in minutes, not days.',
    href: '/dashboard/bots/resume-screener',
  },
  {
    icon: '🧩',
    name: 'Future Bots',
    tagline: 'Plug-and-play AI co‑workers.',
    description: 'Compliance, onboarding, reporting… new bots can be added without changing your stack.',
    href: '/signup',
  },
]

export default function HomePage() {
  const { user } = useAuth()
  const router = useRouter()

 

  return (
    <div className="bg-slate-950 text-slate-50">
      {/* Hero */}
      <section className="border-b border-slate-800 bg-gradient-to-br from-teal-600 via-teal-500 to-sky-600">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col gap-12 px-4 py-16 lg:flex-row lg:items-center">
          {/* Left: pitch */}
          <div className="flex-1">
            <p className="mb-3 inline-flex rounded-full bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-50">
              WorkBot+ • AI co‑workers on subscription
            </p>
            <h1 className="mb-4 text-4xl font-bold sm:text-5xl lg:text-6xl">
              Hire bots like employees.
              <br />
              Pay them like SaaS.
            </h1>
            <p className="mb-6 max-w-xl text-sm sm:text-base text-teal-50">
              WorkBot+ gives you a roster of AI “employees” you subscribe to for a flat monthly cost.
              They do the boring work — analysing data, screening resumes, preparing reports — so your
              real team can build, sell, and grow.
            </p>

            <div className="mb-8 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="btn-primary bg-white text-teal-700 hover:bg-teal-50"
              >
                Start free with 5 bot runs
              </Link>
              <Link href="/login" className="btn-outline border-white/40">
                Already have a team? Login
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 text-xs sm:text-sm text-teal-100">
              <div>
                <div className="font-semibold">Replace repetitive roles</div>
                <p>Let bots handle junior‑level, repeatable tasks with clear outputs.</p>
              </div>
              <div>
                <div className="font-semibold">Predictable monthly cost</div>
                <p>Subscribe to bots like salaries, without hiring risk.</p>
              </div>
            </div>
          </div>

          {/* Right: stats card */}
          <div className="flex-1">
            <div className="card bg-slate-950/70 text-slate-50 border-slate-800 shadow-xl">
              <div className="border-b border-slate-800 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
                  Your AI team at a glance
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Plug WorkBot+ into your HR and ops stack and watch busywork disappear.
                </p>
              </div>

              <div className="grid gap-4 border-b border-slate-800 px-6 py-4 sm:grid-cols-3">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-lg bg-slate-900 px-3 py-3">
                    <div className="text-lg font-semibold text-teal-300">{s.value}</div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-6 py-4 text-xs text-slate-400">
                No credit card for the free tier. Upgrade when the bots are saving you more than they
                cost.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bots grid */}
      <section className="mx-auto max-w-6xl px-4 py-12" id="features">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Meet your first AI co‑workers</h2>
            <p className="text-sm text-slate-400">
              Each bot owns a clear job description today — and your future bots will plug into the
              same dashboard.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Backend already supports adding more bots through routes /services — your UI is ready to
            grow with them.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {bots.map((bot) => (
            <Link
              key={bot.name}
              href={bot.href}
              className="card group flex flex-col justify-between bg-slate-900/80 text-slate-50 border-slate-800 hover:border-teal-500 hover:shadow-lg transition"
            >
              <div className="p-5">
                <div className="mb-3 text-3xl">{bot.icon}</div>
                <h3 className="mb-1 text-base font-semibold">{bot.name}</h3>
                <p className="mb-2 text-xs font-medium text-teal-300">{bot.tagline}</p>
                <p className="text-sm text-slate-300">{bot.description}</p>
              </div>
              <div className="border-t border-slate-800 px-5 py-3 text-xs text-teal-300 group-hover:text-teal-200">
                Open bot &rarr;
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-t border-slate-800 bg-slate-950" id="pricing">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Pricing that feels like payroll, not software</h2>
              <p className="text-sm text-slate-400">
                Start free, then upgrade when a bot is saving you more than its monthly “salary”.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="card bg-slate-900/80 text-slate-50 border-slate-800">
              <div className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Starter
                </div>
                <div className="mt-2 text-2xl font-bold">$0</div>
                <p className="mt-1 text-xs text-slate-400">5 bot runs / month</p>
                <ul className="mt-4 space-y-1 text-sm text-slate-300">
                  <li>• Access to Data Analyst & Resume Screener</li>
                  <li>• Perfect for testing with a small team</li>
                </ul>
              </div>
            </div>

            <div className="card bg-teal-600 text-white border-teal-400">
              <div className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-teal-100">
                  Pro Team
                </div>
                <div className="mt-2 text-2xl font-bold">$29</div>
                <p className="mt-1 text-xs text-teal-50">per month, per workspace</p>
                <ul className="mt-4 space-y-1 text-sm text-teal-50">
                  <li>• 200 bot runs / month</li>
                  <li>• Priority job processing</li>
                  <li>• Early access to new bots</li>
                </ul>
              </div>
            </div>

            <div className="card bg-slate-900/80 text-slate-50 border-slate-800">
              <div className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Scale / Enterprise
                </div>
                <div className="mt-2 text-2xl font-bold">Let’s talk</div>
                <p className="mt-1 text-xs text-slate-400">Custom limits and SLAs</p>
                <ul className="mt-4 space-y-1 text-sm text-slate-300">
                  <li>• Dedicated environment</li>
                  <li>• Role-based access control</li>
                  <li>• Support for custom internal bots</li>
                </ul>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            You can always add more bots on the backend (new services and routes). The pricing model
            here already supports expanding your AI “workforce”.
          </p>
        </div>
      </section>
    </div>
  )
}
