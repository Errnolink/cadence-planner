import { test, expect } from '@playwright/test'

/**
 * Every control must be reachable with a finger on a phone.
 *
 * `overflow: hidden` is scrollable by script but not by touch, so a control
 * pushed outside such a container is invisible AND unreachable — while
 * Playwright's own `.click()` still finds it, because auto-scroll-into-view
 * uses the scripted path. That blind spot hid the timetable's view-mode chips
 * (ALL WEEK / SINGLE DAY / FULL DAY) running off the right edge on every phone
 * width, SINGLE DAY included — the view meant for exactly that screen.
 *
 * The check: a control outside the viewport is only acceptable if some ancestor
 * is genuinely user-scrollable (overflow auto/scroll) and has room to scroll.
 */

const findUnreachable = () => {
  const vw = window.innerWidth, vh = window.innerHeight
  const out = []
  const seen = new Set()

  for (const el of document.querySelectorAll('button, a, input, select, [role="tab"], [role="menuitem"]')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right <= vw + 1 && r.left >= -1 && r.bottom <= vh + 1 && r.top >= -1) continue

    let reachable = false
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p)
      const userScrollable = /(auto|scroll)/.test(cs.overflowX + cs.overflowY)
      const hasRoom = p.scrollWidth > p.clientWidth + 1 || p.scrollHeight > p.clientHeight + 1
      if (userScrollable && hasRoom) { reachable = true; break }
    }
    if (reachable) continue

    const name = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)
    if (seen.has(name)) continue
    seen.add(name)
    out.push({ name, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], viewport: [vw, vh] })
  }
  return out
}

for (const vp of [{ width: 320, height: 640 }, { width: 390, height: 844 }]) {
  test(`every control is reachable by touch at ${vp.width}px`, async ({ page }) => {
    await page.setViewportSize(vp)
    await page.goto('/')

    for (const tab of ['TIMETABLE', 'ATTENDANCE', 'CALENDAR', 'EXAMS']) {
      await page.getByRole('tab', { name: tab }).click()
      await expect.poll(() => page.evaluate(findUnreachable), {
        message: `unreachable controls in ${tab} at ${vp.width}px`,
      }).toEqual([])
    }

    // Edit mode reveals another set of controls.
    await page.getByRole('button', { name: /edit/i }).first().click()
    await expect.poll(() => page.evaluate(findUnreachable), {
      message: `unreachable controls in EDIT MODE at ${vp.width}px`,
    }).toEqual([])
  })
}
