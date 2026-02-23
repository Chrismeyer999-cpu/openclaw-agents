import { createAgentServiceClient, isAgentSupabaseConfigured } from '@/lib/supabase/agentServer'

const AGENT_NEWS_TABLES = ['zwijsen_nieuws', 'brikx_nieuws', 'nieuws', 'news_items', 'nieuws_items'] as const

export type AgentNewsRecord = Record<string, unknown>

export async function listAgentNewsRecords(limit: number) {
  if (!isAgentSupabaseConfigured()) return null

  const client = createAgentServiceClient()
  const allRows: AgentNewsRecord[] = []

  for (const table of AGENT_NEWS_TABLES) {
    const { data, error } = await client.from(table).select('*').limit(limit)
    if (!error && Array.isArray(data) && data.length > 0) {
      allRows.push(...(data as AgentNewsRecord[]))
    }
  }

  if (allRows.length === 0) return null
  return { table: 'multi', rows: allRows.slice(0, limit) }
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
  const publishedTimestamp = reviewStatus === 'published' ? new Date().toISOString() : null
  for (const table of AGENT_NEWS_TABLES) {
    const payloads = [
      { review_status: reviewStatus, ...(publishedTimestamp ? { published_at: publishedTimestamp, published: publishedTimestamp } : {}) },
      { status: reviewStatus, ...(publishedTimestamp ? { published_at: publishedTimestamp, published: publishedTimestamp } : {}) },
      {
        review_status: reviewStatus,
        status: reviewStatus,
        ...(publishedTimestamp ? { published_at: publishedTimestamp, published: publishedTimestamp } : {})
      }
    ]
    for (const payload of payloads) {
      const { data, error } = await client.from(table).update(payload).eq('id', id).select('id').maybeSingle()
      if (!error && data) return data
    }
  }

  return null
}

export async function updateAgentNewsRecordBody(id: string, body: string) {
  if (!isAgentSupabaseConfigured()) return null

  const client = createAgentServiceClient()
  for (const table of AGENT_NEWS_TABLES) {
    const payloads = [{ body }, { content: body }, { body_md: body }, { body, content: body }, { body, body_md: body }, { body_md: body, content: body }]
    for (const payload of payloads) {
      const { data, error } = await client.from(table).update(payload).eq('id', id).select('id').maybeSingle()
      if (!error && data) return data
    }
  }

  return null
}

export async function deleteAgentNewsRecord(id: string) {
  if (!isAgentSupabaseConfigured()) return null

  const client = createAgentServiceClient()
  for (const table of AGENT_NEWS_TABLES) {
    const { data, error } = await client.from(table).delete().eq('id', id).select('id').maybeSingle()
    if (!error && data) return data
  }

  return null
}
