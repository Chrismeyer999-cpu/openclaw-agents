import { createSign } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Workspace = { id: string; domain: string; gsc_property: string | null; gsc_refresh_token: string | null; ga4_property?: string | null }

type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }

type Ga4Row = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspaces, error } = await supabase.from('workspaces').select('id,domain,gsc_property,gsc_refresh_token,ga4_property')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const all = (workspaces ?? []) as Workspace[]
  const snapshotDate = yesterdayIsoDate()
  const startDate = daysAgoIsoDate(60)
  const debug = reqUrlHasDebug(request)
  const results: Array<{
    workspace: string
    gscRows: number
    ga4Rows: number
    errors: string[]
    debug?: {
      gscApiRowsRaw?: number
      gscMatchedRows?: number
      gscProperty?: string | null
      ga4ApiRowsRaw?: number
      ga4MatchedRows?: number
      ga4Property?: string | null
    }
  }> = []

  for (const ws of all) {
    const errors: string[] = []
    let gscRows = 0
    let ga4Rows = 0
    let gscApiRowsRaw = 0
    let gscMatchedRows = 0
    let ga4ApiRowsRaw = 0
    let ga4MatchedRows = 0

    try {
      const gsc = await syncWorkspaceGsc(supabase, ws, snapshotDate, startDate)
      gscRows = gsc.inserted
      gscApiRowsRaw = gsc.apiRowsRaw
      gscMatchedRows = gsc.matchedRows
    } catch (e) {
      errors.push(`GSC: ${toMessage(e)}`)
    }

    try {
      const ga4 = await syncWorkspaceGa4(supabase, ws, snapshotDate, startDate)
      ga4Rows = ga4.inserted
      ga4ApiRowsRaw = ga4.apiRowsRaw
      ga4MatchedRows = ga4.matchedRows
    } catch (e) {
      errors.push(`GA4: ${toMessage(e)}`)
    }

    results.push({
      workspace: ws.domain,
      gscRows,
      ga4Rows,
      errors,
      debug: debug
        ? {
            gscApiRowsRaw,
            gscMatchedRows,
            gscProperty: ws.gsc_property,
            ga4ApiRowsRaw,
            ga4MatchedRows,
            ga4Property: ws.ga4_property ?? process.env.GA4_PROPERTY_ID ?? null
          }
        : undefined
    })
  }

  return NextResponse.json({
    ok: true,
    snapshotDate,
    workspaces: all.length,
    results
  })
}

async function syncWorkspaceGsc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ws: Workspace,
  snapshotDate: string,
  startDate: string
): Promise<{ inserted: number; apiRowsRaw: number; matchedRows: number }> {
  if (!ws.gsc_property || !ws.gsc_refresh_token) return { inserted: 0, apiRowsRaw: 0, matchedRows: 0 }

  const token = await getOAuthAccessTokenFromRefresh(ws.gsc_refresh_token, GSC_SCOPE)
  if (!token) throw new Error('Geen GSC access token verkregen')

  const { data: pages, error: pagesError } = await supabase
    .from('pillar_pages')
    .select('id,url,page_type')
    .eq('workspace_id', ws.id)

  if (pagesError) throw new Error(pagesError.message)
  const pageRows = pages ?? []
  if (pageRows.length === 0) return { inserted: 0, apiRowsRaw: 0, matchedRows: 0 }

  const byUrl = new Map<string, { id: string }>()
  pageRows.forEach((p) => byUrl.set(normalizeUrl(p.url), { id: p.id }))

  const endDate = snapshotDate
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

  if (upserts.length === 0) return { inserted: 0, apiRowsRaw: rows.length, matchedRows: 0 }

  const { error: upsertError } = await supabase
    .from('gsc_snapshots')
    .upsert(upserts, { onConflict: 'pillar_page_id,snapshot_date' })

  if (upsertError) throw new Error(upsertError.message)
  return { inserted: upserts.length, apiRowsRaw: rows.length, matchedRows: upserts.length }
}

