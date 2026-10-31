import fs from 'node:fs/promises'
import path from 'node:path'
import { dropCached, getCached, setCached } from './cache'
import { PathError, resolveNotePath } from './paths'
import { noteFilename, renamedFilename, titleFromFilename } from './slug'
import type { FolderInfo, NoteMeta, SearchHit, VaultListing } from './types'

export const INBOX_FOLDER = '0-Inbox'
export const ARCHIVE_FOLDER = '4-Archive'

export class VaultUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultUnavailableError'
  }
}

export class VaultConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultConflictError'
  }
}

export type { FolderInfo, NoteMeta, SearchHit, VaultListing }


export function vaultRoot(): string {
  return process.env.VAULT_PATH ?? '/mnt/c/Users/pgleb/Desktop/Notes'
}

async function assertVault(): Promise<string> {
  const root = vaultRoot()
  const stat = await fs.stat(root).catch(() => null)
  if (!stat?.isDirectory()) {
    throw new VaultUnavailableError(`vault not reachable: ${root}`)
  }
  return root
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/')
}

async function walk(root: string, dir: string, notes: NoteMeta[]): Promise<void> {
  const dirents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const dirent of dirents) {
    if (dirent.name.startsWith('.')) continue
    const absolute = path.join(dir, dirent.name)

    if (dirent.isDirectory()) {
      await walk(root, absolute, notes)
      continue
    }
    if (!dirent.isFile() || !dirent.name.endsWith('.md')) continue

    const stat = await fs.stat(absolute).catch(() => null)
    if (!stat) continue

    const cached = getCached(absolute)
    if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
      const content = await fs.readFile(absolute, 'utf8').catch(() => '')
      setCached(absolute, { mtimeMs: stat.mtimeMs, size: stat.size, content })
    }

    const rel = toPosix(path.relative(root, absolute))
    notes.push({
      path: rel,
      title: titleFromFilename(dirent.name),
      folder: path.posix.dirname(rel),
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    })
  }
}

async function collectFolders(root: string, dir: string, acc: string[]): Promise<void> {
  const dirents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const dirent of dirents) {
    if (!dirent.isDirectory() || dirent.name.startsWith('.')) continue
    const absolute = path.join(dir, dirent.name)
    acc.push(toPosix(path.relative(root, absolute)))
    await collectFolders(root, absolute, acc)
  }
}

export async function listVault(): Promise<VaultListing> {
  const root = await assertVault()
  const notes: NoteMeta[] = []
  await walk(root, root, notes)
  notes.sort((a, b) => b.mtimeMs - a.mtimeMs)

  const allFolders: string[] = []
  await collectFolders(root, root, allFolders)
  allFolders.sort((a, b) => a.localeCompare(b))

  const folders = allFolders.map((folder) => ({
    path: folder,
    name: folder.split('/').pop() ?? folder,
    depth: folder.split('/').length - 1,
    count: notes.filter((note) => note.path.startsWith(`${folder}/`)).length,
  }))

  return { folders, allFolders, notes, total: notes.length }
}

export async function readNote(relative: string): Promise<{ path: string; content: string; mtimeMs: number }> {
  const root = await assertVault()
  const absolute = await resolveNotePath(root, relative)
  const content = await fs.readFile(absolute, 'utf8')
  const stat = await fs.stat(absolute)
  setCached(absolute, { mtimeMs: stat.mtimeMs, size: stat.size, content })
  return { path: relative, content, mtimeMs: stat.mtimeMs }
}

export async function writeNote(relative: string, content: string): Promise<{ path: string; mtimeMs: number }> {
  const root = await assertVault()
  const absolute = await resolveNotePath(root, relative)
  await fs.writeFile(absolute, content, 'utf8')
  const stat = await fs.stat(absolute)
  setCached(absolute, { mtimeMs: stat.mtimeMs, size: stat.size, content })
  return { path: relative, mtimeMs: stat.mtimeMs }
}

