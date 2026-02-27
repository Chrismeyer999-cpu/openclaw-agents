'use client'

type Feature = {
  geometry?: { type?: string; coordinates?: any }
  properties?: { is_hoofdgebouw?: boolean; pand_id?: string }
}

export function DsoMapPreview({ geojson }: { geojson: { features?: Feature[] } | null | undefined }) {
  const feats = geojson?.features ?? []
  const polys: Array<{ pts: Array<[number, number]>; hoofd: boolean; id: string }> = []

  for (const f of feats) {
    if (f.geometry?.type === 'Polygon') {
      const ring = (f.geometry.coordinates?.[0] ?? []) as Array<[number, number]>
      polys.push({ pts: ring, hoofd: Boolean(f.properties?.is_hoofdgebouw), id: String(f.properties?.pand_id ?? '') })
    }
  }

  if (!polys.length) return <p className="text-xs text-gray-500">Geen kaartgeometrie beschikbaar.</p>

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  polys.forEach((p) =>
    p.pts.forEach(([x, y]) => {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    })
  )

  const w = 420
  const h = 280
  const pad = 10
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)

  const mapPoint = ([x, y]: [number, number]) => {
    const nx = pad + ((x - minX) / spanX) * (w - 2 * pad)
    const ny = h - (pad + ((y - minY) / spanY) * (h - 2 * pad))
    return `${nx},${ny}`
  }

  return (
    <div className="rounded-md border border-gray-200 p-2 dark:border-gray-800">
      <p className="mb-2 text-xs text-gray-500">Kaartindicatie (BAG-panden): rood = hoofdgebouw</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-64 w-full rounded bg-gray-50 dark:bg-gray-950">
        {polys.map((p) => (
          <polygon
            key={p.id}
            points={p.pts.map(mapPoint).join(' ')}
            fill={p.hoofd ? 'rgba(239,68,68,0.45)' : 'rgba(14,165,233,0.30)'}
            stroke={p.hoofd ? '#dc2626' : '#0284c7'}
            strokeWidth={1}
          />
        ))}
      </svg>
    </div>
  )
}
