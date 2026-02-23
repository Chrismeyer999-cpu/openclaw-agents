import { promises as fs } from 'fs'
import path from 'path'

interface PublishZwijsenInput {
  id: string
  title: string
  summary: string | null
  body: string
  sourceType: string
  sourceUrl: string | null
}

export interface PublishZwijsenResult {
  slug: string
  url: string
  filePath: string
}

const DEFAULT_REPO_PATH = process.platform === 'win32' ? 'E:\\zwijsen' : '/mnt/e/zwijsen'
const DEFAULT_FEATURED_IMAGE = '/images/og-nieuws.jpg'

export async function publishToZwijsenNieuws(input: PublishZwijsenInput): Promise<PublishZwijsenResult> {
  const repoRoot = process.env.ZWIJSEN_REPO_PATH?.trim() || DEFAULT_REPO_PATH
  const dataDir = path.join(repoRoot, 'data', 'actueel')
  const indexFilePath = path.join(dataDir, 'index.ts')

  await ensureRepositoryReady(indexFilePath)

  const slug = createSlug(input.title, input.id)
  const variableName = `seoNieuws${toPascalCase(slug)}`
  const articleFilePath = path.join(dataDir, `${slug}.ts`)
  const htmlBody = appendSourceLink(toHtmlContent(input.body), input.sourceUrl)
  const excerpt = buildExcerpt(input.summary, input.body)
  const category = mapCategory(input.sourceType)
  const publishedAt = new Date().toISOString().slice(0, 10)
  const articleContent = buildArticleFile({
    variableName,
    slug,
    title: input.title,
    excerpt,
    category,
    publishedAt,
    htmlBody
  })

  await fs.writeFile(articleFilePath, articleContent, 'utf8')
  await ensureIndexContainsArticle(indexFilePath, slug, variableName)

  return {
    slug,
    url: `https://www.zwijsen.net/actueel/${slug}`,
    filePath: articleFilePath
  }
}

async function ensureRepositoryReady(indexFilePath: string) {
  try {
    await fs.access(indexFilePath)
  } catch {
    throw new Error(`Zwijsen repo niet gevonden op verwachte locatie: ${indexFilePath}`)
  }
}

function buildArticleFile({
  variableName,
  slug,
  title,
  excerpt,
  category,
  publishedAt,
  htmlBody
}: {
  variableName: string
  slug: string
  title: string
  excerpt: string
  category: 'project' | 'kantoor' | 'publicatie' | 'event'
  publishedAt: string
  htmlBody: string
}) {
  const escapedTitle = escapeSingleQuoted(title)
  const escapedExcerpt = escapeSingleQuoted(excerpt)
  const escapedSlug = escapeSingleQuoted(slug)
  const escapedContent = indentBlock(escapeTemplateLiteral(htmlBody), 4)

  return [
    "import type { NieuwsBericht } from '../types';",
    '',
    `export const ${variableName}: NieuwsBericht = {`,
    `  slug: '${escapedSlug}',`,
    `  title: '${escapedTitle}',`,
    `  excerpt: '${escapedExcerpt}',`,
    `  publishedAt: '${publishedAt}',`,
    `  category: '${category}',`,
    "  openMode: 'page',",
    '  seo: {',
    `    title: '${escapedTitle} | Architectenbureau Jules Zwijsen',`,
    `    description: '${escapedExcerpt}',`,
    `    ogImage: '${DEFAULT_FEATURED_IMAGE}',`,
    '  },',
    '  featuredImage: {',
    `    url: '${DEFAULT_FEATURED_IMAGE}',`,
    `    alt: '${escapedTitle}',`,
    '  },',
    '  content: `',
    escapedContent,
    '  `,',
    "  author: 'SEO Dashboard',",
    '};',
    ''
  ].join('\n')
}

async function ensureIndexContainsArticle(indexFilePath: string, slug: string, variableName: string) {
  const source = await fs.readFile(indexFilePath, 'utf8')
  let next = source

  const importLine = `import { ${variableName} } from './${slug}';`
  if (!next.includes(`from './${slug}'`)) {
    const marker = '// Export alle berichten als array (nieuwste eerst)'
    const markerIndex = next.indexOf(marker)
    const exportIndex = next.indexOf('export const NIEUWS_BERICHTEN')
    const insertionPoint = markerIndex >= 0 ? markerIndex : exportIndex

    if (insertionPoint < 0) {
      throw new Error('Kon data/actueel/index.ts niet automatisch updaten: export NIEUWS_BERICHTEN ontbreekt.')
    }

    next = `${next.slice(0, insertionPoint)}${importLine}\n\n${next.slice(insertionPoint)}`
  }

  const exportPattern = /export const NIEUWS_BERICHTEN:\s*NieuwsBericht\[\]\s*=\s*\[([\s\S]*?)\];/
  const match = next.match(exportPattern)
  if (!match) {
    throw new Error('Kon data/actueel/index.ts niet automatisch updaten: array NIEUWS_BERICHTEN niet gevonden.')
  }

  const currentEntries = match[1]
  const hasEntry = new RegExp(`\\b${variableName}\\b`).test(currentEntries)
  if (!hasEntry) {
    const updatedEntries = `\n  ${variableName},${currentEntries}`
    const replacement = `export const NIEUWS_BERICHTEN: NieuwsBericht[] = [${updatedEntries}\n];`
    next = next.replace(exportPattern, replacement)
  }

  if (next !== source) {
    await fs.writeFile(indexFilePath, next, 'utf8')
  }
}

function mapCategory(sourceType: string): 'project' | 'kantoor' | 'publicatie' | 'event' {
  if (sourceType === 'kavel') return 'project'
  if (sourceType === 'manual') return 'kantoor'
  return 'publicatie'
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
  return truncate(base || 'Actueel nieuwsbericht van Architectenbureau Jules Zwijsen.', 220)
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1).trimEnd()}…`
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

