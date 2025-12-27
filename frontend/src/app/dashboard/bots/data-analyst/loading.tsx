'use client';

import Skeleton from '../../../../components/Skeleton';

export default function DataAnalystLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-0 lg:py-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-3 w-64" />
      </div>

      {/* Hero card */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-4 w-52 mb-3" />
        <Skeleton className="h-3 w-72 mb-1" />
        <Skeleton className="h-3 w-64 mb-1" />
        <Skeleton className="h-3 w-48 mb-4" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Upload + result layout */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
        {/* Upload form skeleton */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-9 w-full mb-3" />
          <Skeleton className="h-3 w-44 mb-1" />
          <Skeleton className="h-3 w-40 mb-4" />
          <Skeleton className="h-9 w-32" />
        </div>

        {/* Result skeleton */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-52" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    </div>
  );
}
