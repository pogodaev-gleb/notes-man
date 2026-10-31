import path from 'node:path'
import fs from 'node:fs/promises'

export class PathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathError'
  }
}

/** Validate a vault-relative note path and normalise separators. */
export function normalizeRelative(input: string): string {
  if (typeof input !== 'string' || input.trim() === '') throw new PathError('empty path')
  if (input.includes('\0')) throw new PathError('invalid path')

  const unified = input.replace(/\\/g, '/')
  if (path.posix.isAbsolute(unified) || /^[a-zA-Z]:/.test(unified)) {
    throw new PathError('absolute paths are not allowed')
  }

  const segments = unified.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new PathError('invalid path segment')
    }
  }

  if (!unified.endsWith('.md')) throw new PathError('only .md files are allowed')
  return segments.join('/')
}

/** True when `candidate` is strictly inside `root`. */
export function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * Resolve a vault-relative path to an absolute one, refusing anything that
 * escapes the vault through `..`, an absolute path, or a symlink.
 */
export async function resolveNotePath(root: string, input: string): Promise<string> {
  const rel = normalizeRelative(input)
  const rootReal = await fs.realpath(root)
  const target = path.resolve(rootReal, rel)

  const parentReal = await fs.realpath(path.dirname(target)).catch(() => null)
  if (!parentReal) throw new PathError('folder does not exist')
  if (!isInside(rootReal, parentReal)) throw new PathError('path escapes the vault')

  try {
    const targetReal = await fs.realpath(target)
    if (!isInside(rootReal, targetReal)) throw new PathError('path escapes the vault')
    return targetReal
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return target
    throw error
  }
}
