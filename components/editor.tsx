'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, keymap } from '@codemirror/view'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkLinkify from 'remark-linkify'
import { titleFromFilename } from '@/lib/slug'
import type { NoteDocument } from '@/lib/types'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), {
  ssr: false,
  loading: () => <div className="empty">Editor lädt…</div>,
})

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const URL_PATTERN = /(?:https?:\/\/|www\.|mailto:)[^\s<>()"'`]+/g

/** Return the URL that covers `offset` inside `text`, if any. */
function urlAt(text: string, offset: number): string | null {
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0
    if (offset >= start && offset <= start + match[0].length) {
      return match[0].startsWith('www.') ? `https://${match[0]}` : match[0]
    }
  }
  return null
}

type Props = {
  note: NoteDocument | null
  draft: string
  status: SaveStatus
  preview: boolean
  folders: string[]
  theme: 'light' | 'dark'
  onChange: (value: string) => void
  onSave: () => void
  onRename: (title: string) => void
  onArchive: () => void
  onDelete: () => void
  onMove: (folder: string) => void
  onTogglePreview: () => void
}

export function Editor({
  note,
  draft,
  status,
  preview,
  folders,
  theme,
  onChange,
  onSave,
  onRename,
  onArchive,
  onDelete,
  onMove,
  onTogglePreview,
}: Props) {
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  const [title, setTitle] = useState('')

  useEffect(() => {
    setTitle(note ? titleFromFilename(note.path.split('/').pop() ?? '') : '')
  }, [note?.path])

  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        mousedown(event, view) {
          if (!(event.metaKey || event.ctrlKey) || event.button !== 0) return false
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
          if (pos === null) return false
          const line = view.state.doc.lineAt(pos)
          const url = urlAt(line.text, pos - line.from)
          if (!url) return false
          event.preventDefault()
          window.open(url, '_blank', 'noopener,noreferrer')
          return true
        },
      }),
      keymap.of([
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            saveRef.current()
            return true
          },
        },
      ]),
    ],
    [],
  )

  if (!note) {
    return (
      <main className="editor">
        <div className="empty">Notiz auswählen oder links eine neue anlegen.</div>
      </main>
    )
  }

  const statusText =
    status === 'saving' ? 'speichert…' : status === 'saved' ? 'gespeichert' : status === 'error' ? 'Fehler' : ''

  const currentFolder = note.path.split('/').slice(0, -1).join('/') || '0-Inbox'

  return (
    <main className="editor">
      <div className="editor-bar">
        <input
          className="editor-title"
          value={title}
          aria-label="Notiztitel"
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => title !== titleFromFilename(note.path.split('/').pop() ?? '') && onRename(title)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <span className={`status${status === 'error' ? ' error' : ''}`}>{statusText}</span>
        <button onClick={onTogglePreview}>{preview ? 'Quelltext' : 'Vorschau'}</button>
        <button onClick={onSave}>Speichern</button>
        <button onClick={onArchive}>Archivieren</button>
        <button className="danger" onClick={onDelete}>
          Löschen
        </button>
        <select
          className="move-select"
          value={currentFolder}
          onChange={(e) => e.target.value !== currentFolder && onMove(e.target.value)}
          aria-label="Notiz verschieben"
        >
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="editor-body">
        {preview ? (
          <div className="preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkLinkify]}
              components={{
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {draft}
            </ReactMarkdown>
          </div>
        ) : (
          <CodeMirror
            value={draft}
            height="100%"
            theme={theme}
            extensions={extensions}
            basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
            onChange={onChange}
          />
        )}
      </div>
    </main>
  )
}
