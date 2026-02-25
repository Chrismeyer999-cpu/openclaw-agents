import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Placeholder for last30days integration
  // Expected next step: pull trend topics and upsert into golf_topics_trending.
  const { error } = await supabase.from('golf_topics_trending').insert({
    account: 'both',
    topic: `Auto trend sync marker ${new Date().toISOString()}`,
    hook: 'Top hook van de dag (placeholder)',
    source: 'last30days',
    trend_score: 50,
    fit_score: 50,
    status: 'new'
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: 'Trend sync scaffold uitgevoerd. Koppel last30days parser voor echte topics.' })
}
