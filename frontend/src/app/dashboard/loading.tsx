'use client';

import Skeleton from '../../components/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      {/* Hero skeleton */}
      <div className="mb-6">
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stats skeleton row */}
      <div className="grid gap-4 mb-8 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-3 w-28 mb-3" />
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>

      {/* Bot cards skeleton */}
      <div className="grid gap-4 mb-8 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between"
          >
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-40 mb-1" />
              <Skeleton className="h-3 w-32 mb-4" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>

      {/* Recent jobs table skeleton */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="grid grid-cols-4 gap-4 items-center">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
