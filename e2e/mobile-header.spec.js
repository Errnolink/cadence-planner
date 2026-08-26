import { test, expect } from '@playwright/test'

/**
 * The header lives inside a clipping ancestor, so horizontal overflow never
 * produces a scrollbar and `document.scrollWidth === clientWidth` passes
 * while a control sits off-screen. Before the 320px fix, EDIT sat at x=356
 * on a viewport that scrolled to 337 — edit mode, and every add/delete with
 * it, was unreachable on the smallest phones with no visible symptom.
 *
 * So: measure every header child's right edge against the viewport, at every
 * width the app claims to support. (HANDOFF §9's rule, made permanent.)
 */

const WIDTHS = [320, 360, 375, 390, 412]

for (const width of WIDTHS) {
  test(`header fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')

    const kids = await page.evaluate(() => {
      const header = document.querySelector('header')
      return Array.from(header.querySelectorAll(':scope > *'))
        .map(k => {
          const r = k.getBoundingClientRect()
          return {
            text: (k.textContent || k.getAttribute('aria-label') || '').trim().slice(0, 20),
            right: Math.round(r.right),
            visible: r.width > 0 && r.height > 0,
          }
        })
        .filter(k => k.visible)
    })

    expect(kids.length).toBeGreaterThan(0)
    for (const k of kids) {
      expect.soft(k.right, `"${k.text}" overflows at ${width}px`).toBeLessThanOrEqual(width)
    }
    expect(kids.some(k => /edit/i.test(k.text)), 'EDIT control missing from header').toBe(true)

    // The tab bar must fit too — it is the other always-visible strip.
    const tabBar = await page.evaluate(() => {
      const bar = document.querySelector('nav[aria-label], [role="tablist"]')
      if (!bar) return null
      const r = bar.getBoundingClientRect()
      return Math.round(r.right)
    })
    if (tabBar !== null) expect(tabBar).toBeLessThanOrEqual(width)
  })
}
