import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireString } from '@/lib/api'
import { createNote, readNote, writeNote } from '@/lib/vault'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const path = requireString(request.nextUrl.searchParams.get('path'), 'path')
    return NextResponse.json(await readNote(path))
  } catch (error) {
    return jsonError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const path = requireString(body?.path, 'path')
    const content = requireString(body?.content, 'content')
    return NextResponse.json(await writeNote(path, content))
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const folder = typeof body?.folder === 'string' ? body.folder : ''
    const title = requireString(body?.title, 'title').trim()
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    return NextResponse.json(await createNote(folder, title), { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
