import { test, expect } from '@playwright/test'

/**
 * Deleting a subject / a timetable slot prunes the attendance map
 * immediately — including the `_note` and `_sub` suffixed keys, which a
 * naive filter of exact entry ids forgets. Until this was wired, orphaned
 * rows sat in storage and in every sync payload until the boot sweep ran,
 * and that sweep is gated behind cadence_pruned_at.
 */

test('deleting a subject prunes its attendance rows immediately', async ({ page }) => {
  await page.goto('/')

  // Pick, from the demo seed, a subject that owns timetable entries plus one
  // entry from a different subject as a survival control.
  const { targetName, targetId, controlId } = await page.evaluate(() => {
    const sems = JSON.parse(localStorage.getItem('cadence_data'))
    const active = JSON.parse(localStorage.getItem('cadence_active_sem'))
    const sem = sems.find(s => String(s.id) === String(active)) ?? sems[0]
    const owner = sem.subjects.find(s => sem.timetable.some(t => String(t.subjectId) === String(s.id)))
    const control = sem.timetable.find(t => String(t.subjectId) !== String(owner.id))
    return {
      targetName: owner.name,
      targetId: String(sem.timetable.find(t => String(t.subjectId) === String(owner.id)).id),
      controlId: control ? String(control.id) : null,
    }
  })
  expect(targetId).toBeTruthy()

  // Inject marks for both: the doomed subject's entry gets a plain mark plus
  // both suffixed keys; the control gets a mark that must survive.
  await page.evaluate(({ targetId, controlId }) => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const day = { [targetId]: 'PRESENT', [`${targetId}_note`]: 'x', [`${targetId}_sub`]: '1' }
    if (controlId) day[controlId] = 'ABSENT'
    localStorage.setItem('cadence_attendance', JSON.stringify({ [dateStr]: day }))
    // The app's own resync path — providers re-read storage on this event.
    // A location.reload() races the next clicks onto the dying document.
    window.dispatchEvent(new CustomEvent('cadence-data-updated'))
  }, { targetId, controlId })
  // Delete the subject from the roster in edit mode
  await page.getByRole('button', { name: /edit/i }).first().click()
  await page.getByRole('button', { name: `Remove ${targetName}` }).click()

  await expect(page.getByText('ROSTER').first()).toBeVisible()
  // The write lands in an effect after the state commit — poll for it.
  await expect.poll(async () =>
    Object.values(await page.evaluate(() => JSON.parse(localStorage.getItem('cadence_attendance') || '{}')))
      .flatMap(day => Object.keys(day ?? {}))
  ).not.toContain(targetId)

  const settled = await page.evaluate(() => JSON.parse(localStorage.getItem('cadence_attendance') || '{}'))
  const keys = Object.values(settled).flatMap(day => Object.keys(day ?? {}))
  expect(keys).not.toContain(`${targetId}_note`)
  expect(keys).not.toContain(`${targetId}_sub`)
  if (controlId) expect(keys).toContain(controlId)
})
