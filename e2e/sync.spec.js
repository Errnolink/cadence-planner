import { test, expect } from '@playwright/test'

/**
 * Sync-layer tests — drive the real API module against a stubbed Supabase
 * REST endpoint (no real accounts, no writes to the project).
 *
 * The app boots unauthenticated, then the test exposes the live API singleton
 * via dynamic import and exercises pull/push/retry/serialization semantics.
 */

const SERVER_OLD = '2026-08-01T00:00:00.000Z' // older than LOCAL_NEW
const SERVER_NEW = '2026-08-10T00:00:00.000Z' // newer than LOCAL_NEW
const LOCAL_NEW  = '2026-08-06T00:00:00.000Z'

const row = (updatedAt, overrides = {}) => ({
  user_id: 'e2e-user',
  semesters: [{ id: 1, label: 'SERVER', subjects: [], timetable: [], exams: [] }],
  active_sem_id: 1,
  settings: { themeMode: 'dark' },
  attendance: {},
  custom_themes: [],
  theme_id: 'minimal',
  updated_at: updatedAt,
  ...overrides,
})

function setupSupabaseStub(page, { serverRow, empty = false, failPosts = 0 } = {}) {
  let active = 0
  let maxActive = 0
  let postCount = 0
  let failCount = 0
  const postBodies = []
  const calls = []

  page.route('**supabase.co/**', async (route) => {
    const req = route.request()
    const method = req.method()
    const isUpsert = method === 'POST' && req.url().includes('/rest/v1/user_data')
    calls.push({ method, url: req.url() })
    active++
    maxActive = Math.max(maxActive, active)
    // Widen the overlap window so a race would be caught
    await new Promise((r) => setTimeout(r, 50))
    try {
      if (isUpsert) {
        postCount++
        postBodies.push(req.postData())
        if (failCount < failPosts) {
          failCount++
          await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' })
          return
        }
        await route.fulfill({ status: 204, body: '' })
        return
      }
      if (method === 'GET') {
        if (empty) {
          // Real PostgREST for single-object accept: 406 + PGRST116 body
          await route.fulfill({
            status: 406,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }),
          })
          return
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(serverRow) })
        return
      }
      // Auth/heartbeat calls — neutral
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    } finally {
      active--
    }
  })

  return {
    posts: () => postCount,
    postBodies: () => postBodies,
    maxActive: () => maxActive,
    calls: () => calls,
  }
}

async function exposeApi(page) {
  await page.evaluate(async () => {
    const { API } = await import('/src/data/api.js')
    window.__api = API
    window.__syncEvents = []
    window.addEventListener('cadence-sync', (e) => window.__syncEvents.push(e.detail))
  })
}

async function seedLocal(page, { data = 'LOCAL', updatedAt = LOCAL_NEW } = {}) {
  await page.evaluate(({ data, updatedAt }) => {
    localStorage.setItem('cadence_user_id', 'e2e-user')
    localStorage.setItem('cadence_data', JSON.stringify([{ id: 1, label: data, subjects: [], timetable: [], exams: [] }]))
    localStorage.setItem('cadence_updated_at', updatedAt)
  }, { data, updatedAt })
}

test('local newer — pushes, does not overwrite local', async ({ page }) => {
  const stub = setupSupabaseStub(page, { serverRow: row(SERVER_OLD) })
  await page.goto('/')
  await exposeApi(page)
  await seedLocal(page)

  await page.evaluate(() => window.__api.syncFromServer('e2e-user'))

  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('cadence_data')))
  expect(local[0].label).toBe('LOCAL')
  expect(stub.posts()).toBe(1)
  expect(JSON.parse(stub.postBodies()[0]).semesters[0].label).toBe('LOCAL')
})

test('server newer — pulls into local, no push, legacy theme quotes stripped', async ({ page }) => {
  const stub = setupSupabaseStub(page, {
    serverRow: row(SERVER_NEW, { theme_id: '"minimal"' }), // legacy quoted theme from pre-fix client
  })
  await page.goto('/')
  await exposeApi(page)
  await seedLocal(page)
  await page.evaluate(() => localStorage.setItem('cadence-theme', 'nerv'))

  await page.evaluate(() => window.__api.syncFromServer('e2e-user'))

  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('cadence_data')))
  expect(local[0].label).toBe('SERVER')
  expect(await page.evaluate(() => localStorage.getItem('cadence_updated_at'))).toBe(SERVER_NEW)
  expect(await page.evaluate(() => localStorage.getItem('cadence-theme'))).toBe('minimal')
  expect(stub.posts()).toBe(0)
})

test('no server row (PGRST116) — pushes local data up', async ({ page }) => {
  const stub = setupSupabaseStub(page, { empty: true })
  await page.goto('/')
  await exposeApi(page)
  await seedLocal(page)

  await page.evaluate(() => window.__api.syncFromServer('e2e-user'))

  expect(stub.posts()).toBe(1)
  expect(JSON.parse(stub.postBodies()[0]).semesters[0].label).toBe('LOCAL')
})

test('failed push retries when connectivity returns', async ({ page }) => {
  const stub = setupSupabaseStub(page, { serverRow: row(SERVER_OLD), failPosts: 1 })
  await page.goto('/')
  await exposeApi(page)
  await seedLocal(page)

  await page.evaluate(() => window.__api.syncFromServer('e2e-user'))
  expect(stub.posts()).toBe(1)
  let events = await page.evaluate(() => window.__syncEvents)
  expect(events).toContain('error')

  // Simulate connectivity returning — module 'online' listener resyncs
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForTimeout(400)

  expect(stub.posts()).toBe(2)
  events = await page.evaluate(() => window.__syncEvents)
  expect(events).toContain('success')
})

test('pull and push never overlap (serialized)', async ({ page }) => {
  const stub = setupSupabaseStub(page, { serverRow: row(SERVER_OLD) })
  await page.goto('/')
  await exposeApi(page)
  await seedLocal(page)

  await Promise.all([
    page.evaluate(() => window.__api.syncToServer()),
    page.evaluate(() => window.__api.syncFromServer('e2e-user')),
  ])

  expect(stub.maxActive()).toBe(1)
})
