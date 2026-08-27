import { test, expect } from '@playwright/test'

/**
 * When the sync host cannot be reached, supabase-js hands back the raw
 * `Failed to fetch` TypeError text. The app used to print it verbatim, so a
 * dead host, an offline phone and a deleted project all showed the user
 * "FAILED TO FETCH" — which reads like a fault in the app, says nothing they
 * can act on, and gives no hint that their local data is untouched.
 */

test('an unreachable sync host explains itself instead of leaking the raw error', async ({ page }) => {
  // Kill every Supabase call the way a dead DNS record would.
  await page.route('**/*.supabase.co/**', route => route.abort('namenotresolved'))

  await page.goto('/')
  await page.getByRole('button', { name: 'CLOUD SYNC' }).click()
  const dialog = page.getByRole('dialog', { name: 'CLOUD SYNC' })

  await dialog.getByRole('textbox').first().fill('probe@example.invalid')
  await dialog.locator('input[type="password"]').first().fill('not-a-real-password')
  await dialog.getByRole('button', { name: 'AUTHENTICATE' }).click()

  await expect(dialog).toContainText('CANNOT REACH THE SYNC SERVER')
  await expect(dialog).toContainText('YOUR LOCAL DATA IS SAFE')
  await expect(dialog).not.toContainText('FAILED TO FETCH')
})
