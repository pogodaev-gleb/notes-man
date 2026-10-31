const UMLAUTS: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
  Ä: 'Ae', Ö: 'Oe', Ü: 'Ue',
}

const MAX_SLUG = 80

/** Lowercase ASCII slug: German umlauts transliterated, everything else folded. */
export function slugify(title: string): string {
  const transliterated = title.replace(/[äöüßÄÖÜ]/g, (char) => UMLAUTS[char] ?? char)
  const folded = transliterated.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  const slug = folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '')
  return slug || 'note'
}

/** Local date as YYYY-MM-DD. */
export function datePrefix(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function noteFilename(title: string, date = new Date()): string {
  return `${datePrefix(date)}-${slugify(title)}.md`
}

/** Rename keeps the original date prefix, so history stays sortable. */
export function renamedFilename(existingName: string, title: string, date = new Date()): string {
  const match = /^(\d{4}-\d{2}-\d{2})-/.exec(existingName)
  const prefix = match ? match[1] : datePrefix(date)
  return `${prefix}-${slugify(title)}.md`
}

/** Display title derived from the filename. */
export function titleFromFilename(name: string): string {
  return name
    .replace(/\.md$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/-/g, ' ')
}
