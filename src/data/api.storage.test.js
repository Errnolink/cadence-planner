import { describe, it, expect } from 'vitest'

// api.js touches `window` at import time (the 'online' listener) and
// `localStorage` on every write. Neither exists in the node environment, so
// both are stubbed on globalThis BEFORE the dynamic import below — the module
// captures them at evaluation, so the order is load-bearing.
//
// This file tests the storage-failure contract of API.set (IMPROVEMENT_PLAN
// §C4 / HANDOFF §5.4): a rejected write must (a) return false, (b) leave the
// timestamp bookkeeping untouched so the provider's lastSaved ref does not
// advance, and (c) say which kind of failure it was.

function makeStorage({ failWith } = {}) {
  const map = new Map()
  return {
    map,
    setItem(k, v) {
      if (failWith) {
        const e = new Error(failWith.message)
        e.name = failWith.name
        if (failWith.code !== undefined) e.code = failWith.code
        throw e
      }
      map.set(k, String(v))
    },
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    removeItem: (k) => map.delete(k),
  }
}

async function importApiWith(storage) {
  const events = []
  globalThis.localStorage = storage
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent(e) { events.push(e.detail) },
  }
  const mod = await import('./api.js')
  return { API: mod.API, events }
}

describe('API.set storage failures', () => {
  const fresh = async (failWith) => {
    const r = await importApiWith(makeStorage({ failWith }))
    return r
  }
  it('returns true and stamps when the write lands', async () => {
    const { API, events } = await fresh()
    expect(API.set('cadence_data', [{ id: 1 }])).toBe(true)
    expect(localStorage.getItem('cadence_data')).toBe(JSON.stringify([{ id: 1 }]))
    expect(localStorage.getItem('cadence_updated_at')).toBeTruthy()
    expect(localStorage.getItem('cadence_key_stamps')).toBeTruthy()
    expect(events).toEqual([])
  })

  it('returns false, dispatches storage-full, and writes no stamps on QuotaExceededError', async () => {
    const { API, events } = await fresh({ name: 'QuotaExceededError', message: 'quota exceeded' })
    expect(API.set('cadence_data', [{ id: 1 }])).toBe(false)
    expect(events).toEqual(['storage-full'])
    expect(localStorage.getItem('cadence_updated_at')).toBeNull()
    expect(localStorage.getItem('cadence_key_stamps')).toBeNull()
  })

  it('dispatches storage-error for a non-quota failure', async () => {
    const { API, events } = await fresh({ name: 'SecurityError', message: 'denied' })
    expect(API.set('cadence_attendance', {})).toBe(false)
    expect(events).toEqual(['storage-error'])
  })

  it('recognises the legacy code-22 quota signal', async () => {
    const { API, events } = await fresh({ name: 'Error', message: 'x', code: 22 })
    expect(API.set('cadence_data', [])).toBe(false)
    expect(events).toEqual(['storage-full'])
  })

  it('skipTimestamp writes still report failure without stamping anything', async () => {
    const { API, events } = await fresh({ name: 'QuotaExceededError', message: 'q' })
    expect(API.set('cadence_settings', { a: 1 }, true)).toBe(false)
    expect(events).toEqual(['storage-full'])
    expect(localStorage.getItem('cadence_updated_at')).toBeNull()
  })
})
