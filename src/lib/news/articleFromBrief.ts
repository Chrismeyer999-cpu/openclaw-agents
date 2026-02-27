interface GenerateArticleFromBriefInput {
  title: string
  summary: string | null
  sourceUrl: string | null
  site: string
  brief: string
  imageUrl: string | null
  imageAlt: string | null
  imageNote: string | null
}

interface GenerateArticleFromBriefResult {
  body: string
  mode: 'ai' | 'template'
}

// ─── Site-specifieke redactie-instructies (conform EDITORIAL_STYLE_GUIDE.md) ───

function buildSiteInstructions(site: string): string {
  const normalized = site.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')

  if (normalized === 'zwijsen.net') {
    return `
Schrijf voor zwijsen.net (Architectenbureau Jules Zwijsen):
- Tone: deskundig, persoonlijk, high-end architectuurbureau
- Spreek de lezer ALTIJD aan met "u" (nooit "je" of "jij")
- Korte stellige zinnen, eerlijke nuance, projectcontext
- Doelgroep: particuliere opdrachtgevers, hoog segment, woningbouw Gooi/Vechtstreek/Almere
- Lengte: 600-900 woorden (uitgebreide uitwerking)
- Focus op trend/duiding/AI-workflow met een concrete praktijkles voor architecten
`.trim()
  }

  if (normalized === 'brikxai.nl') {
    return `
Schrijf voor brikxai.nl (BrikxAI bouwassistent):
- Tone: direct, praktisch, resultaatgericht — gebruik geen "u", schrijf in "je" of in derde persoon
- Concreet over uren, kosten en impact; geen vaag AI-jargon zonder praktische vertaling
- Doelgroep: particuliere bouwheren en verbouwers die willen weten wat het kost en hoe het werkt
- Focus: regelgeving (Omgevingswet, Wkb), bouwkosten, subsidies, vergunningsvrij bouwen
- Lengte: 600-900 woorden
`.trim()
  }

  if (normalized === 'kavelarchitect.nl') {
    return `
Schrijf voor kavelarchitect.nl (Kavelarchitect feasibility platform):
- Tone: zakelijk maar niet kil, feitelijk en kansgericht — gebruik geen "u", schrijf in "je" of derde persoon
- Locatie- en regelgericht: bestemmingsplan, kavel, kansen benoemen maar realistisch
- Doelgroep: kavelbezitters en bouwgrond-kopers in Gooi, Vechtstreek en Almere
- Focus: kavelkansen, planologie, gebiedsontwikkeling, locatie-impact
- Lengte: 600-900 woorden
`.trim()
  }

  return `Schrijf zakelijk en feitelijk in het Nederlands. Lengte: 600-900 woorden.`
}

// ─── Verplichte artikelstructuur (conform EDITORIAL_STYLE_GUIDE.md §2) ─────────

function buildStructureRequirements(): string {
  return `
Verplichte artikelstructuur (volg deze volgorde exact):
1. Intro — waarom is dit NU relevant? (2-3 zinnen, directe haak, geen opsomming)
2. Kern — 3-5 inhoudelijke alinea's of bullets met de feiten en context
3. ## Wat betekent dit voor jou? — concrete praktijkvertaling voor de doelgroep
4. ## Veelgestelde vragen — 2-4 echte lezersvragen met concrete antwoorden
5. ## Bronnen — bron-URL en eventuele extra referenties

Verboden in alle artikelen:
- Clickbait-koppen
- Holle claims zonder bron ("revolutionair", "baanbrekend", "ongekend")
- Absolute beloftes over planning of budget
- Vaag AI-jargon zonder praktische vertaling
- Meer dan 1 exclamatiesteken in het gehele artikel
`.trim()
}

// ─── Claude API aanroep ────────────────────────────────────────────────────────

interface AnthropicMessage {
  content: Array<{ type: string; text?: string }>
}

async function callClaudeApi(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY niet geconfigureerd')

  // Gebruik Haiku voor artikelconcepten (snel + goedkoop), Sonnet voor uitgebreide versies
  const model = process.env.CLAUDE_ARTICLE_MODEL?.trim() || 'claude-sonnet-4-5-20250929'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.4,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  })

  if (!response.ok) {
    throw new Error(`Claude API mislukt met status ${response.status}`)
  }

  const data = (await response.json()) as AnthropicMessage
  const text = data.content?.[0]?.text?.trim()
  if (!text) throw new Error('Claude gaf geen artikeltekst terug.')
  return text
}

// ─── OpenAI fallback ───────────────────────────────────────────────────────────

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>
}

async function callOpenAIApi(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY niet geconfigureerd')

  const model = process.env.OPENAI_ARTICLE_MODEL?.trim() || 'gpt-4o-mini'
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  if (!response.ok) throw new Error(`OpenAI mislukt met status ${response.status}`)
  const data = (await response.json()) as OpenAIChatResponse
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('OpenAI gaf geen artikeltekst terug.')
  return text
}

