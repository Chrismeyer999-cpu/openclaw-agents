import { createClient } from '@supabase/supabase-js'

export function isAgentSupabaseConfigured() {
  return Boolean(process.env.AGENT_SUPABASE_URL && process.env.AGENT_SUPABASE_SERVICE_ROLE_KEY)
}

export function createAgentServiceClient() {
  const url = process.env.AGENT_SUPABASE_URL
  const key = process.env.AGENT_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('AGENT_SUPABASE_URL of AGENT_SUPABASE_SERVICE_ROLE_KEY ontbreekt.')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}
