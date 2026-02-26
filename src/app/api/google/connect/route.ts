import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const workspaceId = url.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is verplicht' }, { status: 400 })

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'GOOGLE_OAUTH_CLIENT_ID ontbreekt' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`
  const redirectUri = `${appUrl}/api/google/oauth/callback`

  const state = Buffer.from(JSON.stringify({ workspaceId }), 'utf8').toString('base64url')

  const auth = new URL(GOOGLE_AUTH_URL)
  auth.searchParams.set('client_id', clientId)
  auth.searchParams.set('redirect_uri', redirectUri)
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('access_type', 'offline')
  auth.searchParams.set('prompt', 'consent')
  auth.searchParams.set('include_granted_scopes', 'true')
  auth.searchParams.set('scope', 'https://www.googleapis.com/auth/webmasters.readonly')
  auth.searchParams.set('state', state)

  return NextResponse.redirect(auth)
}
