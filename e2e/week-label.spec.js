import { test, expect } from '@playwright/test'

/**
 * A timetable block's status badge, note marker and quick-mark toggle are
 * absolutely positioned over its text. `text-overflow: ellipsis` cannot see
 * them — the label measures as fitting, renders no ellipsis, and quietly loses
 * its last characters under an opaque badge. In ALL WEEK a column is only
 * DAY_MIN_W wide, so the badge covered the last ~14px of every subject label.
 *
 * The invariant, not the numbers: no overlay may intersect any text line. That
 * is what keeps the reserved gutters honest when an overlay changes size.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

/** Every block's text lines vs. every block's overlays. */
const collectOverlaps = () => {
  const out = []
  for (const block of document.querySelectorAll('.tt-block')) {
    const btn = block.querySelector('.tt-block-action')
    if (!btn) continue
    const lines = [...btn.querySelectorAll('span')]
      .filter(el => el.textContent.trim() && !el.closest('.sr-only'))
    const overlays = [...block.children].filter(c => c !== btn)
    for (const line of lines) {
      // Where the text is actually PAINTED: its natural extent, clipped to the
      // content box (the reserved gutter is padding, so the span keeps the
      // block's full width while its text stops short — and `overflow: hidden`
      // trims whatever still spills). Comparing border boxes would flag every
      // block, painted or not; comparing painted text is the real symptom.
      const r = line.getBoundingClientRect()
      const cs = getComputedStyle(line)
      const px = v => parseFloat(v) || 0
      const box = {
        left:   r.left   + px(cs.paddingLeft)   + px(cs.borderLeftWidth),
        right:  r.right  - px(cs.paddingRight)  - px(cs.borderRightWidth),
        top:    r.top    + px(cs.paddingTop)    + px(cs.borderTopWidth),
        bottom: r.bottom - px(cs.paddingBottom) - px(cs.borderBottomWidth),
      }
      const range = document.createRange()
      range.selectNodeContents(line)
      const text = range.getBoundingClientRect()
      range.detach?.()
      const l = {
        left:   Math.max(text.left, box.left),
        right:  Math.min(text.right, box.right),
        top:    Math.max(text.top, box.top),
        bottom: Math.min(text.bottom, box.bottom),
      }
      if (l.right - l.left <= 0.5 || l.bottom - l.top <= 0.5) continue

      for (const ov of overlays) {
        const o = ov.getBoundingClientRect()
        if (o.width === 0 || o.height === 0) continue
        const overlaps = o.left < l.right - 0.5 && o.right > l.left + 0.5
          && o.top < l.bottom - 0.5 && o.bottom > l.top + 0.5
        if (overlaps) {
          out.push({
            line: line.textContent.trim(),
            overlay: ov.textContent.trim().slice(0, 16) || '(toggle)',
            textRect: [Math.round(l.left), Math.round(l.right)],
            overlayRect: [Math.round(o.left), Math.round(o.right)],
          })
        }
      }
    }
  }
  return out
}

async function seed(page) {
  await page.evaluate(() => {
    const sems = JSON.parse(localStorage.getItem('cadence_data'))
    const active = JSON.parse(localStorage.getItem('cadence_active_sem'))
    const sem = sems.find(s => String(s.id) === String(active)) ?? sems[0]
    sem.subjects = [
      // Codes long enough to actually reach the overlay. A short code never
      // does, which is why this went unnoticed: at DAY_MIN_W the text box is
      // ~58px and the badge covers its last ~14px, so only a label that fills
      // the column loses anything — and it loses its ellipsis first, which is
      // exactly the signal that would otherwise say "there is more here".
      { id: 'p1', name: 'ENGINEERING MATHEMATICS III', code: 'MAT301X-LAB', credits: 4, colorIdx: 0, gradePoint: null },
      { id: 'p2', name: 'PROFESSIONAL ETHICS', code: 'HUM4021-TUT', credits: 3, colorIdx: 1, gradePoint: null },
    ]
    const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    sem.timetable = DAYS.flatMap((day, i) => ([
      { id: `e${i}a`, subjectId: 'p1', day, startTime: '09:00', endTime: '10:30', room: 'A101-ANNEXE' },
      { id: `e${i}b`, subjectId: 'p2', day, startTime: '11:00', endTime: '11:30', room: 'B202-ANNEXE' },
    ]))
    delete sem.startDate; delete sem.endDate
    localStorage.setItem('cadence_data', JSON.stringify(sems))

    // Mark and annotate every day of the shown week so both overlays render.
    const monday = new Date()
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const att = {}
    DAYS.forEach((_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      att[ds] = { [`e${i}a`]: 'PRESENT', [`e${i}a_note`]: 'ring the bell', [`e${i}b`]: 'ABSENT' }
    })
    localStorage.setItem('cadence_attendance', JSON.stringify(att))
    window.dispatchEvent(new CustomEvent('cadence-data-updated'))
  })
}

test('ALL WEEK — no overlay covers a block label', async ({ page }) => {
  await page.goto('/')
  await seed(page)
  await page.getByRole('tab', { name: 'TIMETABLE' }).click()
  await expect(page.getByRole('button', { name: 'ALL WEEK', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.tt-block').length)).toBeGreaterThan(0)

  expect(await page.evaluate(collectOverlaps)).toEqual([])
})

// Latent rather than live: SINGLE DAY gives the column the full width, so
// today's labels do not currently reach the toggle. It guards the reserved
// TOGGLE_GUTTER against a narrower column or a longer status word.
test('SINGLE DAY — the quick-mark toggle does not cover the label either', async ({ page }) => {
  await page.goto('/')
  await seed(page)
  await page.getByRole('tab', { name: 'TIMETABLE' }).click()
  await page.getByRole('button', { name: 'SINGLE DAY', exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.tt-block').length)).toBeGreaterThan(0)

  expect(await page.evaluate(collectOverlaps)).toEqual([])
})
