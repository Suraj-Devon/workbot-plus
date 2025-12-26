'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function NavItem({ href, label, collapsed }: { href: string; label: string; collapsed: boolean }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  const base = 'flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors'
  const activeCls = 'bg-teal-50 text-teal-700 border-r-2 border-teal-500'
  const inactiveCls = 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'

  return (
    <Link href={href} className={`${base} ${active ? activeCls : inactiveCls}`}>
      {collapsed ? label[0].toUpperCase() : label}
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-slate-50">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden flex-shrink-0 flex-col border-r border-slate-200 bg-white py-4 transition-all duration-200 lg:flex ${
          sidebarOpen ? 'w-60 px-3' : 'w-14 px-1'
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          {!sidebarOpen ? (
            <span className="text-sm font-bold text-slate-900">🤖</span>
          ) : (
            <span className="text-sm font-bold text-slate-900">BotHub</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '⟨' : '⟩'}
          </button>
        </div>

        <nav className="space-y-1 flex-1">
          <NavItem href="/dashboard" label="Dashboard" collapsed={!sidebarOpen} />
          
          {sidebarOpen && (
            <div className="mt-6 mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Bots
            </div>
          )}
          <NavItem
            href="/dashboard/bots/data-analyst"
            label="Data Analyst Bot"
            collapsed={!sidebarOpen}
          />
          <NavItem
            href="/dashboard/bots/resume-screener"
            label="Resume Screener Bot"
            collapsed={!sidebarOpen}
          />

          {sidebarOpen && (
            <div className="mt-6 mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Account
            </div>
          )}
          <NavItem href="/dashboard/history" label="Job History" collapsed={!sidebarOpen} />
          <NavItem href="/dashboard/settings" label="Settings" collapsed={!sidebarOpen} />
        </nav>

        {sidebarOpen && (
          <div className="mt-8 pt-4 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 mb-1">Version 1.0</div>
          </div>
        )}
      </aside>

      {/* Mobile menu button */}
      <div className="fixed left-4 top-[4.75rem] z-30 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-lg hover:shadow-xl transition-shadow"
        >
          {sidebarOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <aside className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden">
          <div className="fixed left-0 top-[4rem] w-64 h-[calc(100vh-4rem)] border-r border-slate-200 bg-white shadow-2xl">
            <div className="p-4">
              <div className="flex items-center justify-between mb-6">
                <span className="text-lg font-bold text-slate-900">BotHub</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>
              
              <nav className="space-y-1 text-xs">
                <NavItem href="/dashboard" label="Dashboard" collapsed={false} />
                <div className="mt-6 mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Bots
                </div>
                <NavItem href="/dashboard/bots/data-analyst" label="Data Analyst Bot" collapsed={false} />
                <NavItem href="/dashboard/bots/resume-screener" label="Resume Screener Bot" collapsed={false} />
                <div className="mt-6 mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Account
                </div>
                <NavItem href="/dashboard/history" label="Job History" collapsed={false} />
                <NavItem href="/dashboard/settings" label="Settings" collapsed={false} />
              </nav>
            </div>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto px-4 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
