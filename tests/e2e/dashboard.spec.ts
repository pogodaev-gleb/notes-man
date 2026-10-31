import { expect, test } from '@playwright/test'

test('create, edit, search, archive and undo', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.header-meta')).toHaveText('1 Notizen')

  // create
  await page.getByLabel('Titel der neuen Notiz').fill('Grüße aus München')
  await page.getByRole('button', { name: 'Anlegen' }).click()

  await expect(page.getByLabel('Notiztitel')).toHaveValue('gruesse aus muenchen')
  await expect(page.locator('.note-item', { hasText: 'gruesse aus muenchen' })).toHaveCount(1)

  // edit + autosave
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('# Gruesse\n\nZeile mit Zwiebel.')
  await expect(page.locator('.status')).toHaveText('gespeichert', { timeout: 10_000 })

  // preview
  await page.getByRole('button', { name: 'Vorschau' }).click()
  await expect(page.getByRole('heading', { name: 'Gruesse' })).toBeVisible()
  await page.getByRole('button', { name: 'Quelltext' }).click()

  // search sees the saved content
  await page.getByLabel('Notizen durchsuchen').fill('zwiebel')
  await expect(page.locator('.list .section-label')).toContainText('Suche: zwiebel')
  await expect(page.locator('.note-item')).toHaveCount(1)

  // archive + undo
  await page.getByLabel('Notizen durchsuchen').fill('')
  await page.getByRole('button', { name: 'Archivieren' }).click()
  await expect(page.locator('.toast')).toContainText('Archiviert:')
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(page.locator('.toast')).toHaveCount(0)
  await expect(page.locator('.header-meta')).toHaveText('2 Notizen')
})
