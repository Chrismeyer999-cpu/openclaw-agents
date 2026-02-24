import { createHash, randomUUID } from 'crypto'

import { buildKavelArchitectArticle, buildKavelArchitectSummary, buildZwijsenArticle, listingToKavelSlug } from '@/lib/kavels/copy'
import type {
  IngestKavelInput,
  KavelAlertStatus,
  KavelAlertSubscriber,
  KavelListing,
  KavelListingFilters,
  KavelPublishResult,
  KavelSyncJob,
  KavelSyncTriggerType,
  ListingSourceType,
  ListingStatus,
  ManualKavelInput,
  UpdateKavelListingInput,
  UpsertKavelAlertSubscriberInput
} from '@/lib/kavels/types'
import { createKavelServiceClient } from '@/lib/supabase/kavelServer'

const DEFAULT_PUBLISH_SITES = ['zwijsen.net', 'kavelarchitect.nl']
const KNOWN_SITES = new Set(['zwijsen.net', 'kavelarchitect.nl', 'brikxai.nl'])
const KNOWN_SOURCES = new Set<ListingSourceType>(['gmail_funda', 'openclaw', 'manual'])
const KNOWN_STATUSES = new Set<ListingStatus>(['pending', 'approved', 'published', 'skipped', 'error'])

export async function listKavelListings(filters: KavelListingFilters = {}): Promise<KavelListing[]> {
  const supabase = createKavelServiceClient()
  const { status = 'all', source = 'all', q, limit = 200 } = filters

  let query = supabase.from('listings').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status !== 'all') query = query.eq('ingest_status', status)
  if (source !== 'all') query = query.eq('source_type', source)

  const { data, error } = await query
  if (error) {
    if (isSchemaCacheMiss(error, 'listings')) {
      console.warn('Supabase schema cache mist tabel public.listings. Tijdelijk leeg resultaat gebruikt.')
      return []
    }
    throw new Error(`Kon listings niet laden: ${error.message}`)
  }

  let items = (data ?? []).map(mapListingRow)
  if (q?.trim()) {
    const needle = q.trim().toLowerCase()
    items = items.filter((item) => {
      const blob = [item.kavelId, item.adres, item.plaats, item.provincie, item.sourceUrl].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(needle)
    })
  }
  return items
}

export async function listKavelSyncJobs(limit = 40): Promise<KavelSyncJob[]> {
  const supabase = createKavelServiceClient()
  const { data, error } = await supabase.from('kavel_sync_jobs').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) {
    if (isSchemaCacheMiss(error, 'kavel_sync_jobs')) {
      console.warn('Supabase schema cache mist tabel public.kavel_sync_jobs. Tijdelijk leeg resultaat gebruikt.')
      return []
    }
    throw new Error(`Kon sync-jobs niet laden: ${error.message}`)
  }
  return (data ?? []).map(mapSyncJobRow)
}

export async function queueKavelSyncJob(input: {
  sourceType: 'gmail_funda' | 'openclaw'
  triggerType?: KavelSyncTriggerType
  note?: string | null
  requestedBy?: string | null
  metadata?: Record<string, unknown>
}) {
  const supabase = createKavelServiceClient()
  const basePayload = {
    source_type: input.sourceType,
    status: 'queued',
    trigger_type: input.triggerType ?? 'manual',
    note: normalizeOptionalText(input.note),
    metadata: input.metadata ?? {},
    updated_at: new Date().toISOString()
  }
  const firstPayload = { ...basePayload, requested_by: input.requestedBy ?? null }
  const firstInsert = await supabase.from('kavel_sync_jobs').insert(firstPayload).select('*').single()

  if (!firstInsert.error) {
    return mapSyncJobRow(firstInsert.data)
  }

  if (isRequestedByForeignKeyError(firstInsert.error)) {
    const retryPayload = {
      ...basePayload,
      requested_by: null,
      metadata: {
        ...(input.metadata ?? {}),
        requestedByFallback: input.requestedBy ?? null
      }
    }
    const secondInsert = await supabase.from('kavel_sync_jobs').insert(retryPayload).select('*').single()
    if (!secondInsert.error) {
      return mapSyncJobRow(secondInsert.data)
    }
    throw new Error(`Kon sync-job niet aanmaken: ${secondInsert.error.message}`)
  }

  throw new Error(`Kon sync-job niet aanmaken: ${firstInsert.error.message}`)
}

