import { createSign } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Workspace = { id: string; domain: string; gsc_property: string | null; gsc_refresh_token: string | null }

type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }

type Ga4Row = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspaces, error } = await supabase.from('workspaces').select('id,domain,gsc_property,gsc_refresh_token')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const all = (workspaces ?? []) as Workspace[]
  const snapshotDate = yesterdayIsoDate()
  const results: Array<{ workspace: string; gscRows: number; ga4Rows: number; errors: string[] }> = []

  for (const ws of all) {
    const errors: string[] = []
    let gscRows = 0
    let ga4Rows = 0

    try {
      gscRows = await syncWorkspaceGsc(supabase, ws, snapshotDate)
    } catch (e) {
      errors.push(`GSC: ${toMessage(e)}`)
    }

    try {
      ga4Rows = await syncWorkspaceGa4(supabase, ws, snapshotDate)
    } catch (e) {
      errors.push(`GA4: ${toMessage(e)}`)
    }

    results.push({ workspace: ws.domain, gscRows, ga4Rows, errors })
  }

  return NextResponse.json({
    ok: true,
    snapshotDate,
    workspaces: all.length,
    results
  })
}

async function syncWorkspaceGsc(supabase: Awaited<ReturnType<typeof createClient>>, ws: Workspace, snapshotDate: string) {
  if (!ws.gsc_property || !ws.gsc_refresh_token) return 0

  const token = await getOAuthAccessTokenFromRefresh(ws.gsc_refresh_token, GSC_SCOPE)
  if (!token) throw new Error('Geen GSC access token verkregen')

  const { data: pages, error: pagesError } = await supabase
    .from('pillar_pages')
    .select('id,url,page_type')
    .eq('workspace_id', ws.id)
    .eq('page_type', 'nieuws')

  if (pagesError) throw new Error(pagesError.message)
  const pageRows = pages ?? []
  if (pageRows.length === 0) return 0

  const byUrl = new Map<string, { id: string }>()
  pageRows.forEach((p) => byUrl.set(normalizeUrl(p.url), { id: p.id }))

  const endDate = snapshotDate
  const startDate = snapshotDate
  const body = {
    startDate,
    endDate,
    dimensions: ['page'],
    rowLimit: 2500
  }

  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(ws.gsc_property)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!res.ok) throw new Error(`GSC query failed: ${res.status} ${await safeText(res)}`)
  const payload = (await res.json()) as { rows?: GscRow[] }
  const rows = payload.rows ?? []

  const upserts: Array<Record<string, unknown>> = []
  for (const row of rows) {
    const pageUrl = normalizeUrl(row.keys?.[0])
    if (!pageUrl) continue
    const page = byUrl.get(pageUrl)
    if (!page) continue

    upserts.push({
      pillar_page_id: page.id,
      snapshot_date: snapshotDate,
      clicks: Math.round(Number(row.clicks ?? 0)),
      impressions: Math.round(Number(row.impressions ?? 0)),
      ctr: Number(row.ctr ?? 0),
      avg_position: Number(row.position ?? 0)
    })
  }

  if (upserts.length === 0) return 0

  const { error: upsertError } = await supabase
    .from('gsc_snapshots')
    .upsert(upserts, { onConflict: 'pillar_page_id,snapshot_date' })

  if (upsertError) throw new Error(upsertError.message)
  return upserts.length
}

async function syncWorkspaceGa4(supabase: Awaited<ReturnType<typeof createClient>>, ws: Workspace, snapshotDate: string) {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim()
  if (!propertyId) return 0

  const token = await getServiceAccountAccessToken(GA4_SCOPE)
  if (!token) return 0

  const { data: pages, error: pagesError } = await supabase
    .from('pillar_pages')
    .select('url,page_type')
    .eq('workspace_id', ws.id)
    .eq('page_type', 'nieuws')

  if (pagesError) throw new Error(pagesError.message)

  const knownUrls = new Set((pages ?? []).map((p) => normalizeUrl(p.url)).filter(Boolean) as string[])
  if (knownUrls.size === 0) return 0

  const body = {
    dateRanges: [{ startDate: snapshotDate, endDate: snapshotDate }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'engagementRate' }, { name: 'userEngagementDuration' }],
    limit: 5000
  }

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`GA4 runReport failed: ${res.status} ${await safeText(res)}`)

  const payload = (await res.json()) as { rows?: Ga4Row[] }
  const rows = payload.rows ?? []

  const upserts: Array<Record<string, unknown>> = []
  for (const row of rows) {
    const path = row.dimensionValues?.[0]?.value ?? ''
    if (!path.startsWith('/')) continue
    const fullUrl = normalizeUrl(`https://${ws.domain}${path}`)
    if (!fullUrl || !knownUrls.has(fullUrl)) continue

    const sessions = Number(row.metricValues?.[0]?.value ?? 0)
    const engaged = Number(row.metricValues?.[1]?.value ?? 0)
    const engagementRate = Number(row.metricValues?.[2]?.value ?? 0)
    const engageDuration = Number(row.metricValues?.[3]?.value ?? 0)

    upserts.push({
      workspace_id: ws.id,
      page_url: fullUrl,
      snapshot_date: snapshotDate,
      sessions: Math.round(sessions),
      engaged_sessions: Math.round(engaged),
      engagement_rate: engagementRate,
      avg_engagement_time_s: engageDuration,
      cta_clicks: 0
    })
  }

  if (upserts.length === 0) return 0

  const { error: upsertError } = await supabase
    .from('ga4_page_snapshots')
    .upsert(upserts, { onConflict: 'workspace_id,page_url,snapshot_date' })

  if (upsertError) throw new Error(upsertError.message)
  return upserts.length
}

async function getOAuthAccessTokenFromRefresh(refreshToken: string, scope: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null

  const params = new URLSearchParams()
  params.set('client_id', clientId)
  params.set('client_secret', clientSecret)
  params.set('refresh_token', refreshToken)
  params.set('grant_type', 'refresh_token')
  params.set('scope', scope)

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })
  if (!res.ok) return null
  const payload = (await res.json()) as { access_token?: string }
  return payload.access_token ?? null
}

async function getServiceAccountAccessToken(scope: string) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !keyRaw) return null
  const privateKey = keyRaw.replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const header = base64urlJson({ alg: 'RS256', typ: 'JWT' })
  const claims = base64urlJson({
    iss: email,
    scope,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now
  })
  const unsigned = `${header}.${claims}`

  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const signature = signer.sign(privateKey)
  const assertion = `${unsigned}.${base64url(signature)}`

  const params = new URLSearchParams()
  params.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer')
  params.set('assertion', assertion)

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  if (!res.ok) return null
  const payload = (await res.json()) as { access_token?: string }
  return payload.access_token ?? null
}

function normalizeUrl(input: string | null | undefined) {
  if (!input) return ''
  try {
    const u = new URL(input)
    const pathname = u.pathname.replace(/\/$/, '') || '/'
    return `${u.protocol}//${u.host}${pathname}`.toLowerCase()
  } catch {
    return input.trim().toLowerCase().replace(/\/$/, '')
  }
}

function yesterdayIsoDate() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64urlJson(value: object) {
  return base64url(Buffer.from(JSON.stringify(value)))
}

async function safeText(res: Response) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error'
}
