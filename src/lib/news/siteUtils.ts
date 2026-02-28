const KNOWN_SITES = ['kavelarchitect.nl', 'zwijsen.net', 'brikxai.nl']

export function inferSiteFromText(parts: Array<string | null | undefined>) {
  const text = parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const site of KNOWN_SITES) {
    if (text.includes(site)) {
      return site
    }
  }

  if (text.includes('kavel')) return 'kavelarchitect.nl'
  if (text.includes('zwijsen') || text.includes('jules') || text.includes('architectuur') || text.includes('villa') || text.includes('houtbouw') || text.includes('generative')) return 'zwijsen.net'

  // Default to brikxai for construction/tech law/news since it's the catch-all
  return 'brikxai.nl'
}

export const NEWS_SITES = KNOWN_SITES