export async function setKavelSyncJobState(
  id: string,
  patch: {
    status?: KavelSyncJob['status']
    note?: string | null
    metadata?: Record<string, unknown>
    startedAt?: string | null
    finishedAt?: string | null
  }
) {
  const supabase = createKavelServiceClient()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status) payload.status = patch.status
  if (patch.note !== undefined) payload.note = normalizeOptionalText(patch.note)
  if (patch.metadata !== undefined) payload.metadata = patch.metadata
  if (patch.startedAt !== undefined) payload.started_at = patch.startedAt
  if (patch.finishedAt !== undefined) payload.finished_at = patch.finishedAt

  const { data, error } = await supabase.from('kavel_sync_jobs').update(payload).eq('id', id).select('*').maybeSingle()
  if (error) throw new Error(`Kon sync-job status niet aanpassen: ${error.message}`)
  return data ? mapSyncJobRow(data) : null
}

export async function createManualKavelListing(input: ManualKavelInput) {
  return upsertKavelListing({
    ...input,
    sourceType: input.sourceType ?? 'manual',
    ingestStatus: 'pending'
  })
}

export async function ingestKavelListing(input: IngestKavelInput) {
  return upsertKavelListing({
    ...input,
    sourceType: input.sourceType ?? 'openclaw',
    ingestStatus: input.ingestStatus ?? 'pending'
  })
}

export async function updateKavelListingStatus(id: string, ingestStatus: ListingStatus) {
  const supabase = createKavelServiceClient()
  const payload = {
    ingest_status: ingestStatus,
    updated_at: new Date().toISOString()
  }
  const withPublished = ingestStatus === 'published' ? { ...payload, published_at: new Date().toISOString() } : payload
  const { data, error } = await supabase.from('listings').update(withPublished).eq('id', id).select('*').maybeSingle()
  if (error) throw new Error(`Kon listing-status niet aanpassen: ${error.message}`)
  return data ? mapListingRow(data) : null
}

export async function getKavelListingById(id: string): Promise<KavelListing | null> {
  const supabase = createKavelServiceClient()
  const { data, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
  if (error) {
    if (isSchemaCacheMiss(error, 'listings')) return null
    throw new Error(`Kon listing niet laden: ${error.message}`)
  }
  return data ? mapListingRow(data) : null
}

export async function updateKavelListing(id: string, input: UpdateKavelListingInput): Promise<KavelListing | null> {
  const supabase = createKavelServiceClient()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.ingestStatus !== undefined) payload.ingest_status = normalizeListingStatus(input.ingestStatus)
  if (input.adres !== undefined) payload.adres = normalizeOptionalText(input.adres)
  if (input.postcode !== undefined) payload.postcode = normalizeOptionalText(input.postcode)
  if (input.plaats !== undefined) payload.plaats = normalizeOptionalText(input.plaats)
  if (input.provincie !== undefined) payload.provincie = normalizeOptionalText(input.provincie)
  if (input.prijs !== undefined) payload.prijs = normalizeNullableNumber(input.prijs)
  if (input.oppervlakte !== undefined) payload.oppervlakte = normalizeNullableNumber(input.oppervlakte)
  if (input.sourceUrl !== undefined) payload.source_url = normalizeOptionalText(input.sourceUrl)
  if (input.imageUrl !== undefined) payload.image_url = normalizeOptionalText(input.imageUrl)
  if (input.mapUrl !== undefined) payload.map_url = normalizeOptionalText(input.mapUrl)
  if (input.seoSummary !== undefined) payload.seo_summary = normalizeOptionalText(input.seoSummary)
  if (input.seoArticleHtml !== undefined) payload.seo_article_html = normalizeOptionalText(input.seoArticleHtml)
  if (input.seoSummaryKa !== undefined) payload.seo_summary_ka = normalizeOptionalText(input.seoSummaryKa)
  if (input.seoArticleHtmlKa !== undefined) payload.seo_article_html_ka = normalizeOptionalText(input.seoArticleHtmlKa)
  if (input.seoSummaryZw !== undefined) payload.seo_summary_zw = normalizeOptionalText(input.seoSummaryZw)
  if (input.seoArticleHtmlZw !== undefined) payload.seo_article_html_zw = normalizeOptionalText(input.seoArticleHtmlZw)
  if (input.specs !== undefined) payload.specs = input.specs
  if (input.publishedSites !== undefined) payload.published_sites = normalizePublishSites(input.publishedSites)

  const { data, error } = await supabase.from('listings').update(payload).eq('id', id).select('*').maybeSingle()
  if (error) throw new Error(`Kon listing niet opslaan: ${error.message}`)
  return data ? mapListingRow(data) : null
}

