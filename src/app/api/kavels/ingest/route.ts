import { createHash, randomUUID } from 'crypto'

import type { ListingSourceType, ListingStatus } from '@/lib/kavels/types'
import { createKavelServiceClient } from '@/lib/supabase/kavelServer'
import { NextResponse } from 'next/server'

const ALLOWED_SOURCES = new Set<ListingSourceType>(['gmail_funda', 'openclaw', 'manual'])
const ALLOWED_STATUSES = new Set<ListingStatus>(['pending', 'approved', 'published', 'skipped', 'error'])

type IngestPayload = {
  kavel_id?: string | null
  funda_id?: string | null
  source_type?: ListingSourceType
  ingest_status?: ListingStatus
  source_url?: string | null
  adres?: string | null
  postcode?: string | null
  plaats?: string | null
  provincie?: string | null
  prijs?: number | string | null
  oppervlakte?: number | string | null
  image_url?: string | null
  map_url?: string | null
  specs?: Record<string, unknown>
}

export async function POST(request: Request) {
  const expectedSecret = process.env.CRON_SECRET
  const providedSecret = request.headers.get('x-cron-secret')
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { items?: IngestPayload[]; item?: IngestPayload; source_type?: ListingSourceType } | null
  const items = Array.isArray(body?.items) ? body.items : body?.item ? [body.item] : []
  if (items.length === 0) {
    return NextResponse.json({ error: 'Geen ingest-items ontvangen' }, { status: 400 })
  }

  let supabase
  try {
    supabase = createKavelServiceClient()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'KAVEL_SUPABASE credentials ontbreken'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const now = new Date().toISOString()
  const normalizedRows = items.map((item) => normalizeItem(item, body?.source_type, now))

  const { data, error } = await supabase.from('listings').upsert(normalizedRows, { onConflict: 'kavel_id' }).select('id, kavel_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    count: data?.length ?? 0,
    ids: (data ?? []).map((row) => row.kavel_id)
  })
}

function normalizeItem(item: IngestPayload, fallbackSourceType: ListingSourceType | undefined, now: string) {
  const sourceType = normalizeSourceType(item.source_type ?? fallbackSourceType)
  const fundaId = asOptionalString(item.funda_id)
  const sourceUrl = asOptionalString(item.source_url)
  const kavelId = asOptionalString(item.kavel_id) ?? createKavelId(fundaId, sourceUrl, item.adres, item.plaats)

  return {
    kavel_id: kavelId,
    funda_id: fundaId,
    source_type: sourceType,
    ingest_status: normalizeListingStatus(item.ingest_status),
    source_url: sourceUrl,
    adres: asOptionalString(item.adres),
    postcode: asOptionalString(item.postcode),
    plaats: asOptionalString(item.plaats),
    provincie: asOptionalString(item.provincie),
    prijs: normalizeNumber(item.prijs),
    oppervlakte: normalizeNumber(item.oppervlakte),
    image_url: asOptionalString(item.image_url),
    map_url: asOptionalString(item.map_url),
    specs: isRecord(item.specs) ? item.specs : {},
    updated_at: now
  }
}

function normalizeSourceType(value: unknown): ListingSourceType {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase() as ListingSourceType
    if (ALLOWED_SOURCES.has(normalized)) return normalized
  }
  return 'manual'
}

function normalizeListingStatus(value: unknown): ListingStatus {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase() as ListingStatus
    if (ALLOWED_STATUSES.has(normalized)) return normalized
  }
  return 'pending'
}

function createKavelId(fundaId: string | null, sourceUrl: string | null, adres: string | null | undefined, plaats: string | null | undefined) {
  if (fundaId) return fundaId
  const raw = [sourceUrl, adres, plaats, randomUUID()].filter(Boolean).join('|')
  return createHash('md5').update(raw).digest('hex').slice(0, 12)
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
