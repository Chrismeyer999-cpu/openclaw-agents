export type ListingSourceType = 'gmail_funda' | 'openclaw' | 'manual'
export type ListingStatus = 'pending' | 'approved' | 'published' | 'skipped' | 'error'
export type KavelAlertStatus = 'actief' | 'pauze' | 'uitgeschreven'
export type KavelSyncStatus = 'queued' | 'running' | 'success' | 'error'
export type KavelSyncTriggerType = 'manual' | 'cron' | 'webhook'

export interface KavelListing {
  id: string
  kavelId: string
  fundaId: string | null
  sourceType: ListingSourceType
  ingestStatus: ListingStatus
  adres: string | null
  postcode: string | null
  plaats: string | null
  provincie: string | null
  prijs: number | null
  oppervlakte: number | null
  sourceUrl: string | null
  imageUrl: string | null
  mapUrl: string | null
  specs: Record<string, unknown>
  seoTitle: string | null
  seoSummary: string | null
  seoArticleHtml: string | null
  seoSummaryKa: string | null
  seoArticleHtmlKa: string | null
  seoSummaryZw: string | null
  seoArticleHtmlZw: string | null
  publishedSites: string[]
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface KavelListingFilters {
  status?: ListingStatus | 'all'
  source?: ListingSourceType | 'all'
  q?: string
  limit?: number
}

export interface ManualKavelInput {
  fundaId?: string | null
  sourceType?: ListingSourceType
  sourceUrl?: string | null
  adres?: string | null
  postcode?: string | null
  plaats?: string | null
  provincie?: string | null
  prijs?: number | null
  oppervlakte?: number | null
  imageUrl?: string | null
  mapUrl?: string | null
  specs?: Record<string, unknown>
}

export interface IngestKavelInput extends ManualKavelInput {
  kavelId?: string | null
  ingestStatus?: ListingStatus
}

export interface UpdateKavelListingInput {
  ingestStatus?: ListingStatus
  adres?: string | null
  postcode?: string | null
  plaats?: string | null
  provincie?: string | null
  prijs?: number | null
  oppervlakte?: number | null
  sourceUrl?: string | null
  imageUrl?: string | null
  mapUrl?: string | null
  seoSummary?: string | null
  seoArticleHtml?: string | null
  seoSummaryKa?: string | null
  seoArticleHtmlKa?: string | null
  seoSummaryZw?: string | null
  seoArticleHtmlZw?: string | null
  publishedSites?: string[]
  specs?: Record<string, unknown>
}

export interface KavelPublishResult {
  listingId: string
  slug: string
  kavelId: string
  publishedSites: string[]
  publishedUrls: string[]
}

export interface KavelAlertSubscriber {
  id: string
  email: string
  naam: string | null
  telefoonnummer: string | null
  status: KavelAlertStatus
  provincies: string[]
  minPrijs: number | null
  maxPrijs: number | null
  minOppervlakte: number | null
  bouwstijl: string | null
  tijdslijn: string | null
  bouwbudget: string | null
  kavelType: string | null
  dienstverlening: string | null
  earlyAccessRapport: boolean
  opmerkingen: string | null
  source: string
  createdAt: string
  updatedAt: string
}

export interface UpsertKavelAlertSubscriberInput {
  email: string
  naam?: string | null
  telefoonnummer?: string | null
  status?: KavelAlertStatus
  provincies?: string[]
  minPrijs?: number | null
  maxPrijs?: number | null
  minOppervlakte?: number | null
  bouwstijl?: string | null
  tijdslijn?: string | null
  bouwbudget?: string | null
  kavelType?: string | null
  dienstverlening?: string | null
  earlyAccessRapport?: boolean
  opmerkingen?: string | null
  source?: string
}

export interface KavelSyncJob {
  id: string
  sourceType: 'gmail_funda' | 'openclaw'
  status: KavelSyncStatus
  triggerType: KavelSyncTriggerType
  requestedBy: string | null
  note: string | null
  metadata: Record<string, unknown>
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}
