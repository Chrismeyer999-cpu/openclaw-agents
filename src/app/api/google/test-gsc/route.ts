import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { workspaceId?: string } | null
  if (!body?.workspaceId) return NextResponse.json({ error: 'workspaceId is verplicht' }, { status: 400 })

  const { data: ws, error } = await supabase
    .from('workspaces')
    .select('id,domain,gsc_property,gsc_refresh_token')
    .eq('id', body.workspaceId)
    .maybeSingle()

  if (error || !ws) return NextResponse.json({ error: error?.message ?? 'Workspace niet gevonden' }, { status: 404 })
  if (!ws.gsc_property || !ws.gsc_refresh_token) return NextResponse.json({ error: 'GSC property of refresh token ontbreekt' }, { status: 400 })

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return NextResponse.json({ error: 'OAuth env ontbreekt' }, { status: 500 })

  const token = await getAccessToken(ws.gsc_refresh_token, clientId, clientSecret)

  const startDate = daysAgoIsoDate(60)
  const endDate = daysAgoIsoDate(1)

  const gscRes = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(ws.gsc_property)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, dimensions: ['page'], rowLimit: 25 })
    }
  )

  const payload = (await gscRes.json().catch(() => ({}))) as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number }>; error?: { message?: string } }
  if (!gscRes.ok) {
    return NextResponse.json(
      { error: payload.error?.message ?? `GSC http ${gscRes.status}`, domain: ws.domain, gscProperty: ws.gsc_property },
      { status: 500 }
    )
  }

  const rows = payload.rows ?? []
  return NextResponse.json({
    ok: true,
    domain: ws.domain,
    gscProperty: ws.gsc_property,
    range: { startDate, endDate },
    rowCount: rows.length,
    sample: rows.slice(0, 5).map((r) => ({ page: r.keys?.[0] ?? null, clicks: r.clicks ?? 0, impressions: r.impressions ?? 0 }))
  })
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
  if (!res.ok || !payload.access_token) throw new Error(payload.error_description ?? `token_http_${res.status}`)
  return payload.access_token
}

function daysAgoIsoDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
