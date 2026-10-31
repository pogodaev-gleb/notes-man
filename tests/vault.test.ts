import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { clearCache } from '@/lib/cache'
import { PathError } from '@/lib/paths'
import {
  ARCHIVE_FOLDER,
  archiveNote,
  createNote,
  listVault,
  readNote,
  renameNote,
  restoreNote,
  searchNotes,
  VaultConflictError,
  VaultUnavailableError,
  writeNote,
} from '@/lib/vault'

let root: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-test-'))
  for (const folder of ['0-Inbox', '1-Projects', '2-Areas', '3-Resources', '4-Archive']) {
    await fs.mkdir(path.join(root, folder), { recursive: true })
  }
  await fs.mkdir(path.join(root, '1-Projects', 'checkout'), { recursive: true })
  await fs.writeFile(
    path.join(root, '1-Projects', 'checkout', '2026-10-30-serviceadresse.md'),
    '# Serviceadresse\n\nAdressen im Cart-Cookie.',
  )
  process.env.VAULT_PATH = root
  clearCache()
})

afterEach(async () => {
  delete process.env.VAULT_PATH
  clearCache()
  await fs.rm(root, { recursive: true, force: true })
})

describe('listVault', () => {
  it('lists folders, counts and notes', async () => {
    const listing = await listVault()
    expect(listing.total).toBe(1)
    expect(listing.notes[0].path).toBe('1-Projects/checkout/2026-10-30-serviceadresse.md')
    expect(listing.notes[0].title).toBe('serviceadresse')
    expect(listing.folders.find((f) => f.path === '1-Projects')?.count).toBe(1)
    expect(listing.folders.find((f) => f.path === '0-Inbox')?.count).toBe(0)
    expect(listing.allFolders).toContain('1-Projects/checkout')
  })

  it('lists nested folders with depth and recursive counts', async () => {
    const listing = await listVault()
    const nested = listing.folders.find((f) => f.path === '1-Projects/checkout')
    expect(nested).toMatchObject({ name: 'checkout', depth: 1, count: 1 })
    expect(listing.folders.find((f) => f.path === '1-Projects')?.depth).toBe(0)
  })

  it('ignores hidden folders and non-markdown files', async () => {
    await fs.mkdir(path.join(root, '.obsidian'))
    await fs.writeFile(path.join(root, '.obsidian', 'x.md'), 'x')
    await fs.writeFile(path.join(root, '0-Inbox', 'image.png'), 'x')

    const listing = await listVault()
    expect(listing.total).toBe(1)
  })

  it('fails loudly when the vault is missing', async () => {
    process.env.VAULT_PATH = path.join(root, 'nope')
    await expect(listVault()).rejects.toThrow(VaultUnavailableError)
  })
})

describe('create and write', () => {
  it('creates a dated note in the inbox by default', async () => {
    const { path: created } = await createNote('', 'Neue Idee')
    expect(created).toMatch(/^0-Inbox\/\d{4}-\d{2}-\d{2}-neue-idee\.md$/)
    expect(await readNote(created)).toMatchObject({ content: '# Neue Idee\n\n' })
  })

  it('creates into a nested folder', async () => {
    const { path: created } = await createNote('1-Projects/checkout', 'Zweite Notiz')
    expect(created.startsWith('1-Projects/checkout/')).toBe(true)
  })

  it('suffixes duplicate names instead of overwriting', async () => {
    const first = await createNote('0-Inbox', 'Gleich')
    const second = await createNote('0-Inbox', 'Gleich')
    expect(second.path).not.toBe(first.path)
    expect(second.path).toMatch(/-2\.md$/)
  })

  it('refuses to create outside the vault', async () => {
    await expect(createNote('../outside', 'Böse')).rejects.toThrow(PathError)
  })

  it('writes and reads content back', async () => {
    const { path: created } = await createNote('0-Inbox', 'Inhalt')
    await writeNote(created, '# Inhalt\n\nHallo.')
    expect((await readNote(created)).content).toBe('# Inhalt\n\nHallo.')
  })

  it('rejects writing outside the vault', async () => {
    await expect(writeNote('../escape.md', 'x')).rejects.toThrow(PathError)
  })
})

