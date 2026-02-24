import {
  createManualKavelListing,
  listKavelListings,
  listKavelSyncJobs,
  publishKavelListing,
  queueKavelSyncJob,
  setKavelSyncJobState,
  updateKavelListingStatus
} from '@/lib/kavels'
import { existsSync } from 'fs'
import type { ListingSourceType, ListingStatus } from '@/lib/kavels/types'
import { createClient } from '@/lib/supabase/server'
import { spawn } from 'child_process'
import { NextResponse } from 'next/server'

const ALLOWED_ACTIONS = new Set(['manual_add', 'set_status', 'publish', 'queue_sync'])
const ALLOWED_STATUSES = new Set<ListingStatus>(['pending', 'approved', 'published', 'skipped', 'error'])
const ALLOWED_SOURCES = new Set<ListingSourceType>(['gmail_funda', 'openclaw', 'manual'])

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const source = searchParams.get('source')
  const q = searchParams.get('q')
  const includeJobs = searchParams.get('includeJobs') === '1'

  try {
    const items = await listKavelListings({
      status: status && ALLOWED_STATUSES.has(status as ListingStatus) ? (status as ListingStatus) : 'all',
      source: source && ALLOWED_SOURCES.has(source as ListingSourceType) ? (source as ListingSourceType) : 'all',
      q: q ?? undefined,
      limit: 200
    })
    if (!includeJobs) return NextResponse.json({ items })

    const jobs = await listKavelSyncJobs(40)
    return NextResponse.json({ items, jobs })
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
        action?: string
        id?: string
        status?: ListingStatus
        sites?: string[]
        source_type?: ListingSourceType
        note?: string | null
        funda_id?: string | null
        source_url?: string | null
        adres?: string | null
        postcode?: string | null
        plaats?: string | null
        provincie?: string | null
        prijs?: number | null
        oppervlakte?: number | null
        image_url?: string | null
        map_url?: string | null
        specs?: Record<string, unknown>
      }
    | null

  const action = body?.action ?? ''
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Ongeldige of ontbrekende action' }, { status: 400 })
  }

  try {
    if (action === 'manual_add') {
      const created = await createManualKavelListing({
        fundaId: asOptionalString(body?.funda_id),
        sourceType: body?.source_type && ALLOWED_SOURCES.has(body.source_type) ? body.source_type : 'manual',
        sourceUrl: asOptionalString(body?.source_url),
        adres: asOptionalString(body?.adres),
        postcode: asOptionalString(body?.postcode),
        plaats: asOptionalString(body?.plaats),
        provincie: asOptionalString(body?.provincie),
        prijs: normalizeNumber(body?.prijs),
        oppervlakte: normalizeNumber(body?.oppervlakte),
        imageUrl: asOptionalString(body?.image_url),
        mapUrl: asOptionalString(body?.map_url),
        specs: isRecord(body?.specs) ? body.specs : {}
      })
      return NextResponse.json(created, { status: 201 })
    }

    if (action === 'set_status') {
      if (!body?.id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
      if (!body.status || !ALLOWED_STATUSES.has(body.status)) {
        return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 })
      }
      const updated = await updateKavelListingStatus(body.id, body.status)
      if (!updated) return NextResponse.json({ error: 'Listing niet gevonden' }, { status: 404 })
      return NextResponse.json(updated)
    }

    if (action === 'publish') {
      if (!body?.id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
      const result = await publishKavelListing(body.id, Array.isArray(body.sites) ? body.sites : undefined)
      if (!result) return NextResponse.json({ error: 'Listing niet gevonden' }, { status: 404 })
      return NextResponse.json(result)
    }

    if (!body?.source_type || !['gmail_funda', 'openclaw'].includes(body.source_type)) {
      return NextResponse.json({ error: 'source_type moet gmail_funda of openclaw zijn' }, { status: 400 })
    }
    const syncSource = body.source_type as 'gmail_funda' | 'openclaw'
    const queued = await queueKavelSyncJob({
      sourceType: syncSource,
      triggerType: 'manual',
      note: asOptionalString(body.note),
      metadata: { requestedByEmail: user.email ?? null, requestedById: user.id }
    })
    const dispatch = await dispatchSyncJob(queued.id, syncSource, user.email ?? null)
    return NextResponse.json({ ...queued, ...dispatch }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function dispatchSyncJob(jobId: string, sourceType: 'gmail_funda' | 'openclaw', requestedByEmail: string | null) {
  const webhookUrl = process.env.KAVEL_SYNC_WEBHOOK_URL?.trim()
  const webhookToken = process.env.KAVEL_SYNC_WEBHOOK_TOKEN?.trim()
  if (!webhookUrl) {
    return dispatchLocalSyncJob(jobId, sourceType)
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {})
      },
      body: JSON.stringify({
        jobId,
        sourceType,
        triggerType: 'manual',
        requestedByEmail
      })
    })

    if (!response.ok) {
      const reason = `Worker webhook gaf status ${response.status}`
      await setKavelSyncJobState(jobId, { status: 'error', note: reason, finishedAt: new Date().toISOString() })
      return { dispatch: 'failed' as const, dispatch_message: reason }
    }

    await setKavelSyncJobState(jobId, { status: 'running', startedAt: new Date().toISOString() })
    return { dispatch: 'triggered' as const, dispatch_message: 'Worker getriggerd en job op running gezet.' }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Onbekende webhook-fout'
    await setKavelSyncJobState(jobId, { status: 'error', note: reason, finishedAt: new Date().toISOString() })
    return { dispatch: 'failed' as const, dispatch_message: reason }
  }
}

