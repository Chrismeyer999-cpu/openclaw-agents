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

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

export async function generateArticleFromBrief(input: GenerateArticleFromBriefInput): Promise<GenerateArticleFromBriefResult> {
  const cleanBrief = input.brief.trim()
  if (!cleanBrief) {
    throw new Error('Vul eerst een korte briefing in voordat je het artikel laat schrijven.')
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return { body: createTemplateArticle(input), mode: 'template' }
  }

  try {
    const model = process.env.OPENAI_ARTICLE_MODEL?.trim() || DEFAULT_OPENAI_MODEL
    const systemPrompt =
      'Je bent een Nederlandse redactie-assistent voor architectuurnieuws. Schrijf helder, concreet en professioneel. Geen marketinghype.'
    const userPrompt = buildUserPrompt(input)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI request mislukt met status ${response.status}`)
    }

    const data = (await response.json()) as OpenAIChatResponse
    const article = data.choices?.[0]?.message?.content?.trim()
    if (!article) {
      throw new Error('OpenAI gaf geen artikeltekst terug.')
    }

    return { body: article, mode: 'ai' }
  } catch {
    return { body: createTemplateArticle(input), mode: 'template' }
  }
}

function buildUserPrompt(input: GenerateArticleFromBriefInput) {
  const imagePart = [
    input.imageUrl ? `Afbeelding URL: ${input.imageUrl}` : null,
    input.imageAlt ? `Afbeelding alt: ${input.imageAlt}` : null,
    input.imageNote ? `Afbeeldingscontext van gebruiker: ${input.imageNote}` : null
  ]
    .filter(Boolean)
    .join('\n')

  return [
    'Schrijf een nieuwsartikel in het Nederlands op basis van onderstaande context.',
    '',
    `Site: ${input.site}`,
    `Titel: ${input.title}`,
    `Samenvatting bron: ${input.summary ?? 'n.v.t.'}`,
    `Bron URL: ${input.sourceUrl ?? 'n.v.t.'}`,
    '',
    'Briefing van gebruiker:',
    input.brief,
    '',
    imagePart ? `Afbeelding context:\n${imagePart}\n` : null,
    'Vereisten:',
    '- Schrijf in markdown.',
    '- Start met een korte intro van 2-3 zinnen.',
    '- Voeg 2 tot 3 duidelijke H2-koppen toe.',
    '- Maak 1 korte bulletlijst met praktische punten.',
    '- Sluit af met een korte conclusie.',
    '- Houd het feitelijk en bruikbaar voor opdrachtgevers.'
  ]
    .filter(Boolean)
    .join('\n')
}

function createTemplateArticle(input: GenerateArticleFromBriefInput) {
  const lines = [
    `# ${input.title}`,
    '',
    input.summary?.trim() || 'Op basis van de briefing is onderstaand conceptartikel opgesteld.',
    '',
    '## Context',
    input.brief.trim(),
    '',
    `## Wat betekent dit voor ${input.site}?`,
    'Deze ontwikkeling is relevant voor opdrachtgevers die bezig zijn met ontwerpkeuzes, vergunningen of bouwplanning.',
    '',
    '## Praktische aandachtspunten',
    '- Controleer de impact op planning en vergunningstraject.',
    '- Toets de financiële gevolgen vroeg in het proces.',
    '- Stem keuzes af met de betrokken adviseurs en aannemer.',
    '',
    '## Conclusie',
    'Gebruik dit als werkversie en verfijn de tekst op projectspecifieke details voordat je publiceert.'
  ]

  if (input.imageNote?.trim()) {
    lines.push('', '## Beeld bij dit artikel', input.imageNote.trim())
  } else if (input.imageAlt?.trim()) {
    lines.push('', '## Beeld bij dit artikel', input.imageAlt.trim())
  }

  if (input.sourceUrl?.trim()) {
    lines.push('', `Bron: ${input.sourceUrl.trim()}`)
  }

  return lines.join('\n')
}

