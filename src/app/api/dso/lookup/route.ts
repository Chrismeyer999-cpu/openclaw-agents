import { NextResponse } from 'next/server'

type PdokDoc = {
  weergavenaam?: string
  centroide_ll?: string
  centroide_rd?: string
  straatnaam?: string
  huisnummer?: number
  postcode?: string
  woonplaatsnaam?: string
}

type BagFeature = {
  type: string
  geometry?: { type: string; coordinates: any }
  properties: Record<string, any>
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { address?: string } | null
  const address = body?.address?.trim()
  if (!address) return NextResponse.json({ error: 'Adres is verplicht' }, { status: 400 })

  const rpKey = process.env.RUIMTELIJKE_PLANNEN_API_KEY
  if (!rpKey) return NextResponse.json({ error: 'RUIMTELIJKE_PLANNEN_API_KEY ontbreekt in env' }, { status: 500 })

  const pdok = await geocodeWithPdok(address)
  if (!pdok) return NextResponse.json({ error: 'Adres niet gevonden via PDOK' }, { status: 404 })

  const pointLL = parsePoint(pdok.centroide_ll)
  const pointRD = parsePoint(pdok.centroide_rd)
  if (!pointLL || !pointRD) return NextResponse.json({ error: 'Kon coördinaten niet parsen' }, { status: 500 })

  const plannen = await findPlannenAtPoint(pointLL, rpKey)
  const bag = await findBagBuildingContext(pdok, pointRD)

  return NextResponse.json({
    ok: true,
    input: address,
    location: {
      displayName: pdok.weergavenaam,
      straat: pdok.straatnaam,
      huisnummer: pdok.huisnummer,
      postcode: pdok.postcode,
      plaats: pdok.woonplaatsnaam,
      lon: pointLL[0],
      lat: pointLL[1],
      x: pointRD[0],
      y: pointRD[1]
    },
    plannen,
    buildingContext: bag,
    vergunningsvrijIndicatie: buildPermitFreeSummary(bag)
  })
}

async function geocodeWithPdok(address: string): Promise<PdokDoc | null> {
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(address)}&fq=type:adres&rows=1&fl=weergavenaam,centroide_ll,centroide_rd,straatnaam,huisnummer,postcode,woonplaatsnaam`
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

async function findBagBuildingContext(pdok: PdokDoc, pointRD: [number, number]) {
  const [x, y] = pointRD
  const d = 80
  const bbox = `${x - d},${y - d},${x + d},${y + d},EPSG:28992`

  const vboUrl = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=bag:verblijfsobject&outputFormat=application/json&srsName=EPSG:28992&bbox=${encodeURIComponent(
    bbox
  )}`
  const pandUrl = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=bag:pand&outputFormat=application/json&srsName=EPSG:28992&bbox=${encodeURIComponent(
    bbox
  )}`

  const [vboRes, pandRes] = await Promise.all([fetch(vboUrl), fetch(pandUrl)])
  if (!vboRes.ok || !pandRes.ok) {
    return { error: 'BAG context ophalen mislukt', hoofdgebouw: null, pandenInOmgeving: [] }
  }

  const vboData = (await vboRes.json()) as { features?: BagFeature[] }
  const pandData = (await pandRes.json()) as { features?: BagFeature[] }

  const vboFeatures = vboData.features ?? []
  const pandFeatures = pandData.features ?? []

  const targetVbo = vboFeatures.find((f) => {
    const p = f.properties
    return (
      String(p.openbare_ruimte ?? '').toLowerCase() === String(pdok.straatnaam ?? '').toLowerCase() &&
      String(p.huisnummer ?? '') === String(pdok.huisnummer ?? '') &&
      String(p.postcode ?? '').toUpperCase() === String(pdok.postcode ?? '').toUpperCase()
    )
  })

  const targetPandId = String(targetVbo?.properties?.pandidentificatie ?? '')
  const targetPand = pandFeatures.find((f) => String(f.properties.identificatie) === targetPandId)

  const hoofdgebouw = targetVbo
    ? {
        verblijfsobject_id: targetVbo.properties.identificatie,
        pand_id: targetPandId || null,
        gebruiksdoel: targetVbo.properties.gebruiksdoel,
        oppervlakte_verblijfsobject_m2: Number(targetVbo.properties.oppervlakte ?? 0),
        bouwjaar: Number(targetVbo.properties.bouwjaar ?? 0) || null,
        pand_oppervlakte_min_m2: Number(targetPand?.properties?.oppervlakte_min ?? 0) || null,
        pand_oppervlakte_max_m2: Number(targetPand?.properties?.oppervlakte_max ?? 0) || null
      }
    : null

  const pandenInOmgeving = pandFeatures
    .map((f) => ({
      pand_id: String(f.properties.identificatie),
      bouwjaar: Number(f.properties.bouwjaar ?? 0) || null,
      oppervlakte_min_m2: Number(f.properties.oppervlakte_min ?? 0) || null,
      oppervlakte_max_m2: Number(f.properties.oppervlakte_max ?? 0) || null,
      status: String(f.properties.status ?? '')
    }))
    .slice(0, 40)

  // kaartlaag: alle panden + highlight hoofdgebouw
  const mapGeoJson = {
    type: 'FeatureCollection',
    features: pandFeatures.map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        pand_id: String(f.properties.identificatie),
        is_hoofdgebouw: String(f.properties.identificatie) === targetPandId,
        opp_min: Number(f.properties.oppervlakte_min ?? 0) || null,
        opp_max: Number(f.properties.oppervlakte_max ?? 0) || null
      }
    }))
  }

  return {
    hoofdgebouw,
    pandenInOmgeving,
    mapGeoJson,
    note:
      'Bijgebouwen/aanbouwen in BAG kunnen onvolledig zijn. Gebruik dit als eerste technische indicatie, niet als juridisch eindoordeel.'
  }
}

function buildPermitFreeSummary(bag: any) {
  const hoofd = bag?.hoofdgebouw
  return {
    disclaimer:
      'Indicatie op basis van landelijke vergunningsvrij-regels + beschikbare objectdata. Definitieve toetsing blijft locatie- en plan-specifiek.',
    vermoedelijkMogelijk: [
      'Bijbehorend bouwwerk in achtererfgebied (maatvoering- en afstandsregels van toepassing).',
      'Dakkapel achterdakvlak binnen standaard maatvoering.',
      'Erfafscheiding achter voorgevelrooilijn binnen toegestane hoogte.',
      'Interne verbouwingen zonder wijziging draagconstructie/gebruiksfunctie.'
    ],
    extraToetsen: [
      'Ligt het perceel in beschermd dorpsgezicht/monumentale context?',
      'Exacte achtererfgrens en voorgevelrooilijn op kaart bepalen.',
      'Check op lokale planregels/paraplubepalingen (parkeren, woningsplitsing).'
    ],
    hoofdgebouwIndicatie: hoofd
      ? `Hoofdbebouwing (BAG): verblijfsobject ca. ${hoofd.oppervlakte_verblijfsobject_m2} m², bouwjaar ${hoofd.bouwjaar ?? 'onbekend'}.`
      : 'Hoofdbebouwing niet eenduidig gematcht in BAG-set.'
  }
}
