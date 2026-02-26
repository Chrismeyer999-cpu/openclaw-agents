'use client'

import { cn } from '@/lib/utils'
import { Globe, LayoutDashboard, ListChecks, Newspaper, Search, Target, TextSearch, Cpu } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface SidebarWorkspace {
  id: string
  domain: string
  displayName: string
}

interface SidebarNavProps {
  workspaces: SidebarWorkspace[]
}

export function SidebarNav({ workspaces }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden border-r border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 lg:block">
      <div className="flex h-16 items-center border-b border-gray-200 px-5 dark:border-gray-800">
        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Mission Control</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">SEO • Agents • Content</p>
        </div>
      </div>
      <nav className="space-y-6 p-4">
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Overview</p>
          <NavItem href="/dashboard" label="Dashboard" active={pathname === '/dashboard'} icon={LayoutDashboard} />
          <NavItem href="/dashboard/status" label="Roadmap & Status" active={pathname.startsWith('/dashboard/status')} icon={ListChecks} />
          <NavItem href="/dashboard/engine" label="AI-SEO Engine" active={pathname.startsWith('/dashboard/engine')} icon={Cpu} />
          <NavItem href="/dashboard/golf" label="Golf Mission Control" active={pathname.startsWith('/dashboard/golf')} icon={Target} />
        </div>
        <div className="space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Workspaces</p>
          {workspaces.map((workspace) => {
            const workspacePath = `/dashboard/${workspace.id}`
            const activeWorkspace = pathname.startsWith(workspacePath)
            return (
              <div key={workspace.id} className="space-y-1 rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                <NavItem href={workspacePath} label={workspace.domain} active={activeWorkspace} icon={Globe} />
                <div className="space-y-1 pl-8">
                  <SubItem href={`${workspacePath}/pages`} label="Site pagina’s" active={pathname.startsWith(`${workspacePath}/pages`)} icon={Search} />
                  <SubItem href={`${workspacePath}/llm`} label="LLM zichtbaarheid" active={pathname.startsWith(`${workspacePath}/llm`)} icon={TextSearch} />
                  <SubItem href={`${workspacePath}/nieuws`} label="Nieuwsitems" active={pathname.startsWith(`${workspacePath}/nieuws`)} icon={Newspaper} />
                </div>
              </div>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}

function NavItem({
  href,
  label,
  active,
  icon: Icon
}: {
  href: string
  label: string
  active: boolean
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  )
}

function SubItem({
  href,
  label,
  active,
  icon: Icon
}: {
  href: string
  label: string
  active: boolean
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition-colors',
        active ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
      )}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
    </Link>
  )
}
