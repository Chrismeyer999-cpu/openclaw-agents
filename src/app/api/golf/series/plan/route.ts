import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: series, error: seriesError } = await supabase
    .from('golf_series')
    .select('id,title,target_episodes')
    .eq('status', 'active')

  if (seriesError) return NextResponse.json({ error: seriesError.message }, { status: 500 })

  let created = 0
  for (const s of series ?? []) {
    const { data: eps, error: epsError } = await supabase
      .from('golf_series_episodes')
      .select('episode_no')
      .eq('series_id', s.id)
      .order('episode_no', { ascending: true })

    if (epsError) continue
    const existing = new Set((eps ?? []).map((e) => e.episode_no))
    for (let i = 1; i <= Math.min(Number(s.target_episodes ?? 8), 10); i++) {
      if (existing.has(i)) continue
      const { error: insertError } = await supabase.from('golf_series_episodes').insert({
        series_id: s.id,
        episode_no: i,
        title: `${s.title} - Episode ${i}`,
        hook: 'Placeholder hook',
        status: 'idea'
      })
      if (!insertError) created += 1
    }
  }

  return NextResponse.json({ ok: true, created, message: 'Weekly series planner scaffold uitgevoerd.' })
}
