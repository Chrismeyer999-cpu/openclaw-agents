export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'published'
export type NewsSourceMode = 'seo' | 'agent'

export interface NewsFilters {
  workspaceDomain?: string | null
  status?: string | null
  source?: string | null
  q?: string | null
  limit?: number
}

export interface UnifiedNewsItem {
  id: string
  title: string
  summary: string | null
  body: string | null
  featuredImageUrl: string | null
  featuredImageAlt: string | null
  sourceUrl: string | null
  sourceType: string
  reviewStatus: ReviewStatus
  createdAt: string
  publishedAt: string | null
  site: string
  origin: NewsSourceMode
}
