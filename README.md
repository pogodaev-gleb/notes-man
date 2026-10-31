# Notes

Local dashboard over the markdown vault. Next.js, server-side file I/O, no database.

## Run

```bash
notes            # symlinked to ./run.sh, lives in ~/.local/bin
```

Reads `C:\Users\pgleb\Desktop\Notes` (no mount needed), starts the dev server on
port 3001 and opens the browser. Running it again while the app is up just reopens the tab.

Overrides: `VAULT_PATH=/mnt/c/Users/pgleb/Desktop/Notes PORT=3001 ./run.sh`.

Manual equivalent:

```bash
VAULT_PATH=/mnt/c/Users/pgleb/Desktop/Notes PORT=3001 pnpm dev     # http://localhost:3001
```

`VAULT_PATH` defaults to `/mnt/c/Users/pgleb/Desktop/Notes`. Production: `pnpm build && pnpm start`.

## Use

| Action | How |
|---|---|
| New note | Title + folder in the sidebar; file becomes `<folder>/YYYY-MM-DD-slug.md` |
| Edit | Type; autosave after 1.5 s, `Ctrl+S` saves now |
| Rename | Edit the title above the editor, press Enter |
| Archive | Moves the note to `4-Archive/…`, undo in the toast |
| Search | Substring over all notes, from 2 characters |

## Tests

```bash
pnpm test        # vitest: path safety, slugs, vault operations
pnpm test:e2e    # playwright: create → edit → search → archive → undo
```

`test:e2e` starts its own server on 3100, so stop `notes` first — Next allows only one dev
server per directory.

## Import from Joplin

```bash
VAULT_PATH=/mnt/c/Users/pgleb/Desktop/Notes node scripts/import-joplin.mts --dry-run   # preview
VAULT_PATH=/mnt/c/Users/pgleb/Desktop/Notes node scripts/import-joplin.mts             # write
```

Reads Joplin's SQLite database directly (no export needed), default
`/mnt/c/Users/pgleb/.config/joplin-desktop/database.sqlite`, and writes one `.md`
per note into `3-Resources/Joplin` as `YYYY-MM-DD-slug.md` using the creation date.

| Flag | Effect |
|---|---|
| `--db PATH` | different database, or set `JOPLIN_DB` |
| `--target FOLDER` | destination, default `3-Resources/Joplin` |
| `--dry-run` | list what would be written |
| `--raw` | keep the body verbatim, skip the wiki-markup conversion |

Never overwrites: existing names get `-2`, `-3`. Deleted Joplin notes and empty
bodies are skipped. Revert by deleting `3-Resources/Joplin`.

## Notes and limits

- inotify does not cross the 9p mount, so the client polls every 30 s and on window focus.
- File contents are cached by `mtimeMs` + `size`; a full read of 500 notes costs ~2 s once.
- Deleting is archiving. Google Drive syncs the move immediately and has no undo of its own.
- `next build` warns about dynamic filesystem access; it is expected, the vault is outside the project.
- The Drive mount refuses `utimes`, so imported Joplin notes all carry the import time. Their original date is in the filename.
- Joplin import reads the SQLite database directly; see the section above.
