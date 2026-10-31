import { NextRequest, NextResponse } from 'next/server'
import { moveNote, VaultUnavailableError } from '@/lib/vault'
import { PathError } from '@/lib/paths'

export async function POST(request: NextRequest) {
  try {
    const { path, folder } = await request.json()
    if (!path || !folder) {
      return NextResponse.json({ error: 'path and folder are required' }, { status: 400 })
    }
    const result = await moveNote(path, folder)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof VaultUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof PathError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}