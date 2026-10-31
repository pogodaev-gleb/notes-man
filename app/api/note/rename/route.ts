import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireString } from '@/lib/api'
import { renameNote } from '@/lib/vault'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const path = requireString(body?.path, 'path')
    const title = requireString(body?.title, 'title').trim()
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    return NextResponse.json(await renameNote(path, title))
  } catch (error) {
    return jsonError(error)
  }
}
