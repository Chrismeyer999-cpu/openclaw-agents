import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspaces, error } = await supabase.from('workspaces').select('id,domain,gsc_property,gsc_refresh_token')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const gscConnected = (workspaces ?? []).filter((w) => w.gsc_property && w.gsc_refresh_token).length

  return NextResponse.json({
    google: {
      gscConnected,
      gscTotal: (workspaces ?? []).length,
      ga4PropertyIdConfigured: Boolean(process.env.GA4_PROPERTY_ID),
      ga4ClientEmailConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
      ga4PrivateKeyConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
    }
  })
}
