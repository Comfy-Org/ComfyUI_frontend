import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  drainBackendToIdle,
  trackSubmittedPrompts,
  waitForQueueQuiet
} from '@e2e/fixtures/utils/customNodeSuite'

interface QueueSnapshot {
  Running: { id: string }[]
  Pending: { id: string }[]
}

// The drain's in-page callbacks are plain functions over `window.app.api`, so
// running them against a scripted api proves the real call sequence (which ids
// get interrupted vs deleted, and whether a cancellation pass happens at all)
// without a browser. The last snapshot repeats once the script runs out.
function scriptedPage(reads: QueueSnapshot[]) {
  const listeners: ((response: unknown) => void)[] = []
  const interrupted: string[] = []
  const deleted: string[] = []
  let read = 0
  const api = {
    getQueue: () => Promise.resolve(reads[Math.min(read++, reads.length - 1)]),
    interrupt: (id: string) => {
      interrupted.push(id)
      return Promise.resolve()
    },
    deleteItem: (type: string, id: string) => {
      deleted.push(`${type}:${id}`)
      return Promise.resolve()
    }
  }
  const page = {
    on: (event: string, listener: (response: unknown) => void) => {
      if (event === 'response') listeners.push(listener)
    },
    off: () => {},
    evaluate: async (fn: (arg?: unknown) => unknown, arg?: unknown) => {
      const saved = Reflect.get(globalThis, 'window') as unknown
      Reflect.set(globalThis, 'window', { app: { api } })
      try {
        return await fn(arg)
      } finally {
        Reflect.set(globalThis, 'window', saved)
      }
    }
  }
  return {
    page: page as unknown as Page,
    listenerCount: () => listeners.length,
    interrupted,
    deleted,
    submit: (promptId: string) => {
      for (const listener of listeners)
        listener({
          request: () => ({ method: () => 'POST' }),
          url: () => 'http://backend/api/prompt',
          status: () => 200,
          json: () => Promise.resolve({ prompt_id: promptId })
        })
    }
  }
}

const IDLE: QueueSnapshot = { Running: [], Pending: [] }

test.describe('drainBackendToIdle', () => {
  test('installing twice leaves one response listener', () => {
    const fake = scriptedPage([IDLE])
    trackSubmittedPrompts(fake.page)
    trackSubmittedPrompts(fake.page)
    expect(fake.listenerCount()).toBe(1)
  })

  test('refuses to run on a page whose submissions were never tracked', async () => {
    const fake = scriptedPage([IDLE])
    let message = ''
    await drainBackendToIdle(fake.page, 0).catch((error: unknown) => {
      message = error instanceof Error ? error.message : String(error)
    })
    expect(message).toContain('call trackSubmittedPrompts(page) in beforeEach')
  })

  test('cancels our running and pending entries before giving up on the budget', async () => {
    const fake = scriptedPage([
      { Running: [{ id: 'ours-run' }], Pending: [{ id: 'ours-pend' }] }
    ])
    trackSubmittedPrompts(fake.page)
    fake.submit('ours-run')
    fake.submit('ours-pend')
    expect(await drainBackendToIdle(fake.page, 0)).toBe(1)
    expect(fake.interrupted).toEqual(['ours-run'])
    expect(fake.deleted).toEqual(['queue:ours-pend'])
  })

  test('reports idle once our entries clear', async () => {
    const fake = scriptedPage([
      { Running: [{ id: 'ours' }], Pending: [] },
      IDLE
    ])
    trackSubmittedPrompts(fake.page)
    fake.submit('ours')
    expect(await drainBackendToIdle(fake.page, 60_000)).toBe(0)
    expect(fake.interrupted).toEqual(['ours'])
  })

  test('never touches or fails on a queue owned by another client', async () => {
    const fake = scriptedPage([
      { Running: [{ id: 'theirs' }], Pending: [{ id: 'theirs-2' }] }
    ])
    trackSubmittedPrompts(fake.page)
    fake.submit('ours')
    expect(await drainBackendToIdle(fake.page, 0)).toBe(0)
    expect(fake.interrupted).toEqual([])
    expect(fake.deleted).toEqual([])
  })

  // Pins the reason the cancellation pass sits INSIDE the poll loop: deleting a
  // pending entry cannot stop it once the backend promotes it to running, so a
  // one-shot cancel would leak it onto the shared queue.
  test('re-cancels a pending entry promoted to running between polls', async () => {
    const fake = scriptedPage([
      { Running: [], Pending: [{ id: 'ours' }] },
      { Running: [{ id: 'ours' }], Pending: [] },
      IDLE
    ])
    trackSubmittedPrompts(fake.page)
    fake.submit('ours')
    expect(await drainBackendToIdle(fake.page, 60_000)).toBe(0)
    expect(fake.deleted).toEqual(['queue:ours'])
    expect(fake.interrupted).toEqual(['ours'])
  })
})

test.describe('waitForQueueQuiet', () => {
  test('reports a busy queue it did not submit without cancelling it', async () => {
    const fake = scriptedPage([{ Running: [{ id: 'theirs' }], Pending: [] }])
    expect(await waitForQueueQuiet(fake.page, 0)).toBe(1)
    expect(fake.interrupted).toEqual([])
    expect(fake.deleted).toEqual([])
  })

  test('reports an empty queue as quiet', async () => {
    expect(await waitForQueueQuiet(scriptedPage([IDLE]).page, 0)).toBe(0)
  })
})
