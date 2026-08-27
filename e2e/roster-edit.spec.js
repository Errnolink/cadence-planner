import { test, expect } from '@playwright/test'

/**
 * The roster's edit fields call `onUpdate` unconditionally. App once dropped
 * that prop while swapping `onRemove` for the prune-aware handler, so every
 * field in this row threw `onUpdate is not a function` — through a whole green
 * suite, because nothing here exercised editing a subject.
 */

test('editing a subject in the roster commits to storage', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.goto('/')
  await page.getByRole('button', { name: /edit/i }).first().click()

  const name = page.getByRole('textbox', { name: 'Subject name' }).first()
  await name.fill('RENAMED SUBJECT')
  await name.press('Enter')

  const credits = page.getByRole('spinbutton', { name: 'Credits' }).first()
  await credits.fill('5')
  await credits.press('Enter')

  // Both fields land in the same semester record; poll because the write
  // happens in an effect after the state commit.
  await expect.poll(async () => page.evaluate(() => {
    const sems = JSON.parse(localStorage.getItem('cadence_data') || '[]')
    const active = JSON.parse(localStorage.getItem('cadence_active_sem') || 'null')
    const sem = sems.find(s => String(s.id) === String(active)) ?? sems[0]
    const s = sem?.subjects?.find(x => x.name === 'RENAMED SUBJECT')
    return s ? { name: s.name, credits: Number(s.credits) } : null
  })).toEqual({ name: 'RENAMED SUBJECT', credits: 5 })

  expect(errors).toEqual([])
})
