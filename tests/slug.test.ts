import { describe, expect, it } from 'vitest'
import { datePrefix, noteFilename, renamedFilename, slugify, titleFromFilename } from '@/lib/slug'

describe('slugify', () => {
  it.each([
    ['Frage Ares Apple iPhone 16', 'frage-ares-apple-iphone-16'],
    ['Über Änderungen und Größe', 'ueber-aenderungen-und-groesse'],
    ['Café au lait', 'cafe-au-lait'],
    ['  spaced   out  ', 'spaced-out'],
    ['Serviceadresse & Lieferadresse', 'serviceadresse-lieferadresse'],
    ['***', 'note'],
    ['', 'note'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('caps the slug length', () => {
    expect(slugify('a'.repeat(200)).length).toBe(80)
  })
})

describe('filenames', () => {
  const date = new Date(2026, 9, 30)

  it('builds a date-prefixed filename', () => {
    expect(noteFilename('Ticket Cart Cookie', date)).toBe('2026-10-30-ticket-cart-cookie.md')
  })

  it('keeps the original date on rename', () => {
    expect(renamedFilename('2026-01-05-old-name.md', 'New Name', date)).toBe('2026-01-05-new-name.md')
  })

  it('adds a date when the file had none', () => {
    expect(renamedFilename('loose-note.md', 'New Name', date)).toBe('2026-10-30-new-name.md')
  })

  it('formats the date prefix with zero padding', () => {
    expect(datePrefix(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('titleFromFilename', () => {
  it('strips extension and date prefix', () => {
    expect(titleFromFilename('2026-10-30-ticket-cart-cookie.md')).toBe('ticket cart cookie')
  })
})
