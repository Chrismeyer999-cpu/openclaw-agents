import { createSign } from 'node:crypto'
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

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? ''
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64

  const keyInfo = {
    hasRaw: Boolean(raw),
    hasB64: Boolean(b64),
    rawLooksLikePem: Boolean(raw?.includes('BEGIN PRIVATE KEY')),
    b64DecodedLooksLikePem: false
  }

  const key = normalizePrivateKey(raw, b64)
  if (b64?.trim()) {
    try {
      const decoded = Buffer.from(b64.trim(), 'base64').toString('utf8')
      keyInfo.b64DecodedLooksLikePem = decoded.includes('BEGIN PRIVATE KEY')
    } catch {
      keyInfo.b64DecodedLooksLikePem = false
    }
  }

  if (!email) {
    return NextResponse.json({ ok: false, stage: 'env', error: 'GOOGLE_SERVICE_ACCOUNT_EMAIL ontbreekt', keyInfo })
  }
  if (!key) {
    return NextResponse.json({ ok: false, stage: 'env', error: 'Private key niet parsebaar', email: maskEmail(email), keyInfo })
  }

  const jwt = buildJwt(email, key, 'https://www.googleapis.com/auth/analytics.readonly')
  if (!jwt) {
    return NextResponse.json({ ok: false, stage: 'jwt', error: 'JWT bouwen mislukt', email: maskEmail(email), keyInfo })
  }

  const params = new URLSearchParams()
  params.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer')
  params.set('assertion', jwt)

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  const tokenPayload = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string }

  if (!tokenRes.ok || !tokenPayload.access_token) {
    return NextResponse.json({
      ok: false,
      stage: 'token',
      error: tokenPayload.error ?? `http_${tokenRes.status}`,
      errorDescription: tokenPayload.error_description ?? null,
      email: maskEmail(email),
      keyInfo
    })
  }

  return NextResponse.json({ ok: true, stage: 'token', email: maskEmail(email), keyInfo })
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

function buildJwt(email: string, privateKey: string, scope: string) {
  try {
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

    return `${unsigned}.${base64url(signature)}`
  } catch {
    return null
  }
}

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64urlJson(value: object) {
  return base64url(Buffer.from(JSON.stringify(value)))
}

function maskEmail(email?: string) {
  if (!email) return null
  const [name, domain] = email.split('@')
  if (!name || !domain) return 'invalid'
  const left = name.length <= 3 ? name[0] + '***' : `${name.slice(0, 3)}***`
  return `${left}@${domain}`
}