export async function regenerateKavelListingContent(id: string): Promise<KavelListing | null> {
  const listing = await getKavelListingById(id)
  if (!listing) return null

  const summaryKa = buildKavelArchitectSummary(listing)
  const articleKa = buildKavelArchitectArticle(listing)
  const summaryZw = summaryKa
  const articleZw = buildZwijsenArticle(listing)

  return updateKavelListing(id, {
    seoSummary: summaryKa,
    seoArticleHtml: articleKa,
    seoSummaryKa: summaryKa,
    seoArticleHtmlKa: articleKa,
    seoSummaryZw: summaryZw,
    seoArticleHtmlZw: articleZw
  })
}

export async function publishKavelListing(id: string, sites?: string[]): Promise<KavelPublishResult | null> {
  const supabase = createKavelServiceClient()
  const { data: rawListing, error: listingError } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
  if (listingError) throw new Error(`Kon listing niet laden: ${listingError.message}`)
  if (!rawListing) return null

  const listing = mapListingRow(rawListing)
  const publishSites = normalizePublishSites(sites)
  const slug = listingToKavelSlug(listing)
  const summaryKa = listing.seoSummaryKa?.trim() || buildKavelArchitectSummary(listing)
  const articleKa = listing.seoArticleHtmlKa?.trim() || buildKavelArchitectArticle(listing)
  const summaryZw = listing.seoSummaryZw?.trim() || summaryKa
  const articleZw = listing.seoArticleHtmlZw?.trim() || buildZwijsenArticle(listing)
  const now = new Date().toISOString()

  const kavelRow = {
    listing_id: listing.id,
    slug,
    title: `Bouwkavel ${listing.adres ?? listing.kavelId}, ${listing.plaats ?? 'Nederland'}`,
    excerpt: summaryZw,
    location: listing.plaats,
    region: listing.provincie,
    price: listing.prijs,
    area: listing.oppervlakte,
    status: 'beschikbaar',
    featured_image_url: listing.imageUrl ?? null,
    featured_image_alt: listing.adres ? `Bouwkavel ${listing.adres}, ${listing.plaats ?? ''}`.trim() : 'Bouwkavel',
    description: articleZw,
    source_url: listing.sourceUrl,
    published_sites: publishSites,
    published_at: now,
    updated_at: now,
    latitude: asNumber(listing.specs.lat),
    longitude: asNumber(listing.specs.lon),
    max_ridge_height: asNumber(listing.specs.nokhoogte),
    seo_article_html_zw: articleZw,
    seo_summary_zw: summaryZw,
    seo_article_html_ka: articleKa,
    seo_summary_ka: summaryKa
  }

  const { error: kavelError } = await supabase.from('kavels').upsert(kavelRow, { onConflict: 'slug' })
  if (kavelError) throw new Error(`Kon kavel niet publiceren: ${kavelError.message}`)

  const listingUpdate = {
    ingest_status: 'published',
    seo_summary: summaryKa,
    seo_article_html: articleKa,
    seo_summary_ka: summaryKa,
    seo_article_html_ka: articleKa,
    seo_summary_zw: summaryZw,
    seo_article_html_zw: articleZw,
    published_sites: publishSites,
    published_at: now,
    updated_at: now
  }
  const { error: updateError } = await supabase.from('listings').update(listingUpdate).eq('id', id)
  if (updateError) throw new Error(`Kavel gepubliceerd, maar listing-update mislukte: ${updateError.message}`)

  return {
    listingId: listing.id,
    slug,
    kavelId: listing.kavelId,
    publishedSites: publishSites,
    publishedUrls: publishSites.map((site) => toPublishedUrl(site, slug))
  }
}

