import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/api'
import { searchNotes } from '@/lib/vault'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q') ?? ''
    return NextResponse.json({ hits: await searchNotes(query) })
  } catch (error) {
    return jsonError(error)
  }
}
