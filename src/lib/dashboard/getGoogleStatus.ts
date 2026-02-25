import { createClient } from '@/lib/supabase/server'

export interface GoogleStatus {
  gscConnected: number
  gscTotal: number
  ga4Ready: boolean
}

export async function getGoogleStatus(): Promise<GoogleStatus | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('workspaces').select('id,gsc_property,gsc_refresh_token')
  if (error) return null

  const gscConnected = (data ?? []).filter((w) => w.gsc_property && w.gsc_refresh_token).length
  const gscTotal = (data ?? []).length
  const ga4Ready = Boolean(process.env.GA4_PROPERTY_ID) && Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) && Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)

  return { gscConnected, gscTotal, ga4Ready }
}
