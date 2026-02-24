import { promises as fs } from 'fs'
import path from 'path'

interface PublishBrikxInput {
  id: string
  title: string
  summary: string | null
  body: string
  featuredImageUrl?: string | null
  featuredImageAlt?: string | null
  sourceType: string
  sourceUrl: string | null
}

export interface PublishBrikxResult {
  slug: string
  url: string
  filePath: string
}

const DEFAULT_REPO_PATH = process.platform === 'win32' ? 'E:\\brikx\\Brikxai\\brikx-wizard' : '/mnt/e/brikx/Brikxai/brikx-wizard'
const DEFAULT_FEATURED_IMAGE = '/images/hero-background.png'

export async function publishToBrikxNieuws(input: PublishBrikxInput): Promise<PublishBrikxResult> {
  const repoRoot = process.env.BRIKX_REPO_PATH?.trim() || DEFAULT_REPO_PATH
  const newsDir = path.join(repoRoot, 'lib', 'news')
  const itemsDir = path.join(newsDir, 'items')
  const indexFilePath = path.join(newsDir, 'index.ts')

  await ensureRepositoryReady(indexFilePath)
  await fs.mkdir(itemsDir, { recursive: true })

  const slug = createSlug(input.title, input.id)
  const variableName = `seoNieuws${toPascalCase(slug)}`
  const articleFilePath = path.join(itemsDir, `${slug}.ts`)
  const htmlBody = appendSourceLink(toHtmlContent(input.body), input.sourceUrl)
  const excerpt = buildExcerpt(input.summary, input.body)
  const category = mapCategory(input.sourceType)
  const publishedAt = new Date().toISOString().slice(0, 10)
  const featuredImageUrl = normalizeFeaturedImageUrl(input.featuredImageUrl)
  const featuredImageAlt = normalizeFeaturedImageAlt(input.featuredImageAlt, input.title)
  const articleContent = buildArticleFile({
    variableName,
    slug,
    title: input.title,
    excerpt,
    category,
    publishedAt,
    htmlBody,
    featuredImageUrl,
    featuredImageAlt
  })

  await fs.writeFile(articleFilePath, articleContent, 'utf8')
  await ensureIndexContainsArticle(indexFilePath, slug, variableName)

  return {
    slug,
    url: `https://www.brikxai.nl/nieuws/${slug}`,
    filePath: articleFilePath
  }
}

async function ensureRepositoryReady(indexFilePath: string) {
  try {
    await fs.access(indexFilePath)
  } catch {
    throw new Error(`Brikx repo niet gevonden op verwachte locatie: ${indexFilePath}`)
  }
}

function buildArticleFile({
  variableName,
  slug,
  title,
  excerpt,
  category,
  publishedAt,
  htmlBody,
  featuredImageUrl,
  featuredImageAlt
}: {
  variableName: string
  slug: string
  title: string
  excerpt: string
  category: 'markt' | 'regelgeving' | 'project' | 'bedrijf'
  publishedAt: string
  htmlBody: string
  featuredImageUrl: string
  featuredImageAlt: string
}) {
  const escapedTitle = escapeSingleQuoted(title)
  const escapedExcerpt = escapeSingleQuoted(excerpt)
  const escapedSlug = escapeSingleQuoted(slug)
  const escapedContent = indentBlock(escapeTemplateLiteral(htmlBody), 4)
  const escapedFeaturedImageUrl = escapeSingleQuoted(featuredImageUrl)
  const escapedFeaturedImageAlt = escapeSingleQuoted(featuredImageAlt)

  return [
    "import type { NieuwsItem } from '../types';",
    '',
    `export const ${variableName}: NieuwsItem = {`,
    `  slug: '${escapedSlug}',`,
    `  title: '${escapedTitle}',`,
    `  excerpt: '${escapedExcerpt}',`,
    `  publishedAt: '${publishedAt}',`,
    `  category: '${category}',`,
    '  featuredImage: {',
    `    url: '${escapedFeaturedImageUrl}',`,
    `    alt: '${escapedFeaturedImageAlt}',`,
    '  },',
    '  seo: {',
    `    title: '${escapedTitle} | Brikx nieuws',`,
    `    description: '${escapedExcerpt}',`,
    `    ogImage: '${escapedFeaturedImageUrl}',`,
    '  },',
    '  contentHtml: `',
    escapedContent,
    '  `,',
    '};',
    ''
  ].join('\n')
}

