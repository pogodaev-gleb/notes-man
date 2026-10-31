#!/usr/bin/env node
/**
 * Import Joplin notes into the markdown vault.
 *
 *   node scripts/import-joplin.ts [--db PATH] [--target FOLDER] [--dry-run] [--raw]
 *
 * Reads Joplin's SQLite database directly, so no manual export is needed.
 * Never overwrites an existing file; duplicates get a -2, -3 suffix.
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { datePrefix, slugify } from '../lib/slug.ts'

type NoteRow = {
  title: string | null
  body: string | null
  created_time: number
  updated_time: number
}

const args = process.argv.slice(2)
const value = (name: string): string | undefined => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

const dbPath =
  value('--db') ??
  process.env.JOPLIN_DB ??
  '/mnt/c/Users/pgleb/.config/joplin-desktop/database.sqlite'
const vault = process.env.VAULT_PATH ?? '/mnt/second-brain'
const target = (value('--target') ?? '3-Resources/Joplin').replace(/^\/+|\/+$/g, '')
const dryRun = args.includes('--dry-run')
const convert = !args.includes('--raw')

if (!fs.existsSync(dbPath)) {
  console.error(`Joplin database not found: ${dbPath}`)
  process.exit(1)
}

/** Conservative Jira/Confluence markup → markdown. */
function toMarkdown(body: string): string {
  if (!convert) return body
  return body
    .replace(/^h([1-6])\.\s+/gm, (_, level: string) => `${'#'.repeat(Number(level))} `)
    .replace(/\{\{([^}\n]+)\}\}/g, '`$1`')
}

async function uniquePath(dir: string, filename: string): Promise<string> {
  const ext = path.extname(filename)
  const stem = filename.slice(0, -ext.length)
  for (let index = 1; index < 100; index += 1) {
    const candidate = index === 1 ? filename : `${stem}-${index}${ext}`
    if (!fs.existsSync(path.join(dir, candidate))) return candidate
  }
  throw new Error(`too many files named ${filename}`)
}

const scratch = path.join(os.tmpdir(), `joplin-import-${process.pid}.sqlite`)
fs.copyFileSync(dbPath, scratch)

const db = new DatabaseSync(scratch, { readOnly: true })
const rows = db
  .prepare(
    'select title, body, created_time, updated_time from notes where deleted_time = 0 order by created_time',
  )
  .all() as NoteRow[]
db.close()
fs.rmSync(scratch, { force: true })

const targetDir = path.join(vault, target)
if (!dryRun) await fsp.mkdir(targetDir, { recursive: true })

let written = 0
let skipped = 0
let canSetTimes = true

for (const row of rows) {
  const title = (row.title ?? '').trim() || 'ohne titel'
  const body = toMarkdown((row.body ?? '').replace(/\r\n/g, '\n').trim())
  if (!body) {
    skipped += 1
    continue
  }

  const filename = await uniquePath(targetDir, `${datePrefix(new Date(row.created_time))}-${slugify(title)}.md`)
  const destination = path.join(targetDir, filename)

  if (dryRun) {
    console.log(`would write ${target}/${filename}  (${body.length} chars)`)
  } else {
    await fsp.writeFile(destination, `${body}\n`, 'utf8')
    if (canSetTimes) {
      try {
        await fsp.utimes(destination, new Date(row.created_time), new Date(row.updated_time))
      } catch {
        canSetTimes = false
        console.warn('note: this filesystem refuses mtime changes, imported files keep the current time')
      }
    }
  }
  written += 1
}

console.log(
  `${dryRun ? 'dry run: ' : ''}${written} notes ${dryRun ? 'to import' : 'imported'} into ${target}` +
    (skipped ? `, ${skipped} empty notes skipped` : ''),
)
