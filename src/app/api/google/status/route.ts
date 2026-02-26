import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspaces, error } = await supabase.from('workspaces').select('id,domain,gsc_property,gsc_refresh_token,ga4_property')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const gscConnected = (workspaces ?? []).filter((w) => w.gsc_property && w.gsc_refresh_token).length
  const ga4Configured = (workspaces ?? []).filter((w: any) => Boolean((w as any).ga4_property)).length

  return NextResponse.json({
    google: {
      gscConnected,
      gscTotal: (workspaces ?? []).length,
      ga4PropertyIdConfigured: ga4Configured > 0,
      ga4WorkspacesConfigured: ga4Configured,
      ga4ClientEmailConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
      ga4PrivateKeyConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
    }
  })
}
