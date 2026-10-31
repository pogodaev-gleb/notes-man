import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireString } from '@/lib/api'
import { deleteNote, undeleteNote } from '@/lib/vault'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const path = requireString(body?.path, 'path')
    return NextResponse.json(await deleteNote(path))
  } catch (error) {
    return jsonError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const path = requireString(body?.path, 'path')
    const target = requireString(body?.target, 'target')
    return NextResponse.json(await undeleteNote(path, target))
  } catch (error) {
    return jsonError(error)
  }
}