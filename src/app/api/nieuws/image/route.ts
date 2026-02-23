import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif']
])

const DEFAULT_ZWIJSEN_REPO_PATH = process.platform === 'win32' ? 'E:\\zwijsen' : '/mnt/e/zwijsen'

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return null
  return user
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const fileField = formData.get('file')
  if (!(fileField instanceof File)) {
    return NextResponse.json({ error: 'Bestand ontbreekt.' }, { status: 400 })
  }

  if (fileField.size <= 0) {
    return NextResponse.json({ error: 'Bestand is leeg.' }, { status: 400 })
  }
  if (fileField.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'Bestand is te groot (max 8MB).' }, { status: 400 })
  }

  const extension = resolveExtension(fileField)
  if (!extension) {
    return NextResponse.json({ error: 'Alleen JPG, PNG, WEBP of GIF is toegestaan.' }, { status: 400 })
  }

  const today = new Date()
  const year = String(today.getFullYear())
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const repoRoot = process.env.ZWIJSEN_REPO_PATH?.trim() || DEFAULT_ZWIJSEN_REPO_PATH
  const targetDir = path.join(repoRoot, 'public', 'images', 'actueel', year, month)
  const altFallback = fileNameToAlt(fileField.name)
  const baseName = toSlug(path.parse(fileField.name).name).slice(0, 50) || 'nieuwsbeeld'
  const finalName = `${Date.now()}-${baseName}-${randomUUID().slice(0, 8)}.${extension}`
  const absolutePath = path.join(targetDir, finalName)
  const publicUrl = `/images/actueel/${year}/${month}/${finalName}`

  try {
    await fs.mkdir(targetDir, { recursive: true })
    const buffer = Buffer.from(await fileField.arrayBuffer())
    await fs.writeFile(absolutePath, buffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Uploaden mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({
    url: publicUrl,
    alt: altFallback,
    bytes: fileField.size
  })
}

function resolveExtension(file: File) {
  const mimeExt = ALLOWED_MIME_TYPES.get(file.type)
  if (mimeExt) return mimeExt

  const parsedExt = path.extname(file.name).toLowerCase().replace('.', '')
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(parsedExt)) {
    return parsedExt === 'jpeg' ? 'jpg' : parsedExt
  }
  return null
}

function toSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function fileNameToAlt(fileName: string) {
  const name = path.parse(fileName).name.replace(/[_-]+/g, ' ').trim()
  return name.length > 0 ? name : 'Nieuwsafbeelding'
}

