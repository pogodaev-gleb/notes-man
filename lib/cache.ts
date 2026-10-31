export type CacheEntry = {
  mtimeMs: number
  size: number
  content: string
}

const entries = new Map<string, CacheEntry>()

export function getCached(file: string): CacheEntry | undefined {
  return entries.get(file)
}

export function setCached(file: string, entry: CacheEntry): void {
  entries.set(file, entry)
}

export function dropCached(file: string): void {
  entries.delete(file)
}

export function clearCache(): void {
  entries.clear()
}

export function cacheSize(): number {
  return entries.size
}
