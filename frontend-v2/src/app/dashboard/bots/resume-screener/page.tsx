'use client'

import { FormEvent, useState } from 'react'
import api from './../../../../lib/api'
import toast from 'react-hot-toast'

type RankedCandidate = {
  file_name: string
  score: number
  matched_skills: string[]
  missing_skills: string[]
  reasoning: string
  rank: number
}

type ScreenerResult = {
  success: boolean
  execution_id: string
  total_resumes: number
  strong_candidates: number
  ranking: RankedCandidate[]
  insights: string[]
  summary: string
  error?: string
}


export default function ResumeScreenerPage() {
  const [files, setFiles] = useState<FileList | null>(null)
  const [jobDesc, setJobDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScreenerResult | null>(null)

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  if (!files || files.length === 0) {
    toast.error('Please upload at least one resume')
    return
  }
  if (!jobDesc.trim()) {
    toast.error('Please paste the job description')
    return
  }

  const formData = new FormData()
  Array.from(files).forEach((f) => formData.append('files', f))
  formData.append('jobDescription', jobDesc)

  try {
    setLoading(true)
    setResult(null)

    const res = await api.post('/api/bots/resume-screener', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    // Outer wrapper: { success, message, executionId, data }
    const outer = res.data
    console.log('Resume screener outer:', outer)

    // If HTTP call itself failed
    if (!outer || outer.success === false) {
      toast.error(outer?.message || outer?.error || 'Screening failed')
      setResult(null)
      return
    }

    const inner = outer.data
    console.log('Resume screener inner:', inner)

    // Inner object is the Python result: may be success false
    if (!inner || inner.success === false) {
      toast.error(inner?.summary || inner?.error || 'No valid resume files uploaded')
      setResult(null)
      return
    }

    // Normal success path: inner is ScreenerResult
    const screener: ScreenerResult = inner
    setResult(screener)
    toast.success('Screening completed')
  } catch (err: any) {
    console.error(err)
    toast.error(err.response?.data?.message || 'Failed to screen resumes')
  } finally {
    setLoading(false)
  }
}



  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="card flex flex-col gap-4 border border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2 py-1">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-indigo-700">
              Resume Screener Bot
            </span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Rank resumes against a job in minutes
          </h1>
          <p className="text-sm text-slate-600">
            Upload a batch of resumes and a job description, and this bot scores each candidate on skills, experience, and education fit.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="rounded-full bg-white px-2 py-0.5">PDF &amp; TXT</span>
            <span className="rounded-full bg-white px-2 py-0.5">Bulk screening</span>
            <span className="rounded-full bg-white px-2 py-0.5">Score 0–100</span>
          </div>
        </div>
        <div className="rounded-xl bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Ideal for
          </p>
          <ul className="mt-1 list-disc pl-4 space-y-1">
            <li>Founders hiring their first team.</li>
            <li>HR leads screening large applicant pools.</li>
          </ul>
        </div>
      </div>

      {/* What it does */}
      <div className="card p-4 text-xs text-slate-600">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-semibold text-slate-800">What this bot does</span>
          <span className="rounded-full bg-teal-600/10 px-2 py-0.5 text-[10px] font-medium text-teal-700">
            Saves hours of manual screening
          </span>
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Extracts skills, experience, and education from each resume.</li>
          <li>Matches them against the job description requirements.</li>
          <li>Scores candidates and highlights top matches.</li>
          <li>Generates a short summary you can share with hiring managers.</li>
        </ul>
      </div>

      {/* Upload form */}
      <div className="card p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Resumes (PDF or TXT)
              </label>
              <input
                type="file"
                accept=".pdf,.txt"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                className="w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
              />
              <p className="mt-1 text-xs text-slate-400">
                Upload up to 100 resumes at once.
              </p>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Job description
              </label>
              <textarea
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-800 shadow-sm"
                placeholder="Paste the role description here…"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-60"
          >
            {loading ? 'Screening…' : 'Run screening'}
          </button>
        </form>
      </div>

{result && (
  <div className="space-y-4">
    <div className="card p-5">
      <h2 className="mb-2 text-sm font-semibold text-slate-800">
        Recommended candidates
      </h2>
      {(!result.ranking || result.ranking.length === 0) ? (
        <p className="text-xs text-slate-600">No strong matches found.</p>
      ) : (
        <div className="space-y-2">
          {result.ranking.slice(0, 5).map((c) => (
            <div
              key={c.file_name}
              className="flex items-start justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <div className="text-xs text-slate-700">
                <div className="font-semibold text-slate-900">
                  {c.file_name} (Rank #{c.rank})
                </div>
                <div>Score: {c.score}%</div>
                <div>
                  Matched skills:{' '}
                  {c.matched_skills && c.matched_skills.length > 0
                    ? c.matched_skills.join(', ')
                    : 'None listed'}
                </div>
                <div>
                  Missing skills:{' '}
                  {c.missing_skills && c.missing_skills.length > 0
                    ? c.missing_skills.join(', ')
                    : 'None'}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {c.reasoning}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="card p-4 text-xs text-slate-700">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">Summary</h2>
      <p>{result.summary}</p>
      {result.insights && result.insights.length > 0 && (
        <ul className="mt-2 list-disc pl-4 space-y-1">
          {result.insights.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  </div>
)}

    </div>
  )
}
