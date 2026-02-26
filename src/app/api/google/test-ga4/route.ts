import { createSign } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

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
    .select('id,domain,ga4_property')
    .eq('id', body.workspaceId)
    .maybeSingle()

  if (error || !ws) return NextResponse.json({ error: error?.message ?? 'Workspace niet gevonden' }, { status: 404 })

  const propertyId = String(ws.ga4_property ?? process.env.GA4_PROPERTY_ID ?? '').trim()
  if (!propertyId) return NextResponse.json({ error: 'Geen GA4 property id geconfigureerd' }, { status: 400 })

  const token = await getServiceAccountAccessToken(GA4_SCOPE)
  if (!token) return NextResponse.json({ error: 'Geen service-account access token verkregen' }, { status: 500 })

  const startDate = daysAgoIsoDate(60)
  const endDate = daysAgoIsoDate(1)

  const bodyPayload = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'engagementRate' }, { name: 'userEngagementDuration' }],
    limit: 25
  }

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload)
  })

  const payload = (await res.json().catch(() => ({}))) as { rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>; error?: { message?: string } }
  if (!res.ok) {
    return NextResponse.json(
      {
        error: payload.error?.message ?? `GA4 http ${res.status}`,
        domain: ws.domain,
        ga4Property: propertyId,
        runtimeServiceAccount: maskEmail(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
      },
      { status: 500 }
    )
  }

  const rows = payload.rows ?? []
  return NextResponse.json({
    ok: true,
    domain: ws.domain,
    ga4Property: propertyId,
    runtimeServiceAccount: maskEmail(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
    range: { startDate, endDate },
    rowCount: rows.length,
    sample: rows.slice(0, 5).map((r) => ({
      pagePath: r.dimensionValues?.[0]?.value ?? null,
      sessions: Number(r.metricValues?.[0]?.value ?? 0),
      engagedSessions: Number(r.metricValues?.[1]?.value ?? 0),
      engagementRate: Number(r.metricValues?.[2]?.value ?? 0)
    }))
  })
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

function normalizePrivateKey(raw?: string, b64?: string) {
  try {
    let key = ''
    if (b64?.trim()) key = Buffer.from(b64.trim(), 'base64').toString('utf8')
    else if (raw?.trim()) key = raw.trim()
    if (!key) return null
    key = key.replace(/\\n/g, '\n')
    key = key.replace(/^"|"$/g, '').replace(/^'|'$/g, '')
    if (!key.includes('BEGIN PRIVATE KEY')) return null
    return key
  } catch {
    return null
  }
}

function maskEmail(email?: string) {
  if (!email) return null
  const [name, domain] = email.split('@')
  if (!name || !domain) return 'invalid'
  const left = name.length <= 3 ? name[0] + '***' : `${name.slice(0, 3)}***`
  return `${left}@${domain}`
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
