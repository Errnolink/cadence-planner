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
  const pushed = JSON.parse(stub.postBodies()[0])
  expect(pushed.semesters[0].label).toBe('LOCAL')
  // Pre-migration project: no key_updated_at column → payload must not carry it
  expect(pushed.key_updated_at).toBeUndefined()
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

// ── Per-key merge (server has the key_updated_at column) ─────────────────

const LOCAL_T = '2026-08-07T00:00:00.000Z'
const LOCAL_ATT_STAMP = '2026-08-09T00:00:00.000Z'
const SERVER_ATT = { '2026-08-01': { id: 'e1', status: 'present' } }
const LOCAL_ATT = { '2026-08-05': { id: 'e1', status: 'absent' } }

test('per-key merge — newer side wins each key, merged push', async ({ page }) => {
  const stub = setupSupabaseStub(page, {
    serverRow: row(SERVER_NEW, {
      key_updated_at: {
        semesters: SERVER_NEW,          // 08-10 > local 08-06 → server wins
        attendance: SERVER_OLD,         // 08-01 < local 08-09 → local wins
        settings: '2026-08-05T00:00:00.000Z', // > local 08-04 → server wins
        custom_themes: LOCAL_T,         // equal → keep local
        theme_id: LOCAL_T,              // equal → keep local
        active_sem_id: LOCAL_T,         // equal → keep local
      },
      attendance: SERVER_ATT,
      settings: { themeMode: 'light' },
    }),
  })
  await page.goto('/')
  await exposeApi(page)
  await page.evaluate(({ LOCAL_ATT, LOCAL_T, LOCAL_ATT_STAMP, LOCAL_NEW }) => {
    localStorage.setItem('cadence_user_id', 'e2e-user')
    localStorage.setItem('cadence_data', JSON.stringify([{ id: 1, label: 'LOCAL', subjects: [], timetable: [], exams: [] }]))
    localStorage.setItem('cadence_attendance', JSON.stringify(LOCAL_ATT))
    localStorage.setItem('cadence_settings', JSON.stringify({ themeMode: 'dark' }))
    localStorage.setItem('cadence_key_stamps', JSON.stringify({
      semesters: LOCAL_NEW,
      attendance: LOCAL_ATT_STAMP,
      settings: '2026-08-04T00:00:00.000Z',
      custom_themes: LOCAL_T,
      theme_id: LOCAL_T,
      active_sem_id: LOCAL_T,
    }))
  }, { LOCAL_ATT, LOCAL_T, LOCAL_ATT_STAMP, LOCAL_NEW })

  await page.evaluate(() => window.__api.syncFromServer('e2e-user'))

  const state = await page.evaluate(() => ({
    sems: JSON.parse(localStorage.getItem('cadence_data'))[0].label,
    att: JSON.parse(localStorage.getItem('cadence_attendance')),
    settings: JSON.parse(localStorage.getItem('cadence_settings')),
  }))
  expect(state.sems).toBe('SERVER')              // server semesters newer → pulled
  expect(state.att).toEqual(LOCAL_ATT)           // local attendance newer → kept
  expect(state.settings.themeMode).toBe('light') // server settings newer → pulled
  expect(stub.posts()).toBe(1)                   // one local-won key → merged push
  const pushed = JSON.parse(stub.postBodies()[0])
  expect(pushed.semesters[0].label).toBe('SERVER')
  expect(pushed.attendance).toEqual(LOCAL_ATT)
  expect(pushed.key_updated_at.semesters).toBe(SERVER_NEW)
  expect(pushed.key_updated_at.attendance).toBe(LOCAL_ATT_STAMP)
})

test('migrated row (column present, empty map) — proxy merge pulls, then pushes carry stamps', async ({ page }) => {
  const stub = setupSupabaseStub(page, {
    serverRow: row(SERVER_NEW, { key_updated_at: null }),
  })
  await page.goto('/')
  await exposeApi(page)
  await seedLocal(page)
  // Clear boot stamps so the proxy decision is deterministic
  await page.evaluate(() => localStorage.removeItem('cadence_key_stamps'))

  await page.evaluate(() => window.__api.syncFromServer('e2e-user'))

  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('cadence_data')))
  expect(local[0].label).toBe('SERVER') // whole-row updated_at proxies every key
  expect(stub.posts()).toBe(0)           // nothing local-newer → no push

  // Once the pull has seen the column, pushes carry the stamp map
  await page.evaluate(() => window.__api.syncToServer())
  expect(stub.posts()).toBe(1)
  expect(JSON.parse(stub.postBodies()[0]).key_updated_at.semesters).toBe(SERVER_NEW)
})

test('fresh device — full pull, never clobbers server', async ({ page }) => {
  const stub = setupSupabaseStub(page, {
    serverRow: row(SERVER_NEW, {
      key_updated_at: {
        semesters: SERVER_NEW,
        attendance: SERVER_NEW,
        settings: SERVER_NEW,
        custom_themes: SERVER_NEW,
        theme_id: SERVER_NEW,
        active_sem_id: SERVER_NEW,
      },
    }),
  })
  await page.goto('/')
  await exposeApi(page)
  // No local data, no stamps — a brand-new device

  await page.evaluate(() => window.__api.syncFromServer('e2e-user'))

  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('cadence_data')))
  expect(local[0].label).toBe('SERVER')
  expect(stub.posts()).toBe(0)
})