// ─── User prompt samenstellen ─────────────────────────────────────────────────

function buildUserPrompt(input: GenerateArticleFromBriefInput): string {
  const today = new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())
  const imagePart = [
    input.imageNote ? `Afbeeldingscontext: ${input.imageNote}` : null,
    input.imageAlt ? `Afbeelding alt-tekst: ${input.imageAlt}` : null
  ]
    .filter(Boolean)
    .join('\n')

  return [
    `Schrijf een volledig nieuwsartikel in het Nederlands voor de site ${input.site}.`,
    '',
    `Titel: ${input.title}`,
    `Publicatiedatum: ${today}`,
    `Samenvatting bron: ${input.summary ?? 'n.v.t.'}`,
    `Bron URL: ${input.sourceUrl ?? 'n.v.t.'}`,
    '',
    'Briefing van de redacteur:',
    input.brief,
    '',
    imagePart ? `${imagePart}\n` : null,
    'Schrijf de volledige tekst in markdown. Sluit af met ## Bronnen en noem daarin de bron-URL als beschikbaar.'
  ]
    .filter((line) => line !== null)
    .join('\n')
}

// ─── Hoofdfunctie ──────────────────────────────────────────────────────────────

export async function generateArticleFromBrief(input: GenerateArticleFromBriefInput): Promise<GenerateArticleFromBriefResult> {
  const cleanBrief = input.brief.trim()
  if (!cleanBrief) {
    throw new Error('Vul eerst een korte briefing in voordat je het artikel laat schrijven.')
  }

  const siteInstructions = buildSiteInstructions(input.site)
  const structureRequirements = buildStructureRequirements()
  const systemPrompt = [
    'Je bent een Nederlandse hoofdredacteur voor architectuur- en vastgoednieuws.',
    'Je schrijft altijd conform de site-specifieke instructies.',
    '',
    siteInstructions,
    '',
    structureRequirements
  ].join('\n')

  const userPrompt = buildUserPrompt(input)

  const hasClaudeKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim())
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim())

  if (!hasClaudeKey && !hasOpenAIKey) {
    return { body: createTemplateArticle(input), mode: 'template' }
  }

  try {
    // Claude heeft voorkeur (conform MODEL_MATRIX), OpenAI als fallback
    const body = hasClaudeKey
      ? await callClaudeApi(systemPrompt, userPrompt)
      : await callOpenAIApi(systemPrompt, userPrompt)
    return { body, mode: 'ai' }
  } catch {
    if (hasOpenAIKey && hasClaudeKey) {
      try {
        const body = await callOpenAIApi(systemPrompt, userPrompt)
        return { body, mode: 'ai' }
      } catch {
        // beide mislukt, val terug op template
      }
    }
    return { body: createTemplateArticle(input), mode: 'template' }
  }
}

// ─── Site-specifiek template (fallback zonder API) ────────────────────────────

function createTemplateArticle(input: GenerateArticleFromBriefInput): string {
  const today = new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())
  const normalized = input.site.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  const useU = normalized === 'zwijsen.net'
  const jij = useU ? 'u' : 'je'
  const uw = useU ? 'uw' : 'je'
  const doelgroep = normalized === 'kavelarchitect.nl'
    ? 'kavelbezitter of bouwgrondkoper'
    : normalized === 'brikxai.nl'
    ? 'opdrachtgever of verbouwer'
    : `opdrachtgever van ${uw} bouwproject`

  const lines = [
    `# ${input.title}`,
    '',
    input.summary?.trim() || 'Op basis van onderstaande briefing is dit concept opgesteld.',
    '',
    '## Wat is er aan de hand?',
    input.brief.trim(),
    '',
    `## Wat betekent dit voor ${jij}?`,
    `Als ${doelgroep} raakt deze ontwikkeling ${jij} direct. Hieronder de drie meest relevante aandachtspunten:`,
    '',
    `- Controleer de impact op ${uw} planning en vergunningstraject.`,
    `- Toets de financiële gevolgen vroeg in het proces.`,
    `- Stem keuzes tijdig af met ${uw} adviseurs en aannemer.`,
    '',
    '## Veelgestelde vragen',
    '',
    `**Wat verandert er concreet?**  `,
    'Zie de briefing hierboven voor de kern van de wijziging. De exacte details worden verder uitgewerkt zodra meer informatie beschikbaar is.',
    '',
    `**Wat moet ${jij} nu doen?**  `,
    `Bespreek dit met ${useU ? 'uw' : 'je'} architect of adviseur zodra de details bekend zijn. Wacht niet tot de deadline.`,
    '',
    `*Gepubliceerd: ${today}*`
  ]

  if (input.sourceUrl?.trim()) {
    lines.push('', '## Bronnen', `- [Origineel artikel](${input.sourceUrl.trim()})`)
  }

  return lines.join('\n')
}
