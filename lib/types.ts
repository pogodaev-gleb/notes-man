export type NoteMeta = {
  path: string
  title: string
  folder: string
  mtimeMs: number
  size: number
}

export type FolderInfo = {
  path: string
  name: string
  depth: number
  count: number
}

export type VaultListing = {
  folders: FolderInfo[]
  allFolders: string[]
  notes: NoteMeta[]
  total: number
}

export type SearchHit = NoteMeta & { snippet: string }

export type NoteDocument = {
  path: string
  content: string
  mtimeMs: number
}
