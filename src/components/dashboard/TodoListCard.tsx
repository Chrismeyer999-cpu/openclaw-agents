'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface TodoItem {
  id: string
  title: string
  notes: string | null
  status: 'open' | 'doing' | 'done'
  priority: 'low' | 'medium' | 'high'
}

export function TodoListCard({ items }: { items: TodoItem[] }) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const setStatus = (id: string, status: TodoItem['status']) => {
    startTransition(async () => {
      setError(null)
      const res = await fetch('/api/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        setError(payload.error ?? 'Status bijwerken mislukt')
        return
      }
      router.refresh()
    })
  }

  const addTodo = () => {
    if (title.trim().length < 3) {
      setError('Titel moet minimaal 3 tekens zijn')
      return
    }

    startTransition(async () => {
      setError(null)
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, notes, priority: 'medium' })
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        setError(payload.error ?? 'Todo toevoegen mislukt')
        return
      }
      setTitle('')
      setNotes('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Todo lijst</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Voor dashboard/Google/cost acties.</p>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">Nog geen todo&apos;s.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-md border border-gray-200 p-2 text-sm dark:border-gray-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={item.status === 'done' ? 'line-through opacity-60' : ''}>{item.title}</p>
                  {item.notes ? <p className="text-xs text-gray-500 dark:text-gray-400">{item.notes}</p> : null}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setStatus(item.id, 'doing')} disabled={isPending || item.status === 'doing'}>
                    Doing
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setStatus(item.id, 'done')} disabled={isPending || item.status === 'done'}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nieuwe todo" />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notitie (optioneel)" />
        <Button size="sm" onClick={addTodo} disabled={isPending}>Toevoegen</Button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
