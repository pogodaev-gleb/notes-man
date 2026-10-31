import { NextResponse } from 'next/server'
import { PathError } from './paths'
import { VaultConflictError, VaultUnavailableError } from './vault'

export function jsonError(error: unknown): NextResponse {
  if (error instanceof PathError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (error instanceof VaultConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 })
  }
  if (error instanceof VaultUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 })
  }
  if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  console.error(error)
  return NextResponse.json({ error: 'internal error' }, { status: 500 })
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new PathError(`${field} is required`)
  return value
}
