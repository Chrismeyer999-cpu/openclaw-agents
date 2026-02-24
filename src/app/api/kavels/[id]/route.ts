import { getKavelListingById, publishKavelListing, regenerateKavelListingContent, updateKavelListing, updateKavelListingStatus } from '@/lib/kavels'
import type { ListingStatus } from '@/lib/kavels/types'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_ACTIONS = new Set(['regenerate', 'publish', 'set_status'])
const ALLOWED_STATUSES = new Set<ListingStatus>(['pending', 'approved', 'published', 'skipped', 'error'])

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  try {
    const listing = await getKavelListingById(id)
    if (!listing) return NextResponse.json({ error: 'Listing niet gevonden' }, { status: 404 })
    return NextResponse.json(listing)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const body = (await request.json().catch(() => null)) as
    | {
        ingest_status?: ListingStatus
        adres?: string | null
        postcode?: string | null
        plaats?: string | null
        provincie?: string | null
        prijs?: number | string | null
        oppervlakte?: number | string | null
        source_url?: string | null
        image_url?: string | null
        map_url?: string | null
        seo_summary?: string | null
        seo_article_html?: string | null
        seo_summary_ka?: string | null
        seo_article_html_ka?: string | null
        seo_summary_zw?: string | null
        seo_article_html_zw?: string | null
        specs?: Record<string, unknown>
        published_sites?: string[]
      }
    | null

  try {
    const listing = await updateKavelListing(id, {
      ingestStatus: body?.ingest_status,
      adres: asOptionalString(body?.adres),
      postcode: asOptionalString(body?.postcode),
      plaats: asOptionalString(body?.plaats),
      provincie: asOptionalString(body?.provincie),
      prijs: normalizeNumber(body?.prijs),
      oppervlakte: normalizeNumber(body?.oppervlakte),
      sourceUrl: asOptionalString(body?.source_url),
      imageUrl: asOptionalString(body?.image_url),
      mapUrl: asOptionalString(body?.map_url),
      seoSummary: asOptionalString(body?.seo_summary),
      seoArticleHtml: asOptionalString(body?.seo_article_html),
      seoSummaryKa: asOptionalString(body?.seo_summary_ka),
      seoArticleHtmlKa: asOptionalString(body?.seo_article_html_ka),
      seoSummaryZw: asOptionalString(body?.seo_summary_zw),
      seoArticleHtmlZw: asOptionalString(body?.seo_article_html_zw),
      specs: isRecord(body?.specs) ? body.specs : undefined,
      publishedSites: Array.isArray(body?.published_sites) ? body.published_sites : undefined
    })
    if (!listing) return NextResponse.json({ error: 'Listing niet gevonden' }, { status: 404 })
    return NextResponse.json(listing)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const body = (await request.json().catch(() => null)) as { action?: string; status?: ListingStatus; sites?: string[] } | null
  const action = body?.action ?? ''
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Ongeldige of ontbrekende action' }, { status: 400 })
  }

  try {
    if (action === 'regenerate') {
      const updated = await regenerateKavelListingContent(id)
      if (!updated) return NextResponse.json({ error: 'Listing niet gevonden' }, { status: 404 })
      return NextResponse.json(updated)
    }
    if (action === 'set_status') {
      if (!body?.status || !ALLOWED_STATUSES.has(body.status)) {
        return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 })
      }
      const updated = await updateKavelListingStatus(id, body.status)
      if (!updated) return NextResponse.json({ error: 'Listing niet gevonden' }, { status: 404 })
      return NextResponse.json(updated)
    }

    const published = await publishKavelListing(id, Array.isArray(body?.sites) ? body.sites : undefined)
    if (!published) return NextResponse.json({ error: 'Listing niet gevonden' }, { status: 404 })
    return NextResponse.json(published)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asOptionalString(value: unknown) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

