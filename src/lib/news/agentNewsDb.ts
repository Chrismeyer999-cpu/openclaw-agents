import { createAgentServiceClient, isAgentSupabaseConfigured } from '@/lib/supabase/agentServer'

const AGENT_NEWS_TABLES = ['nieuws', 'brikx_nieuws', 'zwijsen_nieuws', 'news_items', 'nieuws_items'] as const

export type AgentNewsRecord = Record<string, unknown>

export async function listAgentNewsRecords(limit: number) {
  if (!isAgentSupabaseConfigured()) return null

  const client = createAgentServiceClient()
  for (const table of AGENT_NEWS_TABLES) {
    const { data, error } = await client.from(table).select('*').limit(limit)
    if (!error && data) return { table, rows: data as AgentNewsRecord[] }
  }

  return null
}

export async function getAgentNewsRecordById(id: string) {
  if (!isAgentSupabaseConfigured()) return null

  const client = createAgentServiceClient()
  for (const table of AGENT_NEWS_TABLES) {
    const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle()
    if (!error && data) return { table, row: data as AgentNewsRecord }
  }

  return null
}

export async function updateAgentNewsRecordStatus(id: string, reviewStatus: string) {
  if (!isAgentSupabaseConfigured()) return null

  const client = createAgentServiceClient()
  for (const table of AGENT_NEWS_TABLES) {
    const payloads = [{ review_status: reviewStatus }, { status: reviewStatus }, { review_status: reviewStatus, status: reviewStatus }]
    for (const payload of payloads) {
      const { data, error } = await client.from(table).update(payload).eq('id', id).select('id').maybeSingle()
      if (!error && data) return data
    }
  }

  return null
}