async function dispatchLocalSyncJob(jobId: string, sourceType: 'gmail_funda' | 'openclaw') {
  if (sourceType === 'openclaw') {
    return dispatchLocalOpenClawJob(jobId)
  }

  const pythonCmd = process.env.KAVEL_SYNC_PYTHON_CMD?.trim() || 'python'
  const defaultScriptPath = process.platform === 'win32'
    ? 'E:\\Funda Wordpress\\brikx_platform\\backend\\sync_worker.py'
    : '/mnt/e/Funda Wordpress/brikx_platform/backend/sync_worker.py'
  const scriptPath = process.env.KAVEL_SYNC_WORKER_SCRIPT_PATH?.trim() || defaultScriptPath
  if (!existsSync(scriptPath)) {
    await setKavelSyncJobState(jobId, {
      status: 'error',
      note: `Sync worker niet gevonden op ${scriptPath}`,
      finishedAt: new Date().toISOString()
    })
    return {
      dispatch: 'failed' as const,
      dispatch_message: `Sync worker niet gevonden op ${scriptPath}`
    }
  }

  try {
    spawn(pythonCmd, [scriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref()

    await setKavelSyncJobState(jobId, {
      status: 'running',
      startedAt: new Date().toISOString(),
      note: `Local worker gestart via ${pythonCmd} ${scriptPath}`
    })

    return {
      dispatch: 'triggered' as const,
      dispatch_message: 'Local Funda sync-worker gestart. Deze maakt ook kaartafbeeldingen en AI-samenvattingen.'
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Kon lokale worker niet starten'
    await setKavelSyncJobState(jobId, {
      status: 'error',
      note: reason,
      finishedAt: new Date().toISOString()
    })
    return {
      dispatch: 'failed' as const,
      dispatch_message: reason
    }
  }
}

async function dispatchLocalOpenClawJob(jobId: string) {
  const command = process.env.KAVEL_SYNC_OPENCLAW_CMD?.trim()
  const cwd = process.env.KAVEL_SYNC_OPENCLAW_CWD?.trim()

  if (!command) {
    return {
      dispatch: 'queued' as const,
      dispatch_message: 'OpenClaw staat in queue. Stel KAVEL_SYNC_OPENCLAW_CMD in voor directe lokale run.'
    }
  }

  try {
    spawnDetachedCommand(command, cwd)
    await setKavelSyncJobState(jobId, {
      status: 'running',
      startedAt: new Date().toISOString(),
      note: `Local OpenClaw worker gestart: ${command}`
    })

    return {
      dispatch: 'triggered' as const,
      dispatch_message: 'Local OpenClaw worker gestart.'
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Kon OpenClaw worker niet starten'
    await setKavelSyncJobState(jobId, {
      status: 'error',
      note: reason,
      finishedAt: new Date().toISOString()
    })
    return {
      dispatch: 'failed' as const,
      dispatch_message: reason
    }
  }
}

function spawnDetachedCommand(command: string, cwd?: string) {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/d', '/s', '/c', command], {
      cwd: cwd || undefined,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref()
    return
  }

  spawn('sh', ['-lc', command], {
    cwd: cwd || undefined,
    detached: true,
    stdio: 'ignore'
  }).unref()
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
