import { SidebarNav, type SidebarWorkspace } from '@/components/dashboard/SidebarNav'
import { SignOutButton } from '@/components/dashboard/SignOutButton'
import { TopbarControls } from '@/components/dashboard/TopbarControls'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const DASHBOARD_BUILD = 'main@5004db5'

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

  const mappedWorkspaces =
    ((workspaces ?? []).map((workspace) => ({
      ...workspace,
      displayName: workspace.domain
    })) ?? []) as SidebarWorkspace[]

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-gray-50 to-orange-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 lg:grid lg:grid-cols-[260px_1fr]">
      <SidebarNav
        workspaces={mappedWorkspaces}
      />
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/90 px-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90 lg:px-6">
          <div className="flex min-h-16 flex-col gap-2 py-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">SEO Intelligence Platform</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
            <p className="text-[11px] text-orange-600 dark:text-orange-300">Build: {DASHBOARD_BUILD}</p>
          </div>
            <TopbarControls workspaces={mappedWorkspaces} />
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
