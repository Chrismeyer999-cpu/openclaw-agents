'use client'

import { Button } from '@/components/ui/button'
import { DarkModeToggle } from '@/components/dashboard/DarkModeToggle'
import { Input } from '@/components/ui/input'
import type { SidebarWorkspace } from '@/components/dashboard/SidebarNav'
import { Download, Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

interface TopbarControlsProps {
  workspaces: SidebarWorkspace[]
}

export function TopbarControls({ workspaces }: TopbarControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  const activeWorkspace = useMemo(() => {
    const byPath = workspaces.find((workspace) => pathname.startsWith(`/dashboard/${workspace.id}`))
    return byPath?.id ?? ''
  }, [pathname, workspaces])

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = query.trim()
    if (!q) {
      router.push('/dashboard/nieuws')
      return
    }
    router.push(`/dashboard/nieuws?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <form onSubmit={onSearchSubmit} className="relative min-w-[220px] flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-gray-400 dark:text-gray-500" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek titel, pagina, keyword..."
          className="h-9 border-gray-200 bg-white pl-8 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </form>

      <select
        aria-label="Workspace switcher"
        value={activeWorkspace}
        onChange={(event) => {
          const value = event.target.value
          if (!value) return
          router.push(`/dashboard/${value}`)
        }}
        className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        <option value="">Workspace</option>
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.domain}
          </option>
        ))}
      </select>

      <DarkModeToggle />

      <Button
        type="button"
        variant="outline"
        className="h-9 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/20"
        onClick={() => window.print()}
      >
        <Download className="size-4" />
        Export
      </Button>
    </div>
  )
}
