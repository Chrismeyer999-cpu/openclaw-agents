interface DraftInput {
  title: string
  summary: string | null
  sourceUrl: string | null
  site: string
}

export function createDraftArticleBody({ title, summary, sourceUrl, site }: DraftInput) {
  const intro = summary?.trim() || `Dit artikel gaat over: ${title}.`
  const today = new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())

  const lines = [
    `# ${title}`,
    '',
    intro,
    '',
    '## Wat is er gebeurd?',
    'Beschrijf hier kort en feitelijk het nieuwsitem. Voeg de belangrijkste context toe voor lezers.',
    '',
    `## Waarom is dit relevant voor ${site}?`,
    'Leg uit wat dit betekent voor opdrachtgevers, bewoners of ontwikkelaars.',
    '',
    '## Praktische aandachtspunten',
    '- Benoem 2 tot 4 concrete aandachtspunten.',
    '- Houd het praktisch en vermijd marketingtaal.',
    '',
    `Laatst bijgewerkt: ${today}.`
  ]

  if (sourceUrl?.trim()) {
    lines.push('', `Bron: ${sourceUrl.trim()}`)
  }

  return lines.join('\n')
}

