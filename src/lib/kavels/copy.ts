import type { KavelListing } from '@/lib/kavels/types'

export function listingToKavelSlug(listing: Pick<KavelListing, 'kavelId' | 'adres' | 'plaats'>) {
  const base = `${listing.adres ?? ''}-${listing.plaats ?? ''}-${listing.kavelId}`
  return (
    `bouwkavel-${base}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-') || `bouwkavel-${listing.kavelId.toLowerCase()}`
  )
}

export function buildKavelArchitectSummary(listing: KavelListing) {
  const plaats = escapeHtml(listing.plaats ?? 'Nederland')
  const prijs = formatCurrency(listing.prijs)
  const oppervlakte = formatSqm(listing.oppervlakte)
  return `Bouwkavel in ${plaats} met een vraagprijs van ${prijs}. Totale oppervlakte: ${oppervlakte}.`
}

export function buildKavelArchitectArticle(listing: KavelListing) {
  const adres = escapeHtml(listing.adres ?? 'Onbekende locatie')
  const plaats = escapeHtml(listing.plaats ?? 'Onbekend')
  const provincie = escapeHtml(listing.provincie ?? 'Onbekend')
  const prijs = formatCurrency(listing.prijs)
  const oppervlakte = formatSqm(listing.oppervlakte)
  const specsLines = getSpecsLines(listing)
  const sourceLink = buildSourceLink(listing.sourceUrl)

  return `
<h2>Bouwkavel ${adres}, ${plaats}</h2>
<p>Deze kavel ligt in ${plaats} (${provincie}) en is een interessante optie voor nieuwbouw.</p>
<ul>
  <li><strong>Vraagprijs:</strong> ${prijs}</li>
  <li><strong>Oppervlakte:</strong> ${oppervlakte}</li>
</ul>
${specsLines}
${sourceLink}
<p>Wil je weten wat hier bouwkundig en planologisch mogelijk is? Bekijk het <a href="https://kavelarchitect.nl/kavelrapport">KavelRapport</a>.</p>
`.trim()
}

export function buildZwijsenArticle(listing: KavelListing) {
  const adres = escapeHtml(listing.adres ?? 'Onbekende locatie')
  const plaats = escapeHtml(listing.plaats ?? 'Onbekend')
  const provincie = escapeHtml(listing.provincie ?? 'Onbekend')
  const prijs = formatCurrency(listing.prijs)
  const oppervlakte = formatSqm(listing.oppervlakte)
  const specsLines = getSpecsLines(listing)
  const sourceLink = buildSourceLink(listing.sourceUrl)

  return `
<h2>Ontwikkelkans: bouwkavel in ${plaats}</h2>
<p>Voor locatie ${adres} in ${provincie} is deze kavel beschikbaar voor nieuwbouwontwikkeling.</p>
<ul>
  <li><strong>Vraagprijs:</strong> ${prijs}</li>
  <li><strong>Kaveloppervlakte:</strong> ${oppervlakte}</li>
</ul>
${specsLines}
${sourceLink}
<p>Meer context over ontwerpen en vergunningen vind je op <a href="https://www.zwijsen.net">zwijsen.net</a> en op <a href="https://kavelarchitect.nl/kavelrapport">kavelarchitect.nl/kavelrapport</a>.</p>
`.trim()
}

function getSpecsLines(listing: KavelListing) {
  const specs = listing.specs ?? {}
  const lines: string[] = []

  const lat = asNumber(specs.lat)
  const lon = asNumber(specs.lon)
  const nokhoogte = asNumber(specs.nokhoogte)

  if (lat !== null && lon !== null) {
    lines.push(`<li><strong>Coordinaten:</strong> ${lat}, ${lon}</li>`)
  }
  if (nokhoogte !== null) {
    lines.push(`<li><strong>Indicatieve nokhoogte:</strong> ${nokhoogte} m</li>`)
  }
  if (lines.length === 0) return ''

  return `<h3>Beschikbare data</h3><ul>${lines.join('')}</ul>`
}

function buildSourceLink(sourceUrl: string | null) {
  if (!sourceUrl?.trim()) return ''
  const safeSource = escapeHtml(sourceUrl.trim())
  return `<p><strong>Bron:</strong> <a href="${safeSource}" target="_blank" rel="noopener noreferrer">${safeSource}</a></p>`
}

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return 'onbekend'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function formatSqm(value: number | null) {
  if (value === null || Number.isNaN(value)) return 'onbekend'
  return `${new Intl.NumberFormat('nl-NL').format(value)} m2`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim()
    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

