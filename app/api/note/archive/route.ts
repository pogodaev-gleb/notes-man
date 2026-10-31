import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireString } from '@/lib/api'
import { archiveNote, restoreNote } from '@/lib/vault'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const path = requireString(body?.path, 'path')
    return NextResponse.json(await archiveNote(path))
  } catch (error) {
    return jsonError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const path = requireString(body?.path, 'path')
    return NextResponse.json(await restoreNote(path))
  } catch (error) {
    return jsonError(error)
  }
}
