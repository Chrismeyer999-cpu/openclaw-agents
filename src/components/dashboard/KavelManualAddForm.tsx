'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export function KavelManualAddForm() {
  const [isPending, startTransition] = useTransition()
  const [sourceType, setSourceType] = useState<'manual' | 'openclaw' | 'gmail_funda'>('manual')
  const [sourceUrl, setSourceUrl] = useState('')
  const [adres, setAdres] = useState('')
  const [postcode, setPostcode] = useState('')
  const [plaats, setPlaats] = useState('')
  const [provincie, setProvincie] = useState('')
  const [prijs, setPrijs] = useState('')
  const [oppervlakte, setOppervlakte] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const submit = () => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/kavels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'manual_add',
            source_type: sourceType,
            source_url: sourceUrl || null,
            adres: adres || null,
            postcode: postcode || null,
            plaats: plaats || null,
            provincie: provincie || null,
            prijs: prijs || null,
            oppervlakte: oppervlakte || null
          })
        })
        const payload = (await response.json().catch(() => ({}))) as { error?: string; kavelId?: string }
        if (!response.ok) throw new Error(payload.error ?? 'Kavel kon niet worden toegevoegd')

        setMessage('Kavel toegevoegd aan pending lijst.')
        setSourceUrl('')
        setAdres('')
        setPostcode('')
        setPlaats('')
        setProvincie('')
        setPrijs('')
        setOppervlakte('')
        router.refresh()
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Onbekende fout')
      }
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">Kavel handmatig toevoegen</p>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-xs font-medium text-gray-600">
          Bron
          <select
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as 'manual' | 'openclaw' | 'gmail_funda')}
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          >
            <option value="manual">Handmatig</option>
            <option value="openclaw">OpenClaw</option>
            <option value="gmail_funda">Gmail/Funda</option>
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 md:col-span-2">
          Bron URL
          <input
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://www.funda.nl/..."
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-gray-600 md:col-span-2">
          Adres
          <input value={adres} onChange={(event) => setAdres(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Postcode
          <input value={postcode} onChange={(event) => setPostcode(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Plaats
          <input value={plaats} onChange={(event) => setPlaats(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Provincie
          <input value={provincie} onChange={(event) => setProvincie(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Vraagprijs (EUR)
          <input
            value={prijs}
            onChange={(event) => setPrijs(event.target.value)}
            inputMode="decimal"
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Oppervlakte (m2)
          <input
            value={oppervlakte}
            onChange={(event) => setOppervlakte(event.target.value)}
            inputMode="decimal"
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={isPending}>
          Voeg toe aan pending
        </Button>
        {isPending ? <p className="text-xs text-gray-500">Opslaan...</p> : null}
      </div>
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

