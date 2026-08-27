import { test, expect } from '@playwright/test'

/**
 * Finger-sized targets on a touch device.
 *
 * Two mechanisms, and the choice between them is not stylistic:
 *  - `.tap-44` grows an invisible hit region around an ISOLATED control, so a
 *    deliberately small box still catches a thumb.
 *  - `.tap-grow` grows the BOX, for controls sitting shoulder to shoulder,
 *    where two 44px overlays would overlap and the loser would stop responding.
 *
 * Both are gated on `pointer: coarse`, so desktop density is untouched — which
 * is why this spec runs with `hasTouch`.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

/**
 * The control bar's three icon buttons stay 40x40 by design: its fixed floor is
 * already ~368px against a 375px screen, so widening them re-breaks the 320px
 * header. 40 clears the 24px WCAG 2.2 minimum comfortably; this is a considered
 * trade, so it is named here rather than silently excluded.
 */
const HEADER_ICON_BUTTONS = ['Theme', 'SETTINGS', 'EDIT', 'LOCK']
const FLOOR = 40

const audit = () => {
  const out = []
  for (const el of document.querySelectorAll('button, a, input, select, [role="tab"], [role="menuitem"]')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    let w = r.width, h = r.height
    // A .tap-44 pseudo-element is the real hit region.
    const after = getComputedStyle(el, '::after')
    if (after.content !== 'none' && after.position === 'absolute') {
      w = Math.max(w, parseFloat(after.width) || 0)
      h = Math.max(h, parseFloat(after.height) || 0)
    }
    out.push({
      name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28),
      w: Math.round(w),
      h: Math.round(h),
    })
  }
  return out
}

test('every control is finger-sized on a touch device', async ({ page }) => {
  await page.goto('/')
  expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true)

  for (const tab of ['TIMETABLE', 'ATTENDANCE', 'CALENDAR', 'EXAMS']) {
    await page.getByRole('tab', { name: tab }).click()
    await expect.poll(async () => {
      const controls = await page.evaluate(audit)
      return controls.filter(c => {
        const exempt = HEADER_ICON_BUTTONS.some(n => c.name.includes(n))
        const min = exempt ? FLOOR : 44
        return c.w < min || c.h < min
      })
    }, { message: `undersized tap targets in ${tab}` }).toEqual([])
  }
})
