# Plan: Notes Dashboard

Local web app over the markdown vault at `/mnt/c/Users/pgleb/Desktop/Notes`. Replaces Joplin as the
place notes are written and read.

## Decisions

| Area | Decision |
|---|---|
| Stack | Next.js 16 (App Router), TypeScript, server-side file I/O |
| Form | localhost only, `127.0.0.1:3000`, no auth |
| Vault | `/mnt/c/Users/pgleb/Desktop/Notes`, configurable via `VAULT_PATH` |
| Format | pure markdown, no frontmatter, PARA folders |
| Naming | `YYYY-MM-DD-slug.md`, slug ASCII lowercase |
| Scope | CRUD on files; no folder create/rename/delete |
| Editor | CodeMirror markdown source + preview toggle, autosave 1.5 s |
| Dashboard | PARA tree + counts, note list, recent, inbox badge |
| Search | in-memory cache, case-insensitive substring, debounced |
| Delete | move to `4-Archive`, undo toast |
| Refresh | poll 30 s + on window focus (no inotify over 9p) |
| Import | Joplin SQLite → `3-Resources/Joplin`, `scripts/import-joplin.mts` |
| Tests | vitest on fs layer, one Playwright flow |

## Vault conventions

```
/mnt/c/Users/pgleb/Desktop/Notes
├── 0-Inbox/        new notes land here by default
├── 1-Projects/     <project>/<YYYY-MM-DD-slug>.md
├── 2-Areas/
├── 3-Resources/
└── 4-Archive/      delete target, mirrors the source path
```

Slug: `ä→ae ö→oe ü→ue ß→ss`, strip other diacritics, lowercase, `[^a-z0-9]+ → -`,
trim, max 80 chars. Rename keeps the existing date prefix.

## Measured constraints (Drive mount over 9p)

| Operation | Cost |
|---|---|
| read | 4.1 ms |
| stat | 1.8 ms |
| write 1 KB | 9.3 ms |

At 500 notes: full read ≈ 2 s, stat walk ≈ 0.9 s. Hence a cache, not a per-keystroke scan.

## Architecture

```
app/
  page.tsx                     shell
  api/tree/route.ts            GET  folders + notes + counts
  api/note/route.ts            GET read · PUT save · POST create
  api/note/rename/route.ts     POST rename
  api/note/archive/route.ts    POST archive · PUT restore
  api/search/route.ts          GET substring search
components/
  workspace.tsx                client state, polling, toasts
  sidebar.tsx                  PARA tree + counts + inbox badge
  note-list.tsx                notes in selected folder
  editor.tsx                   CodeMirror + preview toggle + autosave
lib/
  vault.ts                     list/read/write/create/rename/archive/search
  paths.ts                     path validation (traversal, symlink, .md only)
  slug.ts                      slug + filename generation
  cache.ts                     content cache keyed by path, invalidated by mtime/size
tests/
  paths.test.ts
  slug.test.ts
  vault.test.ts                against a temp vault
  e2e/dashboard.spec.ts        create → edit → search → archive → undo
```

## Path safety (the only dangerous part)

Every request path goes through `resolveNotePath()`:

1. Reject absolute paths, backslashes normalised to `/`, empty segments, `.` and `..`.
2. Must end in `.md`.
3. `realpath` of the target (or its parent on create) must stay inside `realpath(VAULT_PATH)`.
4. Archive/restore resolve both source and destination through the same check.

## Cache

`Map<path, { mtimeMs, size, content }>`. `list()` walks the tree and stats; content is
re-read only when `mtimeMs` or `size` changed. Writes update the entry directly. The
client polls `/api/tree` every 30 s and on focus, which refreshes the cache.

## Steps

1. Scaffold Next.js, TS, vitest.
2. `lib/paths.ts` + `lib/slug.ts` + tests. No UI until these pass.
3. `lib/vault.ts` + `lib/cache.ts` + tests against a temp vault.
4. API routes, each one thin over `vault.ts`.
5. Sidebar + note list + recent view.
6. Editor with autosave, preview toggle, save indicator.
7. Create, rename, archive with undo toast.
8. Search with debounce.
9. Playwright flow.
10. `README.md`: how to run, `VAULT_PATH`, autostart later.

## Out of scope for v1

- Folder create/rename/delete
- Always-on service (systemd / WSL autostart)
- Remote access, auth, phone
- Backlinks, graph, tags, metrics
- Attachments and images
