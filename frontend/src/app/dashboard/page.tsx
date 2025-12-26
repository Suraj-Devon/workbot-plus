'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'

type HistoryItem = {
  id: string
  bot_type: string
  file_name: string
  status: string
  created_at: string
  completed_at: string | null
}

const quickBots = [
  {
    icon: '📊',
    name: 'Data Analyst Bot',
    description: 'Upload CSV/JSON and get instant summaries, trends, and key metrics.',
    href: '/dashboard/bots/data-analyst',
  },
  {
    icon: '📄',
    name: 'Resume Screener Bot',
    description: 'Rank candidates against your job descriptions in minutes, not days.',
    href: '/dashboard/bots/resume-screener',
  },
  {
    icon: '🧩',
    name: 'Future Bot Slot',
    description: 'New AI roles you add later plug into this same dashboard.',
    href: '/dashboard',
  },
]

export default function DashboardHome() {
  const { user } = useAuth()
  const [recent, setRecent] = useState<HistoryItem[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  useEffect(() => {
    const loadRecent = async () => {
      try {
        const res = await api.get('/api/bots/history')
        const all: HistoryItem[] = res.data.history || []
        setRecent(all.slice(0, 5))
      } catch (err) {
        console.error('Failed to load recent jobs:', err)
      } finally {
        setLoadingRecent(false)
      }
    }
    loadRecent()
  }, [])

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-teal-50 via-white to-sky-50 p-8 shadow-sm">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-3">
            Welcome back{user?.fullName ? `, ${user.fullName}` : ''} 👋
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Your AI co-workers are ready. Use the sidebar to hire bots or review your job history.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Bot runs this month
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">12</div>
          <div className="text-xs text-slate-500">Free tier: 5 • Pro: 200</div>
        </div>
        <div className="card p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Time saved
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">18 hrs</div>
          <div className="text-xs text-slate-500">vs manual workflows</div>
        </div>
        <div className="card p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Available bots
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">2</div>
          <div className="text-xs text-slate-500">+ more coming soon</div>
        </div>
      </div>

      {/* Quick Bots */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
          Hire a bot
          <span className="text-xs text-slate-400">(powered by your backend)</span>
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {quickBots.map((bot) => (
            <Link
              key={bot.name}
              href={bot.href}
              className="card group h-48 flex flex-col justify-between border-slate-200 p-6 hover:border-teal-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
            >
              <div>
                <div className="text-4xl mb-4">{bot.icon}</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-teal-700">
                  {bot.name}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{bot.description}</p>
              </div>
              <div className="text-sm font-medium text-teal-600 group-hover:text-teal-700">
                Launch bot →
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Recent jobs</h2>
          {recent.length > 0 && (
            <Link
              href="/dashboard/history"
              className="text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              View all →
            </Link>
          )}
        </div>

        {loadingRecent ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-slate-500">Loading recent activity...</div>
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4 opacity-25">🚀</div>
            <p className="text-lg text-slate-500 mb-2">No jobs yet</p>
            <p className="text-sm text-slate-400">
              Run your first bot from above and results will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Bot
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    File
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-sm font-medium text-slate-900">
                      {job.bot_type === 'data_analyst'
                        ? 'Data Analyst'
                        : job.bot_type === 'resume_screener'
                        ? 'Resume Screener'
                        : job.bot_type}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700 max-w-xs truncate">
                      {job.file_name}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          job.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : job.status === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
