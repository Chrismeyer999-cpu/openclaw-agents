import { SidebarNav, type SidebarWorkspace } from '@/components/dashboard/SidebarNav'
import { SignOutButton } from '@/components/dashboard/SignOutButton'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, domain')
    .order('domain')

  if (error) {
    throw new Error(`Kon workspaces niet laden: ${error.message}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:grid lg:grid-cols-[260px_1fr]">
      <SidebarNav
        workspaces={((workspaces ?? []).map((workspace) => ({
          ...workspace,
          displayName: workspace.domain
        })) ?? []) as SidebarWorkspace[]}
      />
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
          <div>
            <p className="text-sm font-semibold text-gray-900">SEO Intelligence Platform</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <SignOutButton />
        </header>
        <main className="px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
