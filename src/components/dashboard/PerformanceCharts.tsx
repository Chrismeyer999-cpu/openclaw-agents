'use client'

type TrendPoint = { date: string; clicks: number; sessions: number }

type PagePoint = { title: string; clicks: number; sessions: number }

export function TrendLineChart({ points, title }: { points: TrendPoint[]; title: string }) {
  if (!points.length) return <p className="text-sm text-gray-500">Nog geen trenddata.</p>

  const w = 620
  const h = 180
  const pad = 24
  const valsClicks = points.map((p) => p.clicks)
  const valsSessions = points.map((p) => p.sessions)
  const max = Math.max(1, ...valsClicks, ...valsSessions)

  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, points.length - 1)
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad)

  const line = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ')

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" className="text-gray-300" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" className="text-gray-300" />
        <polyline fill="none" stroke="#f97316" strokeWidth="2.5" points={line(valsClicks)} />
        <polyline fill="none" stroke="#0ea5e9" strokeWidth="2.5" points={line(valsSessions)} />
      </svg>
      <div className="mt-2 flex gap-4 text-xs">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />Clicks</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />Sessions</span>
      </div>
    </div>
  )
}

export function TopPagesBarChart({ pages, title }: { pages: PagePoint[]; title: string }) {
  const rows = pages.slice(0, 8)
  if (!rows.length) return <p className="text-sm text-gray-500">Nog geen pagina-data.</p>
  const max = Math.max(1, ...rows.map((r) => r.clicks + r.sessions))

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <div className="space-y-2">
        {rows.map((r) => {
          const total = r.clicks + r.sessions
          const pct = Math.max(4, Math.round((total / max) * 100))
          return (
            <div key={r.title}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <p className="line-clamp-1 text-gray-700 dark:text-gray-200">{r.title}</p>
                <span className="text-gray-500">{total}</span>
              </div>
              <div className="h-2 rounded bg-gray-200 dark:bg-gray-800">
                <div className="h-2 rounded bg-gradient-to-r from-orange-500 to-sky-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
