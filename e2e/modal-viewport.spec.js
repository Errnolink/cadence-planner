import { test, expect } from '@playwright/test'

/**
 * Modals must position against the viewport, not against whatever tab panel
 * happens to render them.
 *
 * `.anim-tab-enter` animates with `both`, so App's tab panel keeps a transform
 * once the animation ends — and a transformed ancestor becomes the containing
 * block for `position: fixed`. Rendered in place, the day sheet sized its
 * backdrop to the tab panel and was then clipped by that panel's
 * `overflow-hidden`: on a phone the header, close button included, was cut off
 * above the visible area, and a day with a full timetable had a class list
 * running off the top with no way to reach it. Modal now portals to <body>.
 */

test.use({ viewport: { width: 390, height: 640 }, hasTouch: true, isMobile: true })

test('the day sheet fills the viewport and stays reachable with a full day', async ({ page }) => {
  await page.goto('/')

  const dateStr = await page.evaluate(() => {
    const sems = JSON.parse(localStorage.getItem('cadence_data'))
    const active = JSON.parse(localStorage.getItem('cadence_active_sem'))
    const sem = sems.find(s => String(s.id) === String(active)) ?? sems[0]
    sem.subjects = Array.from({ length: 12 }, (_, i) => ({
      id: `probe-s${i}`, name: `PROBE SUBJECT ${i}`, code: `P${i}`, credits: 3, colorIdx: i % 8, gradePoint: null,
    }))
    sem.timetable = Array.from({ length: 12 }, (_, i) => ({
      id: `probe-t${i}`, subjectId: `probe-s${i}`, day: 'MON',
      startTime: `${String(8 + i).padStart(2, '0')}:00`, endTime: `${String(9 + i).padStart(2, '0')}:00`,
      room: `R${i}`,
    }))
    delete sem.startDate; delete sem.endDate
    localStorage.setItem('cadence_data', JSON.stringify(sems))
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // this week's Monday, same month page
    window.dispatchEvent(new CustomEvent('cadence-data-updated'))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  await page.getByRole('tab', { name: 'CALENDAR' }).click()
  const d = new Date(dateStr + 'T00:00:00')
  const label = `${d.toLocaleString('en-US', { month: 'long' }).toUpperCase()} ${d.getDate()}, ${d.getFullYear()}`
  await page.getByRole('button', { name: new RegExp(`^${label}(,|$)`) }).first().click()

  const dialog = page.getByRole('dialog', { name: 'Day schedule' })
  await expect(dialog).toBeVisible()

  // No transformed ancestor may capture the fixed backdrop, and the backdrop
  // must cover the whole viewport rather than one panel of it.
  const geom = await dialog.evaluate((panel) => {
    const backdrop = panel.parentElement
    let captured = null
    for (let el = backdrop.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      const cs = getComputedStyle(el)
      if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none') {
        captured = el.tagName + '.' + String(el.className).slice(0, 40)
        break
      }
    }
    const body = panel.querySelector('.overflow-y-auto')
    return {
      captured,
      backdrop: backdrop.getBoundingClientRect().toJSON(),
      viewportH: window.innerHeight,
      viewportW: window.innerWidth,
      scrollable: body.scrollHeight > body.clientHeight,
    }
  })

  expect(geom.captured).toBeNull()
  expect(geom.backdrop.top).toBe(0)
  expect(geom.backdrop.height).toBe(geom.viewportH)
  expect(geom.backdrop.width).toBe(geom.viewportW)

  // A full day overflows — that is the case this regression is about.
  expect(geom.scrollable).toBe(true)

  // The header survived the clip: the close button is on screen and works.
  const close = dialog.getByRole('button', { name: 'Close' })
  const box = await close.boundingBox()
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(geom.viewportH)
  await close.click()
  await expect(dialog).toBeHidden()
})