export async function listKavelAlertSubscribers(limit = 200): Promise<KavelAlertSubscriber[]> {
  const supabase = createKavelServiceClient()
  const { data, error } = await supabase.from('kavel_alert_subscribers').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) {
    if (isSchemaCacheMiss(error, 'kavel_alert_subscribers')) {
      console.warn('Supabase schema cache mist tabel public.kavel_alert_subscribers. Tijdelijk leeg resultaat gebruikt.')
      return []
    }
    throw new Error(`Kon KavelAlert-inschrijvingen niet laden: ${error.message}`)
  }
  return (data ?? []).map(mapKavelAlertRow)
}

export async function upsertKavelAlertSubscriber(input: UpsertKavelAlertSubscriberInput) {
  const supabase = createKavelServiceClient()
  const email = input.email.trim().toLowerCase()
  if (!email || !email.includes('@')) throw new Error('Geldig e-mailadres is verplicht.')

  const payload = {
    email,
    naam: normalizeOptionalText(input.naam),
    telefoonnummer: normalizeOptionalText(input.telefoonnummer),
    status: normalizeKavelAlertStatus(input.status ?? 'actief'),
    provincies: normalizeProvinces(input.provincies),
    min_prijs: normalizeNullableNumber(input.minPrijs),
    max_prijs: normalizeNullableNumber(input.maxPrijs),
    min_oppervlakte: normalizeNullableNumber(input.minOppervlakte),
    bouwstijl: normalizeOptionalText(input.bouwstijl),
    tijdslijn: normalizeOptionalText(input.tijdslijn),
    bouwbudget: normalizeOptionalText(input.bouwbudget),
    kavel_type: normalizeOptionalText(input.kavelType),
    dienstverlening: normalizeOptionalText(input.dienstverlening) ?? 'zoek',
    early_access_rapport: Boolean(input.earlyAccessRapport),
    opmerkingen: normalizeOptionalText(input.opmerkingen),
    source: normalizeOptionalText(input.source) ?? 'dashboard',
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase.from('kavel_alert_subscribers').upsert(payload, { onConflict: 'email' }).select('*').single()
  if (error) throw new Error(`Kon KavelAlert-inschrijving niet opslaan: ${error.message}`)
  return mapKavelAlertRow(data)
}

export async function updateKavelAlertSubscriberStatus(id: string, status: KavelAlertStatus) {
  const supabase = createKavelServiceClient()
  const { data, error } = await supabase
    .from('kavel_alert_subscribers')
    .update({ status: normalizeKavelAlertStatus(status), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(`Kon subscriber-status niet aanpassen: ${error.message}`)
  return data ? mapKavelAlertRow(data) : null
}

async function upsertKavelListing(input: IngestKavelInput) {
  const supabase = createKavelServiceClient()
  const now = new Date().toISOString()
  const sourceType = normalizeSourceType(input.sourceType)
  const fundaId = normalizeOptionalText(input.fundaId)
  const sourceUrl = normalizeOptionalText(input.sourceUrl)
  const kavelId = normalizeOptionalText(input.kavelId) ?? createKavelId({ fundaId, sourceUrl, adres: input.adres, plaats: input.plaats })
  const ingestStatus = normalizeListingStatus(input.ingestStatus ?? 'pending')

  const payload = {
    kavel_id: kavelId,
    funda_id: fundaId,
    source_type: sourceType,
    ingest_status: ingestStatus,
    adres: normalizeOptionalText(input.adres),
    postcode: normalizeOptionalText(input.postcode),
    plaats: normalizeOptionalText(input.plaats),
    provincie: normalizeOptionalText(input.provincie),
    prijs: normalizeNullableNumber(input.prijs),
    oppervlakte: normalizeNullableNumber(input.oppervlakte),
    source_url: sourceUrl,
    image_url: normalizeOptionalText(input.imageUrl),
    map_url: normalizeOptionalText(input.mapUrl),
    specs: input.specs ?? {},
    updated_at: now
  }
  const { data, error } = await supabase.from('listings').upsert(payload, { onConflict: 'kavel_id' }).select('*').single()
  if (error) throw new Error(`Kon listing niet opslaan: ${error.message}`)
  return mapListingRow(data)
}

function mapListingRow(row: Record<string, unknown>): KavelListing {
  const derivedStatus = deriveListingStatus(row)

  return {
    id: asString(row.id) ?? randomUUID(),
    kavelId: asString(row.kavel_id) ?? `kavel-${randomUUID().slice(0, 8)}`,
    fundaId: asString(row.funda_id),
    sourceType: normalizeSourceType(row.source_type),
    ingestStatus: derivedStatus,
    adres: asString(row.adres),
    postcode: asString(row.postcode),
    plaats: asString(row.plaats),
    provincie: asString(row.provincie),
    prijs: asNumber(row.prijs),
    oppervlakte: asNumber(row.oppervlakte),
    sourceUrl: asString(row.source_url),
    imageUrl: asString(row.image_url),
    mapUrl: asString(row.map_url),
    specs: asRecord(row.specs),
    seoTitle: asString(row.seo_title),
    seoSummary: asString(row.seo_summary),
    seoArticleHtml: asString(row.seo_article_html),
    seoSummaryKa: asString(row.seo_summary_ka),
    seoArticleHtmlKa: asString(row.seo_article_html_ka),
    seoSummaryZw: asString(row.seo_summary_zw),
    seoArticleHtmlZw: asString(row.seo_article_html_zw),
    publishedSites: asStringArray(row.published_sites),
    publishedAt: asString(row.published_at),
    createdAt: asString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asString(row.updated_at) ?? asString(row.created_at) ?? new Date().toISOString()
  }
}

function mapSyncJobRow(row: Record<string, unknown>): KavelSyncJob {
  return {
    id: asString(row.id) ?? randomUUID(),
    sourceType: normalizeSyncSource(row.source_type),
    status: normalizeSyncStatus(row.status),
    triggerType: normalizeSyncTrigger(row.trigger_type),
    requestedBy: asString(row.requested_by),
    note: asString(row.note),
    metadata: asRecord(row.metadata),
    startedAt: asString(row.started_at),
    finishedAt: asString(row.finished_at),
    createdAt: asString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asString(row.updated_at) ?? asString(row.created_at) ?? new Date().toISOString()
  }
}

function mapKavelAlertRow(row: Record<string, unknown>): KavelAlertSubscriber {
  return {
    id: asString(row.id) ?? randomUUID(),
    email: asString(row.email) ?? '',
    naam: asString(row.naam),
    telefoonnummer: asString(row.telefoonnummer),
    status: normalizeKavelAlertStatus(row.status),
    provincies: asStringArray(row.provincies),
    minPrijs: asNumber(row.min_prijs),
    maxPrijs: asNumber(row.max_prijs),
    minOppervlakte: asNumber(row.min_oppervlakte),
    bouwstijl: asString(row.bouwstijl),
    tijdslijn: asString(row.tijdslijn),
    bouwbudget: asString(row.bouwbudget),
    kavelType: asString(row.kavel_type),
    dienstverlening: asString(row.dienstverlening),
    earlyAccessRapport: Boolean(row.early_access_rapport),
    opmerkingen: asString(row.opmerkingen),
    source: asString(row.source) ?? 'dashboard',
    createdAt: asString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asString(row.updated_at) ?? asString(row.created_at) ?? new Date().toISOString()
  }
}

function normalizeSourceType(value: unknown): ListingSourceType {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase() as ListingSourceType
    if (KNOWN_SOURCES.has(normalized)) return normalized
  }
  return 'manual'
}

function normalizeListingStatus(value: unknown): ListingStatus {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase() as ListingStatus
    if (KNOWN_STATUSES.has(normalized)) return normalized
  }
  return 'pending'
}

function deriveListingStatus(row: Record<string, unknown>): ListingStatus {
  const direct = normalizeListingStatus(row.ingest_status)
  if (direct !== 'pending') return direct

  const legacyStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : ''
  if (legacyStatus === 'published' || legacyStatus === 'gepubliceerd') return 'published'
  if (legacyStatus === 'approved' || legacyStatus === 'goedgekeurd') return 'approved'
  if (legacyStatus === 'skipped' || legacyStatus === 'rejected' || legacyStatus === 'afgekeurd') return 'skipped'

  if (asString(row.published_at)) return 'published'
  if (Array.isArray(row.published_sites) && row.published_sites.length > 0) return 'published'

  return 'pending'
}

function normalizeSyncSource(value: unknown): 'gmail_funda' | 'openclaw' {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'openclaw') return 'openclaw'
  }
  return 'gmail_funda'
}

