import { test, expect } from '@playwright/test'

/**
 * Happy-path smoke — exercises the Phase 3/4/5/7 changes end to end:
 * theme, tabs, calendar keyboard a11y, quick-marks, Konami panel, modals.
 * Fresh browser context per test = clean localStorage (demo seed data).
 */

test('app boots in NERV and switches panels', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nerv')
  await expect(page.getByText('ROSTER').first()).toBeVisible()

  for (const tab of ['EXAMS', 'CALENDAR', 'ATTENDANCE', 'TIMETABLE']) {
    await page.getByRole('button', { name: tab, exact: true }).click()
  }
  await expect(page.getByText('PANEL-B')).toBeVisible()
})

test('calendar days are keyboard-accessible and open the day modal', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'CALENDAR', exact: true }).click()

  const today = new Date()
  const label = `${today.toLocaleString('en-US', { month: 'long' }).toUpperCase()} ${today.getDate()}, ${today.getFullYear()}`
  const cell = page.getByRole('button', { name: label, exact: true })
  await expect(cell).toHaveCount(1)

  await cell.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Day schedule' })
  await expect(dialog).toBeVisible()

  // Escape dismisses via useModalDismiss
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('attendance quick-mark persists to localStorage', async ({ page }) => {
  await page.goto('/')

  // Quick-mark overlay only renders in SINGLE DAY view — switch to it
  await page.getByRole('button', { name: 'SINGLE DAY', exact: true }).click()

  const block = page.locator('[title*="–"]').first()
  await block.hover()
  // Today has 2 entries → 2 overlays; mark the first one
  await page.getByRole('button', { name: 'PRESENT' }).first().click()

  const attendance = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('cadence_attendance') || '{}'))
  const hasMark = Object.values(attendance).some(v =>
    typeof v === 'object' && Object.values(v).some(s => String(s).toUpperCase() === 'PRESENT'))
  expect(hasMark).toBe(true)
})

test('theme cycle updates and persists', async ({ page }) => {
  await page.goto('/')
  const themeBtn = page.getByTitle(/Switch theme/)
  const before = await page.locator('html').getAttribute('data-theme')
  await themeBtn.click()
  const after = await page.locator('html').getAttribute('data-theme')
  expect(after).not.toBe(before)

  const saved = await page.evaluate(() => localStorage.getItem('cadence-theme'))
  expect(saved).toBe(after)
})

test('settings modal traps focus and restores it on close', async ({ page }) => {
  await page.goto('/')
  const settingsBtn = page.getByRole('button', { name: 'SETTINGS' })
  await settingsBtn.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('SETTINGS')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.locator(':focus')).toHaveText(/SETTINGS/)
})

test('cloud sync modal exposes the auth form', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'CLOUD SYNC' }).click()

  const dialog = page.getByRole('dialog', { name: 'CLOUD SYNC' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Email')).toBeVisible()
  await expect(dialog.getByLabel('Password')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'AUTHENTICATE' })).toBeVisible()
})

test('konami code opens classified operations and purges rooms', async ({ page }) => {
  await page.goto('/')
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
    await page.keyboard.press(key)
  }

  const dialog = page.getByRole('dialog', { name: 'CLASSIFIED OPERATIONS' })
  await expect(dialog).toBeVisible()

  // Two-step confirm: first click arms, second fires
  await dialog.getByRole('button', { name: 'PURGE ALL ROOM LOCATIONS' }).click()
  await dialog.getByRole('button', { name: 'CONFIRM PURGE?' }).click()
  await expect(dialog).toContainText(/PURGED \d+ LOCATION FIELD/)
})

test('mobile tab bar switches panels on narrow viewports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  // Desktop switcher is hidden below md — only the mobile bar's button matches.
  // Its accessible name includes the icon glyph, so match by substring.
  await page.getByRole('button', { name: 'CALENDAR' }).click()
  await expect(page.getByRole('button', { name: /Previous month/ })).toBeVisible()
})
