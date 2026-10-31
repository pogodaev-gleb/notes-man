'use client'

import { formatWhen } from '@/lib/client'
import type { NoteMeta, SearchHit } from '@/lib/types'

type Props = {
  heading: string
  notes: (NoteMeta | SearchHit)[]
  selected: string | null
  onSelect: (path: string) => void
  emptyText: string
}

function isHit(note: NoteMeta | SearchHit): note is SearchHit {
  return 'snippet' in note
}

export function NoteList({ heading, notes, selected, onSelect, emptyText }: Props) {
  return (
    <section className="list">
      <div className="section-label">{heading}</div>
      {notes.length === 0 ? (
        <p className="empty">{emptyText}</p>
      ) : (
        notes.map((note) => (
          <button
            key={note.path}
            className={`note-item${selected === note.path ? ' active' : ''}`}
            onClick={() => onSelect(note.path)}
          >
            <div className="title">{note.title}</div>
            <div className="meta">
              {note.folder} · {formatWhen(note.mtimeMs)}
            </div>
            {isHit(note) && <div className="snippet">{note.snippet}</div>}
          </button>
        ))
      )}
    </section>
  )
}
