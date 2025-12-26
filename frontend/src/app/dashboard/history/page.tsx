'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '../../../lib/api'
import toast from 'react-hot-toast'

type HistoryItem = {
  id: string
  bot_type: string
  file_name: string
  status: string
  created_at: string
  completed_at: string | null
  error_message: string | null
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<HistoryItem[]>([])

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/api/bots/history')
        setItems(res.data.history || [])
      } catch (err: any) {
        console.error(err)
        toast.error(err.response?.data?.message || 'Failed to load history')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Job history</h1>
        <p className="text-sm text-slate-600">
          Review previous bot runs and reopen full results when you need them.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-600">Loading history…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-600">
          No jobs yet. Run a bot and results will appear here.
        </div>
      ) : (
        <div className="card p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="border px-2 py-1 text-left">Bot</th>
                  <th className="border px-2 py-1 text-left">File</th>
                  <th className="border px-2 py-1 text-left">Status</th>
                  <th className="border px-2 py-1 text-left">Created</th>
                  <th className="border px-2 py-1 text-left">Completed</th>
                  <th className="border px-2 py-1 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((job) => (
                  <tr key={job.id} className="odd:bg-white even:bg-slate-50">
                    <td className="border px-2 py-1 text-slate-800">
                      {job.bot_type === 'data_analyst'
                        ? 'Data Analyst Bot'
                        : job.bot_type === 'resume_screener'
                        ? 'Resume Screener Bot'
                        : job.bot_type}
                    </td>
                    <td className="border px-2 py-1 text-slate-700">
                      {job.file_name}
                    </td>
                    <td className="border px-2 py-1">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-[11px] ' +
                          (job.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : job.status === 'failed'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-50 text-slate-600')
                        }
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="border px-2 py-1 text-slate-600">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="border px-2 py-1 text-slate-600">
                      {job.completed_at
                        ? new Date(job.completed_at).toLocaleString()
                        : '—'}
                    </td>
                      <td className="border px-2 py-1 text-slate-500 text-xs">
                        {job.status === 'completed' ? 'Result available at run time' : '—'}
                      </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
