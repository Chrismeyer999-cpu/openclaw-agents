'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState, useTransition } from 'react'
import { DsoMapPreview } from '@/components/dashboard/DsoMapPreview'

type LookupResult = {
  ok?: boolean
  error?: string
  input?: string
  location?: {
    displayName?: string
    straat?: string
    huisnummer?: number
    postcode?: string
    plaats?: string
    lon?: number
    lat?: number
  }
  plannen?: Array<{
    id?: string
    naam?: string
    type?: string
    regelStatus?: string
    regelBinding?: string
    status?: string
    datum?: string
    error?: string
  }>
  buildingContext?: {
    hoofdgebouw?: {
      verblijfsobject_id?: string
      pand_id?: string
      oppervlakte_verblijfsobject_m2?: number
      bouwjaar?: number
      pand_oppervlakte_min_m2?: number
      pand_oppervlakte_max_m2?: number
    } | null
    pandenInOmgeving?: Array<{ pand_id?: string; oppervlakte_min_m2?: number; oppervlakte_max_m2?: number; bouwjaar?: number | null }>
    mapGeoJson?: { features?: Array<any> }
    note?: string
  }
  vergunningsvrijIndicatie?: {
    disclaimer?: string
    vermoedelijkMogelijk?: string[]
    extraToetsen?: string[]
    hoofdgebouwIndicatie?: string
  }
}

export function DsoLookupForm() {
  const [address, setAddress] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = () => {
    if (!address.trim()) return
    startTransition(async () => {
      const res = await fetch('/api/dso/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })
      const data = (await res.json().catch(() => ({}))) as LookupResult
      setResult(data)
    })
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div>
        <p className="text-base font-semibold">DSO Lookup</p>
        <p className="text-sm text-gray-500">Voer een adres in en laat de DSO-agent plannen en context ophalen.</p>
      </div>

      <div className="flex flex-col gap-2 md:flex-row">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Bijv. Otto'slaan 10, Hilversum" />
        <Button onClick={run} disabled={isPending || !address.trim()}>{isPending ? 'Zoeken...' : 'Zoek in DSO'}</Button>
      </div>

      {result?.error ? <p className="text-sm text-red-600">{result.error}</p> : null}

      {result?.ok ? (
        <div className="space-y-3">
          <div className="rounded-md border border-gray-200 p-3 text-sm dark:border-gray-800">
            <p className="font-medium">{result.location?.displayName}</p>
            <p className="text-gray-500">{result.location?.straat} {result.location?.huisnummer}, {result.location?.postcode} {result.location?.plaats}</p>
            <p className="text-xs text-gray-500">Lon/Lat: {result.location?.lon}, {result.location?.lat}</p>
          </div>

          <div className="space-y-2">
            {(result.plannen ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">Geen plannen gevonden.</p>
            ) : (
              (result.plannen ?? []).map((p, idx) => (
                <div key={`${p.id ?? 'err'}-${idx}`} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
                  {p.error ? (
                    <p className="text-sm text-red-600">{p.error}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium">{p.naam}</p>
                      <p className="text-xs text-gray-500">{p.id}</p>
                      <p className="text-xs text-gray-500">{p.type} • {p.regelStatus} • {p.status ?? 'onbekend'}</p>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {result.buildingContext?.hoofdgebouw ? (
            <div className="rounded-md border border-gray-200 p-3 text-sm dark:border-gray-800">
              <p className="font-medium">Bestaande hoofdbebouwing (BAG)</p>
              <p>Verblijfsobject: {result.buildingContext.hoofdgebouw.oppervlakte_verblijfsobject_m2 ?? '-'} m²</p>
              <p>Pand opp. min/max: {result.buildingContext.hoofdgebouw.pand_oppervlakte_min_m2 ?? '-'} / {result.buildingContext.hoofdgebouw.pand_oppervlakte_max_m2 ?? '-'} m²</p>
              <p>Bouwjaar: {result.buildingContext.hoofdgebouw.bouwjaar ?? '-'}</p>
            </div>
          ) : null}

          {result.vergunningsvrijIndicatie ? (
            <div className="rounded-md border border-gray-200 p-3 text-sm dark:border-gray-800">
              <p className="font-medium">Vergunningsvrij (indicatie)</p>
              <p className="text-xs text-gray-500">{result.vergunningsvrijIndicatie.disclaimer}</p>
              <ul className="mt-2 list-disc pl-5">
                {(result.vergunningsvrijIndicatie.vermoedelijkMogelijk ?? []).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <DsoMapPreview geojson={result.buildingContext?.mapGeoJson} />
        </div>
      ) : null}
    </div>
  )
}
