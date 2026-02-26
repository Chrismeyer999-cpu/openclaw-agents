import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.redirect(new URL('/dashboard/google?error=unauthorized', request.url))

  const reqUrl = new URL(request.url)
  const code = reqUrl.searchParams.get('code')
  const state = reqUrl.searchParams.get('state')
  if (!code || !state) return NextResponse.redirect(new URL('/dashboard/google?error=missing_code_or_state', request.url))

  let workspaceId = ''
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { workspaceId?: string }
    workspaceId = parsed.workspaceId ?? ''
  } catch {
    return NextResponse.redirect(new URL('/dashboard/google?error=bad_state', request.url))
  }

  if (!workspaceId) return NextResponse.redirect(new URL('/dashboard/google?error=missing_workspace', request.url))

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL('/dashboard/google?error=oauth_env_missing', request.url))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${reqUrl.protocol}//${reqUrl.host}`
  const redirectUri = `${appUrl}/api/google/oauth/callback`

  const params = new URLSearchParams()
  params.set('code', code)
  params.set('client_id', clientId)
  params.set('client_secret', clientSecret)
  params.set('redirect_uri', redirectUri)
  params.set('grant_type', 'authorization_code')

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  const tokenPayload = (await tokenRes.json().catch(() => ({}))) as { refresh_token?: string; error?: string }
  if (!tokenRes.ok || !tokenPayload.refresh_token) {
    return NextResponse.redirect(new URL(`/dashboard/google?error=token_failed`, request.url))
  }

  const { error } = await supabase
    .from('workspaces')
    .update({ gsc_refresh_token: tokenPayload.refresh_token, updated_at: new Date().toISOString() })
    .eq('id', workspaceId)

  if (error) return NextResponse.redirect(new URL(`/dashboard/google?error=save_failed`, request.url))

  return NextResponse.redirect(new URL('/dashboard/google?connected=1', request.url))
}
