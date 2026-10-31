import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api'
import { listVault } from '@/lib/vault'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await listVault())
  } catch (error) {
    return jsonError(error)
  }
}