function normalizeSyncStatus(value: unknown): KavelSyncJob['status'] {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'running' || normalized === 'success' || normalized === 'error') return normalized
  }
  return 'queued'
}

function normalizeSyncTrigger(value: unknown): KavelSyncTriggerType {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'cron' || normalized === 'webhook') return normalized
  }
  return 'manual'
}

function normalizeKavelAlertStatus(value: unknown): KavelAlertStatus {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'pauze' || normalized === 'uitgeschreven') return normalized
  }
  return 'actief'
}

function normalizePublishSites(sites: string[] | undefined) {
  const fromInput = (sites ?? [])
    .map((site) => site.trim().toLowerCase())
    .filter((site) => KNOWN_SITES.has(site))
  if (fromInput.length > 0) return Array.from(new Set(fromInput))
  return [...DEFAULT_PUBLISH_SITES]
}

function toPublishedUrl(site: string, slug: string) {
  if (site === 'zwijsen.net') return `https://www.zwijsen.net/aanbod/${slug}`
  if (site === 'kavelarchitect.nl') return `https://kavelarchitect.nl/aanbod/${slug}`
  return `https://${site}/aanbod/${slug}`
}

function createKavelId(input: { fundaId: string | null; sourceUrl: string | null; adres?: string | null; plaats?: string | null }) {
  if (input.fundaId) return input.fundaId
  const raw = [input.sourceUrl, input.adres, input.plaats, randomUUID()].filter(Boolean).join('|')
  return createHash('md5').update(raw).digest('hex').slice(0, 12)
}

function normalizeNullableNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null
  if (Number.isFinite(value)) return value
  return null
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeProvinces(values: string[] | undefined) {
  if (!Array.isArray(values)) return []
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .map((value) => value.toLowerCase())
    )
  )
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter((entry) => entry.length > 0)
}

function isSchemaCacheMiss(error: { message?: string; details?: string; hint?: string }, tableName: string) {
  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return message.includes('schema cache') && message.includes(tableName.toLowerCase())
}

function isRequestedByForeignKeyError(error: { message?: string; details?: string; hint?: string; code?: string }) {
  if (error.code === '23503') return true
  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return message.includes('requested_by_fkey') || (message.includes('foreign key') && message.includes('requested_by'))
}
