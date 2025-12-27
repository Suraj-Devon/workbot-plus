'use client'

import { FormEvent, useState, ChangeEvent } from 'react'
import { useAuth } from '../../../../context/AuthContext'
import api from './../../../../lib/api'
import toast from 'react-hot-toast'

const MAX_FILE_MB = 5
const MAX_FILES = 100
const ALLOWED_TYPES = ['application/pdf', 'text/plain']

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
  const { user } = useAuth()
  const [files, setFiles] = useState<FileList | null>(null)
  const [jobDesc, setJobDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScreenerResult | null>(null)

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list || list.length === 0) {
      setFiles(null)
      return
    }

    if (list.length > MAX_FILES) {
      toast.error(`Too many files. Max ${MAX_FILES} resumes`)
      e.target.value = ''
      setFiles(null)
      return
    }

    // validate each file
    for (const f of Array.from(list)) {
      const sizeMb = f.size / 1024 / 1024
      if (sizeMb > MAX_FILE_MB) {
        toast.error(`"${f.name}" is too large. Max ${MAX_FILE_MB} MB per file`)
        e.target.value = ''
        setFiles(null)
        return
      }
      if (!ALLOWED_TYPES.includes(f.type)) {
        const name = f.name.toLowerCase()
        if (!name.endsWith('.pdf') && !name.endsWith('.txt')) {
          toast.error(`"${f.name}" must be PDF or TXT`)
          e.target.value = ''
          setFiles(null)
          return
        }
      }
    }

    setFiles(list)
  }

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

      const outer = res.data
      console.log('Resume screener outer:', outer)

      if (!outer || !outer.success) {
        toast.error(outer?.message || outer?.error || 'Screening failed')
        return
      }

      const inner = outer.data
      console.log('Resume screener inner:', inner)

      if (!inner || !inner.success) {
        toast.error(inner?.summary || inner?.error || 'No valid resume files')
        return
      }

      const screener: ScreenerResult = inner
      setResult(screener)
      toast.success(`Screened ${screener.total_resumes} resumes! 🎉`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to screen resumes')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-indigo-100/80 backdrop-blur-sm text-indigo-800 px-6 py-3 rounded-2xl mb-6 border border-indigo-200/50">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Resume Screener Bot
            </h1>
          </div>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Upload resumes + job description → instant ranking by skills fit. Top 3 candidates ready in minutes.
          </p>
        </div>

        {/* Form */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Resumes Upload */}
          <div className="card bg-white/80 backdrop-blur-sm shadow-xl border border-slate-100/50 rounded-3xl p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              📄 Upload Resumes
            </h3>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-2xl p-8 text-center transition-all hover:border-indigo-400 hover:bg-indigo-50/50">
                <input
                  type="file"
                  accept=".pdf,.txt"
                  multiple
                  onChange={handleFilesChange}
                  className="hidden"
                  id="resume-upload"
                />
                <label htmlFor="resume-upload" className="cursor-pointer block">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg">
                    📎
                  </div>
                  {files?.length ? (
                    <div>
                      <p className="font-semibold text-slate-900">{files.length} resumes selected</p>
                      <p className="text-sm text-indigo-700">
                        PDF/TXT • Max {MAX_FILES} files • {MAX_FILE_MB}MB each
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-semibold text-slate-900 mb-1">Drop resumes or click</p>
                      <p className="text-sm text-slate-500">
                        PDF or TXT • Max {MAX_FILES} files • {MAX_FILE_MB}MB each
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Job Description */}
          <div className="card bg-white/80 backdrop-blur-sm shadow-xl border border-slate-100/50 rounded-3xl p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              💼 Job Description
            </h3>
            <textarea
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              rows={8}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-vertical"
              placeholder="Paste the full job description here..."
            />
          </div>
        </div>

        {/* Run Button */}
        <div className="card bg-gradient-to-r from-indigo-50 to-purple-50/50 border border-indigo-200/50 p-8 rounded-3xl">
          <button
            onClick={handleSubmit as any}
            disabled={loading || !files?.length || !jobDesc.trim()}
            className="mx-auto block w-full max-w-md bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 px-8 rounded-2xl font-semibold text-lg shadow-xl hover:from-indigo-600 hover:to-purple-700 transform hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Screening {files?.length || 0} resumes...
              </>
            ) : (
              '🚀 Run Screening'
            )}
          </button>
        </div>

        {/* Results (unchanged) */}
        {result && (
          /* ... keep your existing results JSX exactly as before ... */
          <></>
        )}
      </div>
    </div>
  )
}
