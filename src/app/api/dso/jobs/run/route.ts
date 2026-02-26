import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type PdokDoc = {
  weergavenaam?: string
  centroide_ll?: string
  straatnaam?: string
  huisnummer?: number
  postcode?: string
  woonplaatsnaam?: string
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await supabase.from('dso_jobs').select('id,address,status').eq('status', 'queued').order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!job) return NextResponse.json({ ok: true, message: 'No queued jobs' })

  await supabase.from('dso_jobs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', job.id)

  try {
    const rpKey = process.env.RUIMTELIJKE_PLANNEN_API_KEY
    if (!rpKey) throw new Error('RUIMTELIJKE_PLANNEN_API_KEY ontbreekt')

    const pdok = await geocodeWithPdok(job.address)
    if (!pdok) throw new Error('Adres niet gevonden via PDOK')

    const point = parsePoint(pdok.centroide_ll)
    if (!point) throw new Error('Kon coördinaat niet parsen')

    const plannen = await findPlannenAtPoint(point, rpKey)

    const result = {
      input: job.address,
      location: {
        displayName: pdok.weergavenaam,
        straat: pdok.straatnaam,
        huisnummer: pdok.huisnummer,
        postcode: pdok.postcode,
        plaats: pdok.woonplaatsnaam,
        lon: point[0],
        lat: point[1]
      },
      plannen
    }

    await supabase.from('dso_jobs').update({ status: 'done', result_json: result, error_text: null, updated_at: new Date().toISOString() }).eq('id', job.id)
    return NextResponse.json({ ok: true, id: job.id, status: 'done' })
  } catch (e) {
    await supabase
      .from('dso_jobs')
      .update({ status: 'failed', error_text: e instanceof Error ? e.message : 'unknown error', updated_at: new Date().toISOString() })
      .eq('id', job.id)

    return NextResponse.json({ ok: false, id: job.id, error: e instanceof Error ? e.message : 'unknown error' }, { status: 500 })
  }
}

async function geocodeWithPdok(address: string): Promise<PdokDoc | null> {
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(address)}&rows=1&fl=weergavenaam,centroide_ll,straatnaam,huisnummer,postcode,woonplaatsnaam`
  const res = await fetch(url)
  if (!res.ok) return null
  const payload = (await res.json()) as { response?: { docs?: PdokDoc[] } }
  return payload.response?.docs?.[0] ?? null
}

function parsePoint(value?: string): [number, number] | null {
  if (!value) return null
  const match = value.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2])]
}

async function findPlannenAtPoint(point: [number, number], apiKey: string) {
  const body = { _geo: { contains: { type: 'Point', coordinates: point } } }
  const res = await fetch('https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4/plannen/_zoek?pageSize=20&regelStatus=geldend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify(body)
  })

  if (!res.ok) return [{ error: `Ruimtelijke plannen lookup failed (${res.status})` }]

  const payload = (await res.json()) as {
    _embedded?: {
      plannen?: Array<{
        id: string
        naam?: string
        type?: string
        regelStatus?: string
        regelBinding?: string
        planstatusInfo?: { planstatus?: string; datum?: string }
      }>
    }
  }

  return (payload._embedded?.plannen ?? []).map((p) => ({
    id: p.id,
    naam: p.naam,
    type: p.type,
    regelStatus: p.regelStatus,
    regelBinding: p.regelBinding,
    status: p.planstatusInfo?.planstatus,
    datum: p.planstatusInfo?.datum
  }))
}
