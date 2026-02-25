'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { DeliveryStatusItem } from '@/lib/dashboard/getDeliveryStatus'

const SITES: Array<DeliveryStatusItem['site']> = ['platform', 'zwijsen.net', 'brikxai.nl', 'kavelarchitect.nl']

function StatusBadge({ status }: { status: DeliveryStatusItem['status'] }) {
  if (status === 'working') return <Badge variant="secondary">working</Badge>
  if (status === 'partial') return <Badge variant="outline">partial</Badge>
  if (status === 'planned') return <Badge variant="outline">planned</Badge>
  return <Badge variant="destructive">blocked</Badge>
}

export function DeliveryStatusBoard({ items }: { items: DeliveryStatusItem[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [drafts, setDrafts] = useState<Record<string, { status: DeliveryStatusItem['status']; works_now: string; not_working_yet: string; next_step: string }>>(
    () =>
      Object.fromEntries(
        items.map((item) => [
          item.id,
          {
            status: item.status,
            works_now: item.works_now ?? '',
            not_working_yet: item.not_working_yet ?? '',
            next_step: item.next_step ?? ''
          }
        ])
      )
  )

  const saveItem = (id: string) => {
    const draft = drafts[id]
    if (!draft) return

    startTransition(async () => {
      setError(null)
      const res = await fetch('/api/delivery-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...draft })
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        setError(payload.error ?? 'Opslaan mislukt')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {SITES.map((site) => {
        const rows = items.filter((i) => i.site === site)
        return (
          <div key={site} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{site}</p>

            <div className="space-y-3">
              {rows.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Nog geen items.</p>
              ) : (
                rows.map((row) => {
                  const draft = drafts[row.id]
                  if (!draft) return null

                  return (
                    <div key={row.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.domain_area}</p>
                        <StatusBadge status={draft.status} />
                      </div>

                      <label className="mb-2 block text-xs font-medium text-gray-600 dark:text-gray-300">
                        Status
                        <select
                          value={draft.status}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], status: e.target.value as DeliveryStatusItem['status'] } }))}
                          className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        >
                          <option value="working">working</option>
                          <option value="partial">partial</option>
                          <option value="planned">planned</option>
                          <option value="blocked">blocked</option>
                        </select>
                      </label>

                      <label className="mb-2 block text-xs font-medium text-gray-600 dark:text-gray-300">
                        Werkt nu
                        <textarea
                          value={draft.works_now}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], works_now: e.target.value } }))}
                          className="mt-1 min-h-[64px] w-full rounded-md border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </label>

                      <label className="mb-2 block text-xs font-medium text-gray-600 dark:text-gray-300">
                        Nog niet
                        <textarea
                          value={draft.not_working_yet}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], not_working_yet: e.target.value } }))}
                          className="mt-1 min-h-[64px] w-full rounded-md border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </label>

                      <label className="mb-2 block text-xs font-medium text-gray-600 dark:text-gray-300">
                        Volgende stap
                        <textarea
                          value={draft.next_step}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], next_step: e.target.value } }))}
                          className="mt-1 min-h-[64px] w-full rounded-md border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </label>

                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Laatste update: {new Date(row.updated_at).toLocaleString('nl-NL')}</p>
                        <Button size="sm" onClick={() => saveItem(row.id)} disabled={isPending}>
                          Opslaan
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
