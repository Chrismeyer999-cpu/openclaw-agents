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
  if (text.includes('zwijsen') || text.includes('jules')) return 'zwijsen.net'
  if (text.includes('brikx') || text.includes('dso') || text.includes('omgevingswet')) return 'brikxai.nl'

  return 'extern'
}

export const NEWS_SITES = KNOWN_SITES
