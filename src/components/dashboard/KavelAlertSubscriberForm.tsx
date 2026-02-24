'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export function KavelAlertSubscriberForm() {
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [naam, setNaam] = useState('')
  const [telefoonnummer, setTelefoonnummer] = useState('')
  const [provincies, setProvincies] = useState('')
  const [minPrijs, setMinPrijs] = useState('')
  const [maxPrijs, setMaxPrijs] = useState('')
  const [minOppervlakte, setMinOppervlakte] = useState('')
  const [opmerkingen, setOpmerkingen] = useState('')
  const [earlyAccessRapport, setEarlyAccessRapport] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const submit = () => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/kavel-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            naam: naam || null,
            telefoonnummer: telefoonnummer || null,
            provincies: provincies
              .split(',')
              .map((value) => value.trim())
              .filter((value) => value.length > 0),
            min_prijs: minPrijs || null,
            max_prijs: maxPrijs || null,
            min_oppervlakte: minOppervlakte || null,
            opmerkingen: opmerkingen || null,
            early_access_rapport: earlyAccessRapport
          })
        })
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        if (!response.ok) throw new Error(payload.error ?? 'Inschrijving kon niet worden opgeslagen')

        setMessage('KavelAlert-inschrijving opgeslagen.')
        setEmail('')
        setNaam('')
        setTelefoonnummer('')
        setProvincies('')
        setMinPrijs('')
        setMaxPrijs('')
        setMinOppervlakte('')
        setOpmerkingen('')
        setEarlyAccessRapport(false)
        router.refresh()
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Onbekende fout')
      }
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">KavelAlert inschrijving toevoegen</p>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-xs font-medium text-gray-600 md:col-span-2">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="naam@domein.nl"
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Naam
          <input value={naam} onChange={(event) => setNaam(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Telefoon
          <input
            value={telefoonnummer}
            onChange={(event) => setTelefoonnummer(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-gray-600 md:col-span-2">
          Provincies (comma separated)
          <input
            value={provincies}
            onChange={(event) => setProvincies(event.target.value)}
            placeholder="utrecht, noord-holland"
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Min prijs
          <input
            value={minPrijs}
            onChange={(event) => setMinPrijs(event.target.value)}
            inputMode="decimal"
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Max prijs
          <input
            value={maxPrijs}
            onChange={(event) => setMaxPrijs(event.target.value)}
            inputMode="decimal"
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Min m2
          <input
            value={minOppervlakte}
            onChange={(event) => setMinOppervlakte(event.target.value)}
            inputMode="decimal"
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-gray-600 md:col-span-3">
          Opmerkingen
          <input
            value={opmerkingen}
            onChange={(event) => setOpmerkingen(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={earlyAccessRapport} onChange={(event) => setEarlyAccessRapport(event.target.checked)} />
        Early access kavelrapport
      </label>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={isPending || !email.trim()}>
          Opslaan
        </Button>
        {isPending ? <p className="text-xs text-gray-500">Opslaan...</p> : null}
      </div>
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

