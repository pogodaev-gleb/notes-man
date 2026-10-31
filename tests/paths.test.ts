import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { isInside, normalizeRelative, PathError, resolveNotePath } from '@/lib/paths'

describe('normalizeRelative', () => {
  it('accepts a nested markdown path', () => {
    expect(normalizeRelative('1-Projects/foo/2026-01-01-bar.md')).toBe('1-Projects/foo/2026-01-01-bar.md')
  })

  it('accepts a plain text note', () => {
    expect(normalizeRelative('0-Inbox/notes.txt')).toBe('0-Inbox/notes.txt')
  })

  it('normalises backslashes', () => {
    expect(normalizeRelative('1-Projects\\foo.md')).toBe('1-Projects/foo.md')
  })

  it.each([
    ['', 'empty'],
    ['../escape.md', 'traversal'],
    ['a/../../b.md', 'traversal'],
    ['/etc/passwd.md', 'absolute'],
    ['C:/notes/a.md', 'windows absolute'],
    ['notes.pdf', 'wrong extension'],
    ['a//b.md', 'empty segment'],
  ])('rejects %s', (input) => {
    expect(() => normalizeRelative(input)).toThrow(PathError)
  })
})

describe('resolveNotePath', () => {
  let root: string

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-paths-'))
    await fs.mkdir(path.join(root, '0-Inbox'), { recursive: true })
    await fs.writeFile(path.join(root, '0-Inbox', 'a.md'), '# a')
  })

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('resolves a file inside the vault', async () => {
    const resolved = await resolveNotePath(root, '0-Inbox/a.md')
    expect(resolved.endsWith('0-Inbox/a.md')).toBe(true)
  })

  it('resolves a not-yet-existing file whose folder exists', async () => {
    const resolved = await resolveNotePath(root, '0-Inbox/new.md')
    expect(resolved.endsWith('0-Inbox/new.md')).toBe(true)
  })

  it('rejects a missing folder', async () => {
    await expect(resolveNotePath(root, 'nope/new.md')).rejects.toThrow(PathError)
  })

  it('rejects a symlink pointing outside the vault', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-outside-'))
    await fs.writeFile(path.join(outside, 'secret.md'), 'secret')
    await fs.symlink(path.join(outside, 'secret.md'), path.join(root, '0-Inbox', 'link.md'))

    await expect(resolveNotePath(root, '0-Inbox/link.md')).rejects.toThrow(PathError)
    await fs.rm(outside, { recursive: true, force: true })
  })
})

describe('isInside', () => {
  it('rejects the root itself and siblings', () => {
    expect(isInside('/vault', '/vault')).toBe(false)
    expect(isInside('/vault', '/vault-other/a.md')).toBe(false)
    expect(isInside('/vault', '/vault/a.md')).toBe(true)
  })
})