describe('rename', () => {
  it('renames the file and keeps the date prefix', async () => {
    const { path: renamed } = await renameNote('1-Projects/checkout/2026-10-30-serviceadresse.md', 'Lieferadresse')
    expect(renamed).toBe('1-Projects/checkout/2026-10-30-lieferadresse.md')
    await expect(fs.access(path.join(root, renamed))).resolves.toBeUndefined()
    await expect(fs.access(path.join(root, '1-Projects/checkout/2026-10-30-serviceadresse.md'))).rejects.toThrow()
  })

  it('does not clobber an existing file', async () => {
    await fs.writeFile(path.join(root, '1-Projects', 'checkout', '2026-10-30-taken.md'), 'x')
    const { path: renamed } = await renameNote('1-Projects/checkout/2026-10-30-serviceadresse.md', 'Taken')
    expect(renamed).toBe('1-Projects/checkout/2026-10-30-taken-2.md')
  })

  it('throws when no unique name can be found', async () => {
    const dir = path.join(root, '1-Projects', 'checkout')
    for (let index = 1; index < 100; index += 1) {
      const name = index === 1 ? '2026-10-30-full.md' : `2026-10-30-full-${index}.md`
      await fs.writeFile(path.join(dir, name), 'x')
    }
    await expect(renameNote('1-Projects/checkout/2026-10-30-serviceadresse.md', 'Full')).rejects.toThrow(
      VaultConflictError,
    )
  })
})

describe('archive and restore', () => {
  it('moves the note into 4-Archive and back', async () => {
    const original = '1-Projects/checkout/2026-10-30-serviceadresse.md'
    const { path: archived } = await archiveNote(original)
    expect(archived).toBe('4-Archive/1-Projects/checkout/2026-10-30-serviceadresse.md')

    const { path: restored } = await restoreNote(archived)
    expect(restored).toBe(original)
    await expect(fs.access(path.join(root, original))).resolves.toBeUndefined()
  })

  it('refuses to archive an archived note', async () => {
    const { path: archived } = await archiveNote('1-Projects/checkout/2026-10-30-serviceadresse.md')
    await expect(archiveNote(archived)).rejects.toThrow(PathError)
  })

  it('refuses to restore a note that is not archived', async () => {
    await expect(restoreNote('1-Projects/checkout/2026-10-30-serviceadresse.md')).rejects.toThrow(PathError)
  })

  it('keeps the archive folder out of the inbox count', async () => {
    await archiveNote('1-Projects/checkout/2026-10-30-serviceadresse.md')
    const listing = await listVault()
    expect(listing.folders.find((f) => f.path === ARCHIVE_FOLDER)?.count).toBe(1)
  })
})

describe('search', () => {
  it('finds matches in content', async () => {
    const hits = await searchNotes('cart-cookie')
    expect(hits).toHaveLength(1)
    expect(hits[0].path).toBe('1-Projects/checkout/2026-10-30-serviceadresse.md')
    expect(hits[0].snippet).toContain('Cart-Cookie')
  })

  it('finds matches in titles', async () => {
    const hits = await searchNotes('serviceadresse')
    expect(hits).toHaveLength(1)
  })

  it('is case-insensitive', async () => {
    expect(await searchNotes('SERVICEADRESSE')).toHaveLength(1)
  })

  it('ignores queries shorter than two characters', async () => {
    expect(await searchNotes('a')).toHaveLength(0)
  })

  it('picks up edits written outside the app', async () => {
    await fs.writeFile(
      path.join(root, '0-Inbox', '2026-10-31-frisch.md'),
      'Ein ganz neuer Gedanke über Kaffee.',
    )
    const hits = await searchNotes('kaffee')
    expect(hits.map((hit) => hit.path)).toContain('0-Inbox/2026-10-31-frisch.md')
  })
})