async function syncWorkspaceGa4(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ws: Workspace,
  snapshotDate: string,
  startDate: string
): Promise<{ inserted: number; apiRowsRaw: number; matchedRows: number }> {
  const propertyId = (ws.ga4_property ?? process.env.GA4_PROPERTY_ID ?? '').trim()
  if (!propertyId) return { inserted: 0, apiRowsRaw: 0, matchedRows: 0 }

  const token = await getServiceAccountAccessToken(GA4_SCOPE)
  if (!token) return { inserted: 0, apiRowsRaw: 0, matchedRows: 0 }

  const { data: pages, error: pagesError } = await supabase
    .from('pillar_pages')
    .select('url,page_type')
    .eq('workspace_id', ws.id)

  if (pagesError) throw new Error(pagesError.message)

  const knownUrls = new Set((pages ?? []).map((p) => normalizeUrl(p.url)).filter(Boolean) as string[])
  const knownPaths = new Set(
    (pages ?? [])
      .map((p) => normalizePathFromUrl(p.url))
      .filter(Boolean) as string[]
  )
  if (knownUrls.size === 0 && knownPaths.size === 0) return { inserted: 0, apiRowsRaw: 0, matchedRows: 0 }

  const body = {
    dateRanges: [{ startDate, endDate: snapshotDate }],
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
    const normalizedPath = normalizePath(path)
    const urlMatched = Boolean(fullUrl && knownUrls.has(fullUrl))
    const pathMatched = Boolean(normalizedPath && knownPaths.has(normalizedPath))
    if (!urlMatched && !pathMatched) continue

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

  if (upserts.length === 0) return { inserted: 0, apiRowsRaw: rows.length, matchedRows: 0 }

  const { error: upsertError } = await supabase
    .from('ga4_page_snapshots')
    .upsert(upserts, { onConflict: 'workspace_id,page_url,snapshot_date' })

  if (upsertError) throw new Error(upsertError.message)
  return { inserted: upserts.length, apiRowsRaw: rows.length, matchedRows: upserts.length }
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
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64
  if (!email || (!keyRaw && !keyB64)) return null

  const privateKey = normalizePrivateKey(keyRaw, keyB64)
  if (!privateKey) return null

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
    const pathname = normalizePath(u.pathname)
    return `${u.protocol}//${u.host}${pathname}`.toLowerCase()
  } catch {
    return input.trim().toLowerCase().replace(/\/$/, '')
  }
}

function normalizePathFromUrl(input: string | null | undefined) {
  if (!input) return ''
  try {
    const u = new URL(input)
    return normalizePath(u.pathname)
  } catch {
    return normalizePath(input)
  }
}

function normalizePath(path: string | null | undefined) {
  if (!path) return ''
  const p = path.trim()
  if (!p) return ''
  const withSlash = p.startsWith('/') ? p : `/${p}`
  const noTrailing = withSlash.replace(/\/$/, '')
  return (noTrailing || '/').toLowerCase()
}

function yesterdayIsoDate() {
  return daysAgoIsoDate(1)
}

function daysAgoIsoDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
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

function normalizePrivateKey(raw?: string, b64?: string) {
  try {
    let key = ''
    if (b64?.trim()) {
      key = Buffer.from(b64.trim(), 'base64').toString('utf8')
    } else if (raw?.trim()) {
      key = raw.trim()
    }

    if (!key) return null

    // Vercel env often stores escaped newlines
    key = key.replace(/\\n/g, '\n')

    // Strip accidental wrapping quotes
    key = key.replace(/^"|"$/g, '').replace(/^'|'$/g, '')

    if (!key.includes('BEGIN PRIVATE KEY')) return null
    return key
  } catch {
    return null
  }
}

function reqUrlHasDebug(request: Request) {
  try {
    const u = new URL(request.url)
    return u.searchParams.get('debug') === '1'
  } catch {
    return false
  }
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error'
}