async function ensureIndexContainsArticle(indexFilePath: string, slug: string, variableName: string) {
  const source = await fs.readFile(indexFilePath, 'utf8')
  let next = source

  const importLine = `import { ${variableName} } from './items/${slug}'`
  if (!next.includes(`from './items/${slug}'`)) {
    const marker = '// Nieuwe items worden door het SEO dashboard bovenaan toegevoegd.'
    const markerIndex = next.indexOf(marker)
    const exportIndex = next.indexOf('export const NIEUWS_ITEMS')
    const insertionPoint = markerIndex >= 0 ? markerIndex : exportIndex

    if (insertionPoint < 0) {
      throw new Error('Kon lib/news/index.ts niet automatisch updaten: export NIEUWS_ITEMS ontbreekt.')
    }

    next = `${next.slice(0, insertionPoint)}${importLine}\n\n${next.slice(insertionPoint)}`
  }

  const exportPattern = /export const NIEUWS_ITEMS:\s*NieuwsItem\[\]\s*=\s*\[([\s\S]*?)\];/
  const match = next.match(exportPattern)
  if (!match) {
    throw new Error('Kon lib/news/index.ts niet automatisch updaten: array NIEUWS_ITEMS niet gevonden.')
  }

  const currentEntries = match[1]
  const hasEntry = new RegExp(`\\b${variableName}\\b`).test(currentEntries)
  if (!hasEntry) {
    const updatedEntries = `\n  ${variableName},${currentEntries}`
    const replacement = `export const NIEUWS_ITEMS: NieuwsItem[] = [${updatedEntries}\n];`
    next = next.replace(exportPattern, replacement)
  }

  if (next !== source) {
    await fs.writeFile(indexFilePath, next, 'utf8')
  }
}

function mapCategory(sourceType: string): 'markt' | 'regelgeving' | 'project' | 'bedrijf' {
  const value = sourceType.trim().toLowerCase()
  if (value === 'bedrijf' || value === 'manual' || value.includes('kantoor')) return 'bedrijf'
  if (value === 'kavel' || value.includes('project')) return 'project'
  if (value === 'regelgeving') return 'regelgeving'
  if (value.includes('regel') || value.includes('wet') || value.includes('beleid')) return 'regelgeving'
  if (value === 'markt') return 'markt'
  return 'markt'
}

function createSlug(title: string, id: string) {
  const slugBase = `${title}-${id.slice(0, 8)}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slugBase || `nieuws-${id.slice(0, 8).toLowerCase()}`
}

function toPascalCase(input: string) {
  return input
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join('')
}

function buildExcerpt(summary: string | null, body: string) {
  const base = summary?.trim() || stripMarkup(body).trim()
  return truncate(base || 'Actueel nieuwsbericht van Brikx.', 220)
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1).trimEnd()}...`
}

function stripMarkup(input: string) {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^-+\s+/gm, '')
    .replace(/\s+/g, ' ')
}

function toHtmlContent(input: string) {
  const raw = input.trim()
  if (!raw) return '<p>Artikeltekst ontbreekt.</p>'
  if (/<\/?[a-z][\s\S]*>/i.test(raw)) return raw

  const blocks: string[] = []
  const paragraphLines: string[] = []
  const listItems: string[] = []
  const lines = raw.replace(/\r/g, '').split('\n')

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return
    blocks.push(`<p>${paragraphLines.join(' ')}</p>`)
    paragraphLines.length = 0
  }

  const flushList = () => {
    if (listItems.length === 0) return
    blocks.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`)
    listItems.length = 0
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    if (trimmed.startsWith('- ')) {
      flushParagraph()
      listItems.push(escapeHtml(trimmed.slice(2)))
      continue
    }

    flushList()

    if (trimmed.startsWith('### ')) {
      flushParagraph()
      blocks.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`)
      continue
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph()
      blocks.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`)
      continue
    }
    if (trimmed.startsWith('# ')) {
      flushParagraph()
      blocks.push(`<h2>${escapeHtml(trimmed.slice(2))}</h2>`)
      continue
    }

    paragraphLines.push(escapeHtml(trimmed))
  }

  flushParagraph()
  flushList()

  if (blocks.length === 0) return `<p>${escapeHtml(raw)}</p>`
  return blocks.join('\n\n')
}

function appendSourceLink(contentHtml: string, sourceUrl: string | null) {
  const source = sourceUrl?.trim()
  if (!source) return contentHtml
  return `${contentHtml}\n\n<p><strong>Bron:</strong> <a href="${escapeHtmlAttribute(source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
    source
  )}</a></p>`
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeHtmlAttribute(input: string) {
  return escapeHtml(input).replace(/`/g, '&#96;')
}

function escapeSingleQuoted(input: string) {
  return input.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function escapeTemplateLiteral(input: string) {
  return input.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

function indentBlock(value: string, spaces: number) {
  const prefix = ' '.repeat(spaces)
  return value
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n')
}

function normalizeFeaturedImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_FEATURED_IMAGE
  return trimmed
}

function normalizeFeaturedImageAlt(value: string | null | undefined, fallbackTitle: string) {
  const trimmed = value?.trim()
  if (!trimmed) return fallbackTitle
  return trimmed
}
