import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function KpiStrip({
  items
}: {
  items: Array<{ label: string; value: string; hint?: string; tone?: 'default' | 'success' | 'warning' | 'danger' }>
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-xl border p-4 shadow-sm transition-colors',
            'bg-white/95 dark:bg-gray-900/90',
            item.tone === 'success' && 'border-emerald-200 dark:border-emerald-900/50',
            item.tone === 'warning' && 'border-amber-200 dark:border-amber-900/50',
            item.tone === 'danger' && 'border-rose-200 dark:border-rose-900/50',
            (!item.tone || item.tone === 'default') && 'border-gray-200 dark:border-gray-800'
          )}
        >
          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{item.value}</p>
          {item.hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  )
}

export function StatusPills({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

export function SoftPill({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="outline" className="rounded-full border-gray-200 bg-white/80 px-3 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-900/80">
      {children}
    </Badge>
  )
}
