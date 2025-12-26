'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import api from './../../../../lib/api'
import toast from 'react-hot-toast'
import DataAnalysisResult, { PythonAnalysis } from '../../../../components/DataAnalysisResult'

export default function HistoryDetailPage() {
  const params = useParams()
  const executionId = params?.executionId as string

  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState<PythonAnalysis | null>(null)
  const [raw, setRaw] = useState<any | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await api.get(`/api/bots/result/${executionId}`)
        const data = res.data
        setStatus(data.status || null)
        if (data.data) {
          setAnalysis(data.data as PythonAnalysis)
        }
        setRaw(data)
      } catch (err: any) {
        console.error(err)
        toast.error(err.response?.data?.message || 'Failed to load result')
      } finally {
        setLoading(false)
      }
    }

    if (executionId) fetchResult()
  }, [executionId])

  if (loading) {
    return <div className="text-sm text-slate-600">Loading result…</div>
  }

  if (!analysis) {
    return (
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-slate-900">Job result</h1>
        <p className="text-sm text-slate-600">
          No analysis data found for this execution. Status: {status || 'unknown'}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Job result</h1>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
          Execution: {executionId}
        </span>
      </div>
      <DataAnalysisResult analysis={analysis} raw={raw} />
    </div>
  )
}
