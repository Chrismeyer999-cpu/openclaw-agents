import { listKavelAlertSubscribers, updateKavelAlertSubscriberStatus, upsertKavelAlertSubscriber } from '@/lib/kavels'
import type { KavelAlertStatus } from '@/lib/kavels/types'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_STATUSES = new Set<KavelAlertStatus>(['actief', 'pauze', 'uitgeschreven'])

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const subscribers = await listKavelAlertSubscribers(300)
    return NextResponse.json({ subscribers })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | {
        email?: string
        naam?: string | null
        telefoonnummer?: string | null
        status?: KavelAlertStatus
        provincies?: string[]
        min_prijs?: number | null
        max_prijs?: number | null
        min_oppervlakte?: number | null
        bouwstijl?: string | null
        tijdslijn?: string | null
        bouwbudget?: string | null
        kavel_type?: string | null
        dienstverlening?: string | null
        early_access_rapport?: boolean
        opmerkingen?: string | null
      }
    | null
  if (typeof body?.email !== 'string' || body.email.trim().length === 0) {
    return NextResponse.json({ error: 'email is verplicht' }, { status: 400 })
  }

  try {
    const subscriber = await upsertKavelAlertSubscriber({
      email: body.email,
      naam: asOptionalString(body.naam),
      telefoonnummer: asOptionalString(body.telefoonnummer),
      status: body.status && ALLOWED_STATUSES.has(body.status) ? body.status : 'actief',
      provincies: Array.isArray(body.provincies) ? body.provincies : [],
      minPrijs: normalizeNumber(body.min_prijs),
      maxPrijs: normalizeNumber(body.max_prijs),
      minOppervlakte: normalizeNumber(body.min_oppervlakte),
      bouwstijl: asOptionalString(body.bouwstijl),
      tijdslijn: asOptionalString(body.tijdslijn),
      bouwbudget: asOptionalString(body.bouwbudget),
      kavelType: asOptionalString(body.kavel_type),
      dienstverlening: asOptionalString(body.dienstverlening),
      earlyAccessRapport: Boolean(body.early_access_rapport),
      opmerkingen: asOptionalString(body.opmerkingen),
      source: 'dashboard'
    })
    return NextResponse.json(subscriber, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { id?: string; status?: KavelAlertStatus } | null
  if (!body?.id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
  if (!body.status || !ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 })
  }

  try {
    const updated = await updateKavelAlertSubscriberStatus(body.id, body.status)
    if (!updated) return NextResponse.json({ error: 'Subscriber niet gevonden' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function asOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

