import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function WorkspaceLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('id, domain')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) {
    throw new Error(`Kon workspace niet laden: ${error.message}`)
  }
  if (!workspace) {
    notFound()
  }

  const tabs = [
    { label: 'Overview', href: `/dashboard/${workspace.id}` },
    { label: 'Pages', href: `/dashboard/${workspace.id}/pages` },
    { label: 'LLM', href: `/dashboard/${workspace.id}/llm` },
    { label: 'Nieuws', href: `/dashboard/${workspace.id}/nieuws` }
  ]

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{workspace.domain}</h1>
          <Badge variant="outline">{workspace.domain}</Badge>
        </div>
        <nav className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </section>
  )
}
