'use client';

import Skeleton from '../../../../components/Skeleton';

export default function ResumeScreenerLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-0 lg:py-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-5 w-52 mb-2" />
        <Skeleton className="h-3 w-72" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
        {/* Left: form */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <Skeleton className="h-4 w-40 mb-2" />
            <Skeleton className="h-9 w-full mb-2" />
            <Skeleton className="h-3 w-52" />
          </div>
          <div>
            <Skeleton className="h-4 w-44 mb-2" />
            <Skeleton className="h-24 w-full mb-2" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        {/* Right: results */}
        <div className="space-y-4">
          {/* Summary card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <Skeleton className="h-4 w-40 mb-3" />
            <Skeleton className="h-3 w-72 mb-1" />
            <Skeleton className="h-3 w-64 mb-1" />
            <Skeleton className="h-3 w-56" />
          </div>

          {/* Candidates list */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <Skeleton className="h-4 w-48 mb-2" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-slate-100 p-3">
                <Skeleton className="h-3 w-32 mb-1" />
                <Skeleton className="h-3 w-40 mb-1" />
                <Skeleton className="h-3 w-52" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
