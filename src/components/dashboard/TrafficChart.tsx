'use client'

import { useState } from 'react'

type TrafficPoint = { date: string; clicks: number; impressions: number; sessions: number }

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export function TrafficChart({ points }: { points: TrafficPoint[] }) {
    const [activeMetric, setActiveMetric] = useState<'clicks' | 'impressions' | 'sessions'>('clicks')
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

    if (!points.length) {
        return (
            <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                <p className="text-sm text-gray-400">Nog geen GSC-data. Koppel Google Search Console en run een sync.</p>
            </div>
        )
    }

    const metrics = {
        clicks: { label: 'Clicks', color: '#f97316', bg: '#f9731620' },
        impressions: { label: 'Impressions', color: '#6366f1', bg: '#6366f120' },
        sessions: { label: 'Sessions', color: '#10b981', bg: '#10b98120' }
    }

    const values = points.map((p) => p[activeMetric])
    const max = Math.max(1, ...values)
    const minVal = Math.min(...values)
    const w = 800
    const h = 180
    const padLeft = 40
    const padRight = 16
    const padTop = 16
    const padBot = 32

    const xs = points.map((_, i) => padLeft + (i / Math.max(1, points.length - 1)) * (w - padLeft - padRight))
    const ys = values.map((v) => padTop + ((max - v) / Math.max(1, max - minVal)) * (h - padTop - padBot))

    const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')
    const areaD = `${pathD} L ${xs[xs.length - 1]} ${h - padBot} L ${xs[0]} ${h - padBot} Z`

    const m = metrics[activeMetric]

    // Y-axis labels
    const yLabels = [max, Math.round(max / 2), 0]

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
                        onClick={() => setActiveMetric(key)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${activeMetric === key
                                ? 'text-white shadow-md'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                            }`}
                        style={activeMetric === key ? { backgroundColor: metrics[key].color } : {}}
                    >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: metrics[key].color }} />
                        {metrics[key].label}
                    </button>
                ))}
            </div>

            {/* Chart SVG */}
            <div className="relative" onMouseLeave={() => setHoveredIdx(null)}>
                <svg
                    viewBox={`0 0 ${w} ${h}`}
                    className="h-52 w-full"
                    style={{ cursor: 'crosshair' }}
                >
                    <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={m.color} stopOpacity="0.25" />
                            <stop offset="100%" stopColor={m.color} stopOpacity="0.02" />
                        </linearGradient>
                    </defs>

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

                    {/* Area fill */}
                    <path d={areaD} fill="url(#areaGrad)" />

                    {/* Line */}
                    <path d={pathD} fill="none" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Hover overlay */}
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
                            <line x1={xs[hoveredIdx]} y1={padTop} x2={xs[hoveredIdx]} y2={h - padBot} stroke={m.color} strokeWidth="1" strokeOpacity="0.4" strokeDasharray="4,2" />
                            <circle cx={xs[hoveredIdx]} cy={ys[hoveredIdx]} r="5" fill={m.color} stroke="white" strokeWidth="2" />
                        </>
                    )}
                </svg>

                {/* Tooltip */}
                {hoveredIdx !== null && (
                    <div
                        className="pointer-events-none absolute top-0 z-10 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-xl dark:border-gray-700 dark:bg-gray-900"
                        style={{ left: `${Math.min(80, (hoveredIdx / points.length) * 100 + 4)}%`, transform: 'translateX(-50%)' }}
                    >
                        <p className="text-xs text-gray-500">{formatDate(points[hoveredIdx].date)}</p>
                        <p className="mt-0.5 text-sm font-bold" style={{ color: m.color }}>{values[hoveredIdx].toLocaleString('nl-NL')} {m.label}</p>
                        <div className="mt-1 grid grid-cols-3 gap-3 border-t border-gray-100 pt-1 dark:border-gray-700">
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400">Clicks</p>
                                <p className="text-xs font-semibold text-orange-600">{points[hoveredIdx].clicks}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400">Impr.</p>
                                <p className="text-xs font-semibold text-indigo-600">{points[hoveredIdx].impressions}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400">Sessions</p>
                                <p className="text-xs font-semibold text-emerald-600">{points[hoveredIdx].sessions}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
