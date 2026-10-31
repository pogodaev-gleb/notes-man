'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { api } from '@/lib/client'
import type { NoteDocument, SearchHit, VaultListing } from '@/lib/types'
import { Editor, type SaveStatus } from './editor'
import { NoteList } from './note-list'
import { Sidebar } from './sidebar'

type Toast = { id: number; message: string; undo?: () => Promise<void> }

const AUTOSAVE_MS = 1500
const POLL_MS = 30_000

export function Workspace() {
  const [listing, setListing] = useState<VaultListing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [folder, setFolder] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState<NoteDocument | null>(null)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [preview, setPreview] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('theme')
        if (stored === 'light' || stored === 'dark') return stored
      } catch (e) {}
    }
    return 'dark'
  })

  const refresh = useCallback(async () => {
    try {
      setListing(await api<VaultListing>('/api/tree'))
      setError(null)
    } catch (cause) {
      setError((cause as Error).message)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setHits(null)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const result = await api<{ hits: SearchHit[] }>(`/api/search?q=${encodeURIComponent(trimmed)}`)
        setHits(result.hits)
      } catch (cause) {
        setError((cause as Error).message)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const openNote = useCallback(async (path: string) => {
    try {
      const document = await api<NoteDocument>(`/api/note?path=${encodeURIComponent(path)}`)
      setSelected(document.path)
      setNote(document)
      setDraft(document.content)
      setStatus('idle')
      setPreview(false)
      localStorage.setItem('lastNote', document.path)
    } catch (cause) {
      setError((cause as Error).message)
    }
  }, [])

  useEffect(() => {
    const lastNote = localStorage.getItem('lastNote')
    if (lastNote) {
      void openNote(lastNote)
    }
  }, [openNote])

  const save = useCallback(
    async (content: string) => {
      if (!note) return
      const path = note.path
      setStatus('saving')
      try {
        await api('/api/note', { method: 'PUT', body: JSON.stringify({ path, content }) })
        setNote((current) => (current && current.path === path ? { ...current, content } : current))
        setStatus('saved')
      } catch (cause) {
        setStatus('error')
        setError((cause as Error).message)
      }
    },
    [note],
  )

  useEffect(() => {
    if (!note || draft === note.content) return
    const timer = setTimeout(() => void save(draft), AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [draft, note, save])

  const createNote = useCallback(
    async (title: string, targetFolder: string) => {
      try {
        const created = await api<{ path: string }>('/api/note', {
          method: 'POST',
          body: JSON.stringify({ title, folder: targetFolder }),
        })
        await refresh()
        setQuery('')
        setFolder(targetFolder)
        await openNote(created.path)
      } catch (cause) {
        setError((cause as Error).message)
      }
    },
    [openNote, refresh],
  )

  const renameNote = useCallback(
    async (title: string) => {
      if (!note) return
      if (draft !== note.content) await save(draft)
      try {
        const renamed = await api<{ path: string }>('/api/note/rename', {
          method: 'POST',
          body: JSON.stringify({ path: note.path, title }),
        })
        await refresh()
        await openNote(renamed.path)
      } catch (cause) {
        setError((cause as Error).message)
      }
    },
    [draft, note, openNote, refresh, save],
  )

  const archiveNote = useCallback(async () => {
    if (!note) return
    const path = note.path
    try {
      const archived = await api<{ path: string }>('/api/note/archive', {
        method: 'POST',
        body: JSON.stringify({ path }),
      })
      setSelected(null)
      setNote(null)
      setDraft('')
      await refresh()
      setToast({
        id: Date.now(),
        message: `Archiviert: ${path}`,
        undo: async () => {
          await api('/api/note/archive', { method: 'PUT', body: JSON.stringify({ path: archived.path }) })
          await refresh()
        },
      })
    } catch (cause) {
      setError((cause as Error).message)
    }
  }, [note, refresh])

  const moveNote = useCallback(
    async (targetFolder: string) => {
      if (!note) return
      const path = note.path
      try {
        const moved = await api<{ path: string }>('/api/note/move', {
          method: 'POST',
          body: JSON.stringify({ path, folder: targetFolder }),
        })
        await refresh()
        await openNote(moved.path)
        setToast({
          id: Date.now(),
          message: `Verschoben nach ${targetFolder}`,
        })
      } catch (cause) {
        setError((cause as Error).message)
      }
    },
    [note, refresh, openNote],
  )

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  const visibleNotes = useMemo(() => {
    if (hits) return hits
    if (!listing) return []
    if (folder === null) return listing.notes
    return listing.notes.filter((entry) => entry.folder === folder || entry.folder.startsWith(`${folder}/`))
  }, [folder, hits, listing])

  const heading = hits ? `Suche: ${query.trim()}` : folder === null ? 'Zuletzt bearbeitet' : folder
  const emptyText = hits ? 'Keine Treffer.' : 'Keine Notizen in diesem Ordner.'
  const folders = useMemo(
    () => listing?.allFolders.sort((a, b) => a.localeCompare(b)) ?? [],
    [listing],
  )

  return (
    <>
      <div className="app">
        <header className="header">
          <span className="brand">notes</span>
          <input
            className="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Suchen…"
            aria-label="Notizen durchsuchen"
          />
          <span className="header-meta">
            {listing ? `${listing.total} Notizen` : 'lade…'}
          </span>
          <button className="ghost" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </header>

        <Sidebar
          listing={listing}
          selectedFolder={folder}
          onSelectFolder={(next) => {
            setFolder(next)
            setQuery('')
          }}
          onCreate={createNote}
        />

        {error ? (
          <section className="list">
            <div className="error-banner">{error}</div>
            <button className="ghost" onClick={() => void refresh()}>
              Erneut versuchen
            </button>
          </section>
        ) : (
          <NoteList
            heading={heading}
            notes={visibleNotes}
            selected={selected}
            onSelect={(path) => void openNote(path)}
            emptyText={emptyText}
          />
        )}

        <Editor
          note={note}
          draft={draft}
          status={status}
          preview={preview}
          folders={folders}
          theme={theme}
          onChange={setDraft}
          onSave={() => void save(draft)}
          onRename={(title) => void renameNote(title)}
          onArchive={() => void archiveNote()}
          onMove={(folder) => void moveNote(folder)}
          onTogglePreview={() => setPreview((current) => !current)}
        />
      </div>

      {toast && (
        <div className="toast">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              onClick={async () => {
                await toast.undo?.()
                setToast(null)
              }}
            >
              Rückgängig
            </button>
          )}
          <button className="ghost" onClick={() => setToast(null)}>
            Schließen
          </button>
        </div>
      )}
    </>
  )
}
