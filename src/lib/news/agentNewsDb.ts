import { createAgentServiceClient, isAgentSupabaseConfigured } from '@/lib/supabase/agentServer'

const AGENT_NEWS_TABLES = ['zwijsen_nieuws', 'brikx_nieuws', 'nieuws', 'news_items', 'nieuws_items'] as const

export type AgentNewsRecord = Record<string, unknown>
export interface AgentNewsContentUpdate {
  body?: string
  featuredImageUrl?: string | null
  featuredImageAlt?: string | null
}

export async function listAgentNewsRecords(limit: number, status?: string) {
  if (!isAgentSupabaseConfigured()) return null

  const client = createAgentServiceClient()
  const allRows: AgentNewsRecord[] = []

  // Ensure we sort by date to get recent news when using a limit
  const _limit = status && status !== 'all' ? Math.max(limit, 500) : limit

  for (const table of AGENT_NEWS_TABLES) {
    const { data, error } = await client.from(table).select('*').limit(_limit)
    if (!error && Array.isArray(data) && data.length > 0) {
      let chunk = data as AgentNewsRecord[]

      chunk.forEach(r => {
        r._source_table = table
      })

      if (status && status !== 'all') {
        // Filter chunk locally because tables have different column names (review_status vs status)
        chunk = chunk.filter(r => {
          const rs = r.review_status ?? r.status ?? 'pending'
          return rs === status
        })
      }

      allRows.push(...chunk)
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
  return updateAgentNewsRecordContent(id, { body })
}

export async function updateAgentNewsRecordContent(id: string, update: AgentNewsContentUpdate) {
  if (!isAgentSupabaseConfigured()) return null

  const client = createAgentServiceClient()
  const body = typeof update.body === 'string' ? update.body : null
  const imageUrl = normalizeOptionalText(update.featuredImageUrl)
  const imageAlt = normalizeOptionalText(update.featuredImageAlt)
  const bodyPayloads: AgentNewsRecord[] =
    body !== null
      ? [{ body }, { content: body }, { body_md: body }, { body, content: body }, { body, body_md: body }, { body_md: body, content: body }]
      : []
  const imagePayloads: AgentNewsRecord[] =
    imageUrl !== undefined || imageAlt !== undefined
      ? [
        compactPayload({ featured_image_url: imageUrl, featured_image_alt: imageAlt }),
        compactPayload({ image_url: imageUrl, image_alt: imageAlt }),
        compactPayload({ featured_image_url: imageUrl }),
        compactPayload({ image_url: imageUrl }),
        compactPayload({ featured_image_alt: imageAlt }),
        compactPayload({ image_alt: imageAlt })
      ]
      : []

  if (bodyPayloads.length === 0 && imagePayloads.length === 0) return { id }

  for (const table of AGENT_NEWS_TABLES) {
    let didUpdate = false

    for (const payload of bodyPayloads) {
      if (Object.keys(payload).length === 0) continue
      const { data, error } = await client.from(table).update(payload).eq('id', id).select('id').maybeSingle()
      if (!error && data) {
        didUpdate = true
        break
      }
    }

    for (const payload of imagePayloads) {
      if (Object.keys(payload).length === 0) continue
      const { data, error } = await client.from(table).update(payload).eq('id', id).select('id').maybeSingle()
      if (!error && data) {
        didUpdate = true
        break
      }
    }

    if (didUpdate) {
      return { id }
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

function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined) return undefined
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : null
}

function compactPayload(payload: AgentNewsRecord) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}
