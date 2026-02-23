export interface WorkspaceRow {
  id: string
  domain: string
  displayName: string
}

export interface WorkspaceStat extends WorkspaceRow {
  pages: number
  pagesWithSchema: number
  clicks30d: number
  mentions30d: number
  pendingNieuws: number
}

export interface OverviewData {
  totalClicks30d: number
  totalMentions30d: number
  structuredCoverage: number
  pendingNieuws: number
  workspaceStats: WorkspaceStat[]
  topPages: { id: string; title: string; url: string; domain: string; clicks30d: number }[]
  pendingItems: { id: string; title: string; domain: string; created_at: string }[]
}
