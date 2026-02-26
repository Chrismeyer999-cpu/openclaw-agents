import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id,domain,gsc_property,gsc_refresh_token')
    .order('domain')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return NextResponse.json({ error: 'OAuth env ontbreekt' }, { status: 500 })

  const results: Array<{ domain: string; configuredProperty: string | null; sites?: Array<{ siteUrl: string; permissionLevel?: string }>; error?: string }> = []

  for (const w of workspaces ?? []) {
    if (!w.gsc_refresh_token) {
      results.push({ domain: w.domain, configuredProperty: w.gsc_property, error: 'no_refresh_token' })
      continue
    }

    try {
      const token = await getAccessToken(w.gsc_refresh_token, clientId, clientSecret)
      const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const payload = (await res.json().catch(() => ({}))) as { siteEntry?: Array<{ siteUrl: string; permissionLevel?: string }>; error?: { message?: string } }
      if (!res.ok) {
        results.push({ domain: w.domain, configuredProperty: w.gsc_property, error: payload.error?.message ?? `http_${res.status}` })
        continue
      }

      results.push({
        domain: w.domain,
        configuredProperty: w.gsc_property,
        sites: (payload.siteEntry ?? []).map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }))
      })
    } catch (e) {
      results.push({ domain: w.domain, configuredProperty: w.gsc_property, error: e instanceof Error ? e.message : 'unknown_error' })
    }
  }

  return NextResponse.json({ ok: true, results })
}

async function getAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const params = new URLSearchParams()
  params.set('client_id', clientId)
  params.set('client_secret', clientSecret)
  params.set('refresh_token', refreshToken)
  params.set('grant_type', 'refresh_token')
  params.set('scope', 'https://www.googleapis.com/auth/webmasters.readonly')

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  const payload = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string }
  if (!res.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? `token_http_${res.status}`)
  }
  return payload.access_token
}
