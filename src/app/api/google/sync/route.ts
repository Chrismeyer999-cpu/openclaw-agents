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

  const byUrl = new Map<string, { id: string }>()
  const byPath = new Map<string, { id: string }>()
  pageRows.forEach((p) => {
    byUrl.set(normalizeUrl(p.url), { id: p.id })
    byPath.set(normalizePathFromUrl(p.url), { id: p.id })
  })

  const endDate = snapshotDate
  // Query with BOTH 'date' and 'page' dimensions so we get daily data points per page
  // This enables the trend chart to show actual daily traffic over time

  const rows: GscRow[] = []
  const rowLimit = 25000

  // Chunk by 15 days to avoid Google's hard 25K total row cut-off per payload on giant sites
  const endD = new Date(snapshotDate)
  let currentStart = new Date(startDate)

  while (currentStart <= endD) {
    let currentEnd = new Date(currentStart)
    currentEnd.setDate(currentEnd.getDate() + 14) // 15 day chunk
    if (currentEnd > endD) currentEnd = endD

    let startRow = 0
    const chunkStart = currentStart.toISOString().slice(0, 10)
    const chunkEnd = currentEnd.toISOString().slice(0, 10)

    while (true) {
      const body = {
        startDate: chunkStart,
        endDate: chunkEnd,
        dimensions: ['date', 'page'],
        rowLimit,
        startRow
      }

      const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(ws.gsc_property)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) throw new Error(`GSC query failed: ${res.status} ${await safeText(res)}`)
      const payload = (await res.json()) as { rows?: GscRow[] }
      const chunk = payload.rows ?? []
      rows.push(...chunk)

      if (chunk.length < rowLimit) break
      startRow += rowLimit
    }

    // next chunk
    currentStart.setDate(currentStart.getDate() + 15)
  }

  // Auto-expand pillar_pages from real GSC pages (prevents tiny 3-page dashboard)
  // With date dimension, keys = [date, page_url]
  const seenUrls = new Set<string>()
  for (const row of rows) {
    const rawUrl = row.keys?.[1] // keys[0]=date, keys[1]=page when using date+page dimensions
    if (!rawUrl || seenUrls.has(rawUrl)) continue
    seenUrls.add(rawUrl)
    const pageUrl = normalizeUrl(rawUrl)
    const pagePath = normalizePathFromUrl(rawUrl)
    if (!pageUrl || !pagePath) continue

    if (!byUrl.has(pageUrl) && !byPath.has(pagePath)) {
      const insertPayload = {
        workspace_id: ws.id,
        url: pageUrl,
        title: titleFromUrl(pageUrl),
        page_type: inferPageType(pagePath),
        intent_type: 'informational',
        target_keywords: [],
        expected_schema_types: []
      }

      const { data: inserted } = await supabase
        .from('pillar_pages')
        .insert(insertPayload)
        .select('id,url')
        .maybeSingle()

      if (inserted?.id) {
        byUrl.set(pageUrl, { id: inserted.id })
        byPath.set(pagePath, { id: inserted.id })
      }
    }
  }

  // Aggregate per (pillar_page_id, date) — one snapshot row per page per day
  const aggregated = new Map<string, { pillar_page_id: string; date: string; clicks: number; impressions: number; positionWeighted: number }>()
  for (const row of rows) {
    const rowDate = row.keys?.[0] // date dimension is first
    const rawUrl = row.keys?.[1]  // page dimension is second
    if (!rawUrl || !rowDate) continue
    const pageUrl = normalizeUrl(rawUrl)
    const pagePath = normalizePathFromUrl(rawUrl)
    if (!pageUrl) continue
    const page = byUrl.get(pageUrl) ?? (pagePath ? byPath.get(pagePath) : undefined)
    if (!page) continue

    const key = `${page.id}::${rowDate}`
    const clicks = Math.max(0, Math.round(Number(row.clicks ?? 0)))
    const impressions = Math.max(0, Math.round(Number(row.impressions ?? 0)))
    const position = Number(row.position ?? 0)

    const cur = aggregated.get(key) ?? { pillar_page_id: page.id, date: rowDate, clicks: 0, impressions: 0, positionWeighted: 0 }
    cur.clicks += clicks
    cur.impressions += impressions
    cur.positionWeighted += position * Math.max(impressions, 1)
    aggregated.set(key, cur)
  }

  const upserts: Array<Record<string, unknown>> = [...aggregated.values()].map((v) => ({
    pillar_page_id: v.pillar_page_id,
    snapshot_date: v.date,
    clicks: v.clicks,
    impressions: v.impressions,
    ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
    avg_position: v.impressions > 0 ? v.positionWeighted / v.impressions : 0
  }))

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
    dimensions: [{ name: 'date' }, { name: 'pagePath' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'engagementRate' }, { name: 'userEngagementDuration' }],
    limit: 50000
  }

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`GA4 runReport failed: ${res.status} ${await safeText(res)}`)

  const payload = (await res.json()) as { rows?: Ga4Row[] }
  const rows = payload.rows ?? []

  const aggregated = new Map<string, { page_url: string; date: string; sessions: number; engaged_sessions: number; engagement_rate_weighted: number; duration_weighted: number }>()
  for (const row of rows) {
    const rawDate = row.dimensionValues?.[0]?.value ?? ''
    const path = row.dimensionValues?.[1]?.value ?? ''
    if (!path.startsWith('/') || !rawDate) continue

    // GA4 date is YYYYMMDD, convert to YYYY-MM-DD
    const finalDate = rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : snapshotDate

    const fullUrl = normalizeUrl(`https://${ws.domain}${path}`)
    const normalizedPath = normalizePath(path)
    const urlMatched = Boolean(fullUrl && knownUrls.has(fullUrl))
    const pathMatched = Boolean(normalizedPath && knownPaths.has(normalizedPath))
    if (!urlMatched && !pathMatched) continue

    const sessions = Math.max(0, Number(row.metricValues?.[0]?.value ?? 0))
    const engaged = Math.max(0, Number(row.metricValues?.[1]?.value ?? 0))
    const engagementRate = Math.max(0, Number(row.metricValues?.[2]?.value ?? 0))
    const engageDuration = Math.max(0, Number(row.metricValues?.[3]?.value ?? 0))

    const key = `${fullUrl}::${finalDate}`
    const cur = aggregated.get(key) ?? { page_url: fullUrl, date: finalDate, sessions: 0, engaged_sessions: 0, engagement_rate_weighted: 0, duration_weighted: 0 }
    cur.sessions += sessions
    cur.engaged_sessions += engaged
    cur.engagement_rate_weighted += engagementRate * Math.max(sessions, 1)
    cur.duration_weighted += engageDuration * Math.max(sessions, 1)
    aggregated.set(key, cur)
  }

  const upserts: Array<Record<string, unknown>> = [...aggregated.values()].map((v) => ({
    workspace_id: ws.id,
    page_url: v.page_url,
    snapshot_date: v.date,
    sessions: Math.round(v.sessions),
    engaged_sessions: Math.round(v.engaged_sessions),
    engagement_rate: v.sessions > 0 ? v.engagement_rate_weighted / v.sessions : 0,
    avg_engagement_time_s: v.sessions > 0 ? v.duration_weighted / v.sessions : 0,
    cta_clicks: 0
  }))

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
  if (!clientId || !clientSecret) throw new Error('OAuth env ontbreekt')

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

  const payload = (await res.json().catch(() => ({}))) as { access_token?: string, error_description?: string, error?: string }
  if (!res.ok) throw new Error(payload.error_description ?? payload.error ?? `token_http_${res.status}`)
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

function inferPageType(path: string): 'pillar' | 'regio' | 'faq' | 'kennisbank' | 'nieuws' {
  const p = path.toLowerCase()
  if (p.includes('/nieuws') || p.includes('/blog')) return 'nieuws'
  if (p.includes('/faq') || p.includes('/veelgestelde-vragen')) return 'faq'
  if (p.includes('/kennisbank')) return 'kennisbank'
  if (p.includes('/regio') || p.includes('/locatie')) return 'regio'
  return 'pillar'
}

function titleFromUrl(url: string) {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, '')
    if (!path || path === '') return 'Homepage'
    const last = path.split('/').filter(Boolean).pop() ?? 'Pagina'
    return decodeURIComponent(last).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Pagina'
  } catch {
    return 'Pagina'
  }
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
