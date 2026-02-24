import { createClient } from '@supabase/supabase-js'

export function isKavelSupabaseConfigured() {
  return Boolean(process.env.KAVEL_SUPABASE_URL && process.env.KAVEL_SUPABASE_SERVICE_ROLE_KEY)
}

export function createKavelServiceClient() {
  const url = process.env.KAVEL_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.KAVEL_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('KAVEL_SUPABASE_URL of KAVEL_SUPABASE_SERVICE_ROLE_KEY ontbreekt.')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

