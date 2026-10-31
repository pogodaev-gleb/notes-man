'use client'

import { useState } from 'react'
import type { VaultListing } from '@/lib/types'

type Props = {
  listing: VaultListing | null
  selectedFolder: string | null
  onSelectFolder: (folder: string | null) => void
  onCreate: (title: string, folder: string) => Promise<void>
}

export function Sidebar({ listing, selectedFolder, onSelectFolder, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [folder, setFolder] = useState('0-Inbox')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      await onCreate(title.trim(), activeFolder)
      setTitle('')
    } finally {
      setBusy(false)
    }
  }

  const inbox = listing?.folders.find((entry) => entry.path === '0-Inbox')?.count ?? 0
  const folders = listing?.allFolders ?? []
  const activeFolder = folders.includes(folder) ? folder : (folders[0] ?? '0-Inbox')

  return (
    <aside className="sidebar">
      <form className="new-note" onSubmit={submit}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Neue Notiz…"
          aria-label="Titel der neuen Notiz"
        />
        <select
          value={activeFolder}
          onChange={(event) => setFolder(event.target.value)}
          aria-label="Zielordner"
        >
          {(folders.length > 0 ? folders : ['0-Inbox']).map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
        <button className="primary" type="submit" disabled={!title.trim() || busy}>
          Anlegen
        </button>
      </form>

      <div className="section-label">Ansicht</div>
      <button
        className={`folder${selectedFolder === null ? ' active' : ''}`}
        onClick={() => onSelectFolder(null)}
      >
        <span>Zuletzt bearbeitet</span>
        <span className="count">{listing?.total ?? 0}</span>
      </button>

      <div className="section-label">Ordner</div>
      {(listing?.folders ?? []).map((entry) => (
        <button
          key={entry.path}
          className={`folder${selectedFolder === entry.path ? ' active' : ''}`}
          style={{ paddingLeft: 8 + entry.depth * 12 }}
          onClick={() => onSelectFolder(entry.path)}
          title={entry.path}
        >
          <span>{entry.name}</span>
          {entry.path === '0-Inbox' && inbox > 0 ? (
            <span className="badge">{inbox}</span>
          ) : (
            <span className="count">{entry.count}</span>
          )}
        </button>
      ))}
    </aside>
  )
}
