import { NextResponse } from 'next/server'

type PdokDoc = {
  weergavenaam?: string
  centroide_ll?: string
  straatnaam?: string
  huisnummer?: number
  postcode?: string
  woonplaatsnaam?: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { address?: string } | null
  const address = body?.address?.trim()
  if (!address) return NextResponse.json({ error: 'Adres is verplicht' }, { status: 400 })

  const rpKey = process.env.RUIMTELIJKE_PLANNEN_API_KEY
  if (!rpKey) {
    return NextResponse.json({ error: 'RUIMTELIJKE_PLANNEN_API_KEY ontbreekt in env' }, { status: 500 })
  }

  const pdok = await geocodeWithPdok(address)
  if (!pdok) return NextResponse.json({ error: 'Adres niet gevonden via PDOK' }, { status: 404 })

  const point = parsePoint(pdok.centroide_ll)
  if (!point) return NextResponse.json({ error: 'Kon coördinaat niet parsen' }, { status: 500 })

  const plannen = await findPlannenAtPoint(point, rpKey)

  return NextResponse.json({
    ok: true,
    input: address,
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
  })
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

  if (!res.ok) {
    return [{ error: `Ruimtelijke plannen lookup failed (${res.status})` }]
  }

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
