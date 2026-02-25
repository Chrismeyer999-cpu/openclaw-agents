import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspaces, error } = await supabase.from('workspaces').select('id,domain,gsc_property,gsc_refresh_token')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const gscReady = (workspaces ?? []).filter((w) => w.gsc_property && w.gsc_refresh_token).length
  const ga4Ready = Boolean(process.env.GA4_PROPERTY_ID) && Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) && Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)

  // Sync scaffolding endpoint: keeps orchestration contract stable while external connector is finalized.
  return NextResponse.json({
    ok: true,
    message: 'Google sync job endpoint actief (scaffold). Koppel nu connector-implementatie voor daadwerkelijke fetch.',
    summary: {
      workspaces: (workspaces ?? []).length,
      gscReady,
      ga4Ready
    },
    nextSteps: [
      'Implement GSC fetch per workspace + schrijf naar gsc_snapshots',
      'Implement GA4 fetch per workspace + schrijf naar ga4_page_snapshots',
      'Schedule daily run (cron) naar /api/google/sync'
    ]
  })
}