async function uniquePath(dir: string, filename: string): Promise<string> {
  const ext = path.extname(filename)
  const stem = filename.slice(0, -ext.length)
  for (let index = 1; index < 100; index += 1) {
    const candidate = index === 1 ? filename : `${stem}-${index}${ext}`
    const exists = await fs
      .access(path.join(dir, candidate))
      .then(() => true)
      .catch(() => false)
    if (!exists) return path.join(dir, candidate)
  }
  throw new VaultConflictError('too many files with that name')
}

export async function createNote(folder: string, title: string): Promise<{ path: string }> {
  const root = await assertVault()
  const cleanFolder = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || INBOX_FOLDER
  const segments = cleanFolder.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new PathError('invalid folder')
  }

  const dir = path.resolve(root, cleanFolder)
  const dirReal = await fs.realpath(dir).catch(() => null)
  const rootReal = await fs.realpath(root)
  if (!dirReal || !dirReal.startsWith(rootReal)) throw new PathError('folder does not exist')

  const target = await uniquePath(dirReal, noteFilename(title))
  await fs.writeFile(target, `# ${title.trim()}\n\n`, 'utf8')
  const stat = await fs.stat(target)
  setCached(target, { mtimeMs: stat.mtimeMs, size: stat.size, content: `# ${title.trim()}\n\n` })
  return { path: toPosix(path.relative(rootReal, target)) }
}

export async function renameNote(relative: string, title: string): Promise<{ path: string }> {
  const root = await assertVault()
  const absolute = await resolveNotePath(root, relative)
  const dir = path.dirname(absolute)
  const next = await uniquePath(dir, renamedFilename(path.basename(absolute), title))
  if (next === absolute) return { path: relative }

  await fs.rename(absolute, next)
  dropCached(absolute)
  const rootReal = await fs.realpath(root)
  return { path: toPosix(path.relative(rootReal, next)) }
}

export async function archiveNote(relative: string): Promise<{ path: string }> {
  const root = await assertVault()
  if (relative.startsWith(`${ARCHIVE_FOLDER}/`)) {
    throw new PathError('note is already archived')
  }

  const absolute = await resolveNotePath(root, relative)
  const destinationDir = path.join(root, ARCHIVE_FOLDER, path.dirname(relative))
  await fs.mkdir(destinationDir, { recursive: true })
  const destination = await uniquePath(destinationDir, path.basename(absolute))

  await fs.rename(absolute, destination)
  dropCached(absolute)
  const rootReal = await fs.realpath(root)
  return { path: toPosix(path.relative(rootReal, destination)) }
}

export async function restoreNote(relative: string): Promise<{ path: string }> {
  const root = await assertVault()
  if (!relative.startsWith(`${ARCHIVE_FOLDER}/`)) {
    throw new PathError('note is not archived')
  }

  const absolute = await resolveNotePath(root, relative)
  const original = relative.slice(ARCHIVE_FOLDER.length + 1)
  const destinationDir = path.join(root, path.dirname(original))
  await fs.mkdir(destinationDir, { recursive: true })
  const destination = await uniquePath(destinationDir, path.basename(absolute))

  await fs.rename(absolute, destination)
  dropCached(absolute)
  const rootReal = await fs.realpath(root)
  return { path: toPosix(path.relative(rootReal, destination)) }
}

export async function searchNotes(query: string): Promise<SearchHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const root = await assertVault()
  const listing = await listVault()
  const needle = trimmed.toLowerCase()
  const hits: SearchHit[] = []

  for (const note of listing.notes) {
    const content = getCached(path.join(/* turbopackIgnore: true */ root, note.path))?.content ?? ''
    const titleMatches = note.title.toLowerCase().includes(needle)
    const contentMatches = content.toLowerCase().includes(needle)
    if (!titleMatches && !contentMatches) continue

    const source = titleMatches ? note.title : content
    const at = Math.max(0, source.toLowerCase().indexOf(needle))
    const start = Math.max(0, at - 60)
    const snippet = source.slice(start, start + 160).replace(/\s+/g, ' ').trim()
    hits.push({ ...note, snippet })
  }

  return hits
}
