'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState, useTransition } from 'react'

interface NewsQuickCreateFormProps {
  domainOptions: string[]
  initialDomain?: string
}

interface SourceTypeOption {
  value: string
  label: string
}

type CreateNewsResponse = {
  id?: string
  error?: string
  generation_mode?: 'ai' | 'template'
}

const ZWIJSEN_SOURCE_TYPE_OPTIONS: SourceTypeOption[] = [
  { value: 'publicatie', label: 'Publicatie' },
  { value: 'project', label: 'Project' },
  { value: 'kantoor', label: 'Kantoor' },
  { value: 'event', label: 'Event' }
]

const DEFAULT_SOURCE_TYPE_OPTIONS: SourceTypeOption[] = [
  { value: 'markt', label: 'Markt' },
  { value: 'regelgeving', label: 'Regelgeving' },
  { value: 'project', label: 'Project' },
  { value: 'bedrijf', label: 'Bedrijf' }
]

export function NewsQuickCreateForm({ domainOptions, initialDomain }: NewsQuickCreateFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const defaultDomain = useMemo(() => {
    if (initialDomain && domainOptions.includes(initialDomain)) return initialDomain
    return domainOptions[0] ?? ''
  }, [domainOptions, initialDomain])

  const [site, setSite] = useState(defaultDomain)
  const sourceTypeOptions = useMemo(() => getSourceTypeOptions(site), [site])
  const [sourceType, setSourceType] = useState(sourceTypeOptions[0]?.value ?? 'manual')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sourceTypeOptions.some((option) => option.value === sourceType)) {
      setSourceType(sourceTypeOptions[0]?.value ?? 'manual')
    }
  }, [sourceTypeOptions, sourceType])

  const canSubmit = site.trim().length > 0 && sourceType.trim().length > 0 && title.trim().length > 0 && brief.trim().length >= 10 && !isPending

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return

    setMessage(null)
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/nieuws', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            site,
            title,
            brief,
            source_type: sourceType
          })
        })

        const payload = (await response.json().catch(() => ({}))) as CreateNewsResponse
        if (!response.ok || !payload.id) {
          throw new Error(payload.error ?? 'Kon artikel niet aanmaken.')
        }

        setTitle('')
        setBrief('')
        if (payload.generation_mode === 'template') {
          setMessage('Artikel aangemaakt met template-fallback (geen OpenAI key of AI-call mislukt).')
        } else {
          setMessage('Artikel aangemaakt. Je wordt doorgestuurd naar de editor.')
        }
        router.refresh()
        router.push(`/dashboard/nieuws/${payload.id}?src=seo`)
      } catch (requestError) {
        const nextMessage = requestError instanceof Error ? requestError.message : 'Onbekende fout'
        setError(nextMessage)
      }
    })
  }

  if (domainOptions.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">Geen workspaces gevonden. Voeg eerst een workspace toe voordat je nieuws kunt aanmaken.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Nieuw artikel toevoegen</h2>
        <p className="text-sm text-gray-500">Vul een korte briefing in. Het dashboard maakt direct een conceptartikel voor je aan.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-medium text-gray-600">
          Site
          <select value={site} onChange={(event) => setSite(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm">
            {domainOptions.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-gray-600">
          Titel
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bijv. Nieuwe regels voor vergunningen in 2026" className="mt-1" />
        </label>

        <label className="text-xs font-medium text-gray-600">
          Categorie
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm">
            {sourceTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs font-medium text-gray-600">
        Korte briefing (minimaal 10 tekens)
        <textarea
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Schrijf 2-5 zinnen met de kern van het nieuws."
          className="mt-1 min-h-[110px] w-full rounded-md border border-gray-300 p-2 text-sm leading-6 text-gray-800"
        />
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!canSubmit}>
          {isPending ? 'Artikel maken...' : 'Maak artikel'}
        </Button>
        <p className="text-xs text-gray-500">Na aanmaken ga je direct naar de artikelpagina om te finetunen of te publiceren.</p>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  )
}

function getSourceTypeOptions(site: string): SourceTypeOption[] {
  const normalizedSite = normalizeSiteDomain(site)
  if (normalizedSite === 'zwijsen.net') return ZWIJSEN_SOURCE_TYPE_OPTIONS
  return DEFAULT_SOURCE_TYPE_OPTIONS
}

function normalizeSiteDomain(siteInput: string) {
  return siteInput
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}
