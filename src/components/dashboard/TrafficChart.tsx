'use client'

import { useState } from 'react'

type TrafficPoint = { date: string; clicks: number; impressions: number; sessions: number }

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export function TrafficChart({ points }: { points: TrafficPoint[] }) {
    const [activeMetrics, setActiveMetrics] = useState<Array<'clicks' | 'impressions' | 'sessions'>>(['clicks'])
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

    if (!points.length) {
        return (
            <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                <p className="text-sm text-gray-400">Nog geen data. Koppel Google Search Console en run een sync.</p>
            </div>
        )
    }

    const metrics = {
        clicks: { label: 'Clicks', color: '#f97316' },
        impressions: { label: 'Impressions', color: '#6366f1' },
        sessions: { label: 'Sessions', color: '#10b981' }
    }

    const toggleMetric = (key: 'clicks' | 'impressions' | 'sessions') => {
        if (activeMetrics.includes(key)) {
            if (activeMetrics.length > 1) setActiveMetrics(activeMetrics.filter((m) => m !== key))
        } else {
            setActiveMetrics([...activeMetrics, key])
        }
    }

    const w = 800
    const h = 200
    const padLeft = 40
    const padRight = 16
    const padTop = 16
    const padBot = 32

    const xs = points.map((_, i) => padLeft + (i / Math.max(1, points.length - 1)) * (w - padLeft - padRight))

    // Compute metric paths
    const lines = activeMetrics.map((key) => {
        const values = points.map((p) => p[key])
        const max = Math.max(1, ...values)
        const minVal = Math.min(0, ...values) // keep base 0
        const ys = values.map((v) => padTop + ((max - v) / Math.max(1, max - minVal)) * (h - padTop - padBot))
        const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')

        return {
            key,
            max,
            color: metrics[key].color,
            pathD
        }
    })

    // Y-axis labels from first active metric (usually clicks or impressions)
    const primaryMetric = lines[0]
    const yLabels = primaryMetric ? [primaryMetric.max, Math.round(primaryMetric.max / 2), 0] : []

    // X-axis: show ~6 labels
    const xStep = Math.max(1, Math.floor(points.length / 6))
    const xLabels = points.filter((_, i) => i % xStep === 0 || i === points.length - 1)

    return (
        <div className="space-y-4">
            {/* Metric toggles */}
            <div className="flex gap-2">
                {(Object.keys(metrics) as Array<keyof typeof metrics>).map((key) => (
                    <button
                        key={key}
                        onClick={() => toggleMetric(key)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${activeMetrics.includes(key)
                            ? 'bg-white text-gray-900 border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white'
                            : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800/50 dark:text-gray-400'
                            }`}
                    >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: metrics[key].color, opacity: activeMetrics.includes(key) ? 1 : 0.4 }} />
                        {metrics[key].label}
                    </button>
                ))}
            </div>

            {/* Chart SVG */}
            <div className="relative" onMouseLeave={() => setHoveredIdx(null)}>
                <svg
                    viewBox={`0 0 ${w} ${h}`}
                    className="h-56 w-full"
                    style={{ cursor: 'crosshair' }}
                    preserveAspectRatio="none"
                >
                    {/* Grid lines */}
                    {yLabels.map((val, i) => {
                        const yy = padTop + (i / 2) * (h - padTop - padBot)
                        return (
                            <g key={i}>
                                <line x1={padLeft} y1={yy} x2={w - padRight} y2={yy} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
                                <text x={padLeft - 4} y={yy + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{val.toLocaleString('nl-NL')}</text>
                            </g>
                        )
                    })}

                    {/* X-axis labels */}
                    {xLabels.map((pt) => {
                        const i = points.indexOf(pt)
                        return (
                            <text key={pt.date} x={xs[i]} y={h - 4} textAnchor="middle" fontSize="10" fill="#9ca3af">{formatDate(pt.date)}</text>
                        )
                    })}

                    {/* Lines */}
                    {lines.map((l) => (
                        <path key={l.key} d={l.pathD} fill="none" stroke={l.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    ))}

                    {/* Hover overlay rectangles */}
                    {xs.map((x, i) => (
                        <rect
                            key={i}
                            x={i === 0 ? 0 : (xs[i - 1] + x) / 2}
                            y={0}
                            width={i === 0 ? (xs[0] + xs[1]) / 2 : i === xs.length - 1 ? x - (xs[i - 1] + x) / 2 : xs[i + 1] ? ((xs[i + 1] + x) / 2 - (xs[i - 1] + x) / 2) : 20}
                            height={h}
                            fill="transparent"
                            onMouseEnter={() => setHoveredIdx(i)}
                        />
                    ))}

                    {/* Hover dot + vertical line */}
                    {hoveredIdx !== null && (
                        <>
                            <line x1={xs[hoveredIdx]} y1={padTop} x2={xs[hoveredIdx]} y2={h - padBot} stroke="#9ca3af" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="4,2" />
                            {lines.map((l) => {
                                const val = points[hoveredIdx][l.key]
                                const yy = padTop + ((l.max - val) / Math.max(1, l.max)) * (h - padTop - padBot)
                                return <circle key={l.key} cx={xs[hoveredIdx]} cy={yy} r="4" fill={l.color} stroke="white" strokeWidth="1.5" />
                            })}
                        </>
                    )}
                </svg>

                {/* Tooltip */}
                {hoveredIdx !== null && (
                    <div
                        className="pointer-events-none absolute top-0 z-10 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-xl dark:border-gray-700 dark:bg-gray-900"
                        style={{ left: `${Math.min(80, (hoveredIdx / points.length) * 100 + 4)}%`, transform: 'translateX(-50%)' }}
                    >
                        <p className="text-xs text-gray-500 mb-1">{formatDate(points[hoveredIdx].date)}</p>
                        <div className="flex flex-col gap-1">
                            {activeMetrics.map(key => (
                                <div key={key} className="flex items-center gap-2 justify-between min-w-[100px]">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: metrics[key].color }} />
                                        <span className="text-[11px] font-medium text-gray-500">{metrics[key].label}</span>
                                    </div>
                                    <span className="text-xs font-bold" style={{ color: metrics[key].color }}>
                                        {points[hoveredIdx][key].toLocaleString('nl-NL')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
