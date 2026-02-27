/**
 * POST /api/nieuws/image/generate
 *
 * Genereert een passende afbeelding bij een nieuwsartikel via DALL-E 3
 * en slaat het op in de lokale site-repo (zelfde locatie als manuele uploads).
 *
 * Body: { title, summary?, site, article_body? }
 * Response: { url, alt, prompt }
 */

import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

// ─── Site-specifieke stijl voor beeldprompt ───────────────────────────────────

function buildSiteVisualStyle(site: string): string {
  const normalized = site.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')

  if (normalized === 'zwijsen.net') {
    return 'architectural photography style, high-end residential architecture, clean modernist lines, soft natural light, no people, no text, premium aesthetic, white and warm tones'
  }
  if (normalized === 'brikxai.nl') {
    return 'modern construction site or renovation detail, practical and clean, Dutch residential building context, no people, no text, professional real-estate photography style'
  }
  if (normalized === 'kavelarchitect.nl') {
    return 'aerial or ground-level view of buildable land plot in Dutch suburban area, Gooi or Vechtstreek landscape, clear sky, open space, no people, no text, realistic photography style'
  }
  return 'modern Dutch architecture or construction, clean professional photography, no people, no text'
}

// ─── Bouw een DALL-E prompt op basis van artikelinhoud ────────────────────────

function buildImagePrompt(title: string, summary: string | null, site: string): string {
  const style = buildSiteVisualStyle(site)
  const subject = (summary?.slice(0, 200) ?? title).trim()

  return [
    `Realistic photograph illustrating: "${subject}".`,
    style,
    'Wide format, 16:9 aspect ratio, no watermarks, no logos, photorealistic.'
  ].join(' ')
}

// ─── Genereer afbeelding via DALL-E 3 ─────────────────────────────────────────

interface DalleResponse {
  data?: Array<{ url?: string; b64_json?: string }>
  error?: { message?: string }
}

async function generateWithDallE3(prompt: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY niet geconfigureerd')

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      response_format: 'b64_json',
      quality: 'standard'
    })
  })

  const data = (await response.json()) as DalleResponse
  if (!response.ok) {
    throw new Error(data.error?.message ?? `DALL-E mislukt met status ${response.status}`)
  }

  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('DALL-E gaf geen afbeeldingsdata terug.')
  return Buffer.from(b64, 'base64')
}

// ─── Sla gegenereerde afbeelding op in lokale site-repo ──────────────────────

const SITE_REPO_PATHS: Record<string, { envKey: string; defaultPath: string; pathParts: string[] }> = {
  'zwijsen.net': {
    envKey: 'ZWIJSEN_REPO_PATH',
    defaultPath: process.platform === 'win32' ? 'E:\\zwijsen' : '/mnt/e/zwijsen',
    pathParts: ['images', 'actueel']
  },
  'brikxai.nl': {
    envKey: 'BRIKX_REPO_PATH',
    defaultPath: process.platform === 'win32' ? 'E:\\brikx\\Brikxai\\brikx-wizard' : '/mnt/e/brikx/Brikxai/brikx-wizard',
    pathParts: ['images', 'nieuws']
  },
  'kavelarchitect.nl': {
    envKey: 'KAVELARCHITECT_REPO_PATH',
    defaultPath: process.platform === 'win32' ? 'E:\\Funda Wordpress' : '/mnt/e/Funda Wordpress',
    pathParts: ['images', 'nieuws']
  }
}

function normalizeSite(siteInput: string): string {
  return siteInput
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

async function saveImageToRepo(imageBuffer: Buffer, site: string, titleSlug: string): Promise<string> {
  const normalized = normalizeSite(site)
  const config = SITE_REPO_PATHS[normalized]
  if (!config) throw new Error(`Opslaan voor site '${normalized}' wordt niet ondersteund.`)

  const repoRoot = process.env[config.envKey]?.trim() || config.defaultPath
  const today = new Date()
  const year = String(today.getFullYear())
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const targetDir = path.join(repoRoot, 'public', ...config.pathParts, year, month)
  const finalName = `${Date.now()}-ai-${titleSlug.slice(0, 40)}-${randomUUID().slice(0, 8)}.png`
  const absolutePath = path.join(targetDir, finalName)
  const publicUrl = `/${config.pathParts.join('/')}/${year}/${month}/${finalName}`

  await fs.mkdir(targetDir, { recursive: true })
  await fs.writeFile(absolutePath, imageBuffer)

  return publicUrl
}

// ─── Alt-tekst op basis van titel + site ─────────────────────────────────────

function buildAltText(title: string, site: string): string {
  const normalized = normalizeSite(site)
  const prefix =
    normalized === 'zwijsen.net'
      ? 'Architectuur ― '
      : normalized === 'brikxai.nl'
      ? 'Bouwnieuws ― '
      : normalized === 'kavelarchitect.nl'
      ? 'Kavelnieuws ― '
      : ''
  return `${prefix}${title}`.slice(0, 125)
}

function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Route handler ────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as {
    title?: string
    summary?: string | null
    site?: string
    article_body?: string | null
  } | null

  if (!body?.title?.trim()) {
    return NextResponse.json({ error: 'title is verplicht' }, { status: 400 })
  }
  if (!body?.site?.trim()) {
    return NextResponse.json({ error: 'site is verplicht' }, { status: 400 })
  }

  const title = body.title.trim()
  const summary = body.summary?.trim() ?? null
  const site = body.site.trim()
  const prompt = buildImagePrompt(title, summary, site)
  const alt = buildAltText(title, site)
  const titleSlug = toSlug(title)

  if (!process.env.OPENAI_API_KEY?.trim()) {
    // Geen API key: stuur de prompt terug zodat de gebruiker hem handmatig kan gebruiken
    return NextResponse.json({
      url: null,
      alt,
      prompt,
      message: 'Geen OPENAI_API_KEY gevonden. Gebruik de prompt hieronder in DALL-E of Midjourney.'
    })
  }

  try {
    const imageBuffer = await generateWithDallE3(prompt)
    const url = await saveImageToRepo(imageBuffer, site, titleSlug)

    return NextResponse.json({ url, alt, prompt })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout bij beeldgeneratie'
    return NextResponse.json({ error: message, prompt }, { status: 500 })
  }
}
