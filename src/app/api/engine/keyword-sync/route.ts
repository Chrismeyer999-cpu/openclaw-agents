import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// V1 scaffold: seeds keyword candidates per workspace.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspaces, error } = await supabase.from('workspaces').select('id,domain')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let inserted = 0
  for (const w of workspaces ?? []) {
    const seeds = defaultKeywordsForDomain(w.domain).map((k) => ({
      workspace_id: w.id,
      keyword: k,
      language: 'nl',
      country: 'NL',
      source: 'engine_v1_seed',
      trend_score: 50,
      competition_score: 50,
      priority_score: 50,
      status: 'new'
    }))

    for (const row of seeds) {
      const { error: insErr } = await supabase.from('keyword_topics').insert(row)
      if (!insErr) inserted += 1
    }
  }

  return NextResponse.json({ ok: true, inserted, message: 'Keyword Engine v1 sync scaffold uitgevoerd.' })
}

function defaultKeywordsForDomain(domain: string) {
  if (domain === 'zwijsen.net') return ['architect villa', 'luxe woning ontwerp', 'ai architectuur workflow']
  if (domain === 'kavelarchitect.nl') return ['bouwkavel kopen', 'kavel uitgifte gemeente', 'bestemmingsplan kavel']
  if (domain === 'brikxai.nl') return ['omgevingswet uitleg', 'vergunning check woning', 'bouwkosten particuliere woning']
  return ['seo automatisering', 'llm zichtbaarheid']
}
