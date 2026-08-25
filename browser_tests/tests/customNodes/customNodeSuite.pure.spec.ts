import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  drainBackendToIdle,
  installCustomNodeBlankStartup,
  runWithCollectedCleanup,
  trackSubmittedPrompts,
  waitForQueueQuiet
} from '@e2e/fixtures/utils/customNodeSuite'
import type {
  ActivePathPointer,
  DraftIndexV2,
  DraftPayloadV2,
  OpenPathsPointer
} from '@/platform/workflow/persistence/base/draftTypes'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

interface QueueSnapshot {
  Running: { id: string }[]
  Pending: { id: string }[]
}

// The drain's in-page callbacks are plain functions over `window.app.api`, so
// running them against a scripted api proves the real call sequence (which ids
// get interrupted vs deleted, and whether a cancellation pass happens at all)
// without a browser. The last snapshot repeats once the script runs out.
function scriptedPage(reads: QueueSnapshot[]) {
  const listeners = new Set<(response: unknown) => void>()
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
      if (event === 'response') listeners.add(listener)
    },
    off: (event: string, listener: (response: unknown) => void) => {
      if (event === 'response') listeners.delete(listener)
    },
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
    listenerCount: () => listeners.size,
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

test('preseeds a restorable blank workflow before first boot', async ({
  page
}) => {
  const path = 'workflows/Custom Nodes E2E Blank Workflow.json'
  const draftKey = StorageKeys.draftKey(path)
  const keys = {
    index: StorageKeys.draftIndex('personal'),
    payload: StorageKeys.draftPayload(path, 'personal'),
    active: StorageKeys.lastActivePath('personal'),
    open: StorageKeys.lastOpenPaths('personal')
  }
  await installCustomNodeBlankStartup(page)
  await page.route('http://guard.test/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html></html>' })
  )
  await page.goto('http://guard.test/')

  const state = await page.evaluate(
    ({ keys, path }) => {
      const index = JSON.parse(
        localStorage.getItem(keys.index)!
      ) as DraftIndexV2
      const payload = JSON.parse(
        localStorage.getItem(keys.payload)!
      ) as DraftPayloadV2
      return {
        storedKeys: Object.keys(localStorage)
          .filter((key) => key.startsWith('Comfy.Workflow.'))
          .sort(),
        index,
        payload,
        active: JSON.parse(
          localStorage.getItem(keys.active)!
        ) as ActivePathPointer,
        open: JSON.parse(localStorage.getItem(keys.open)!) as OpenPathsPointer,
        path
      }
    },
    { keys, path }
  )

  const { updatedAt } = state.index
  expect(state.storedKeys).toEqual(Object.values(keys).sort())
  expect(updatedAt).toEqual(expect.any(Number))
  expect(state.index).toEqual({
    v: 2,
    updatedAt,
    order: [draftKey],
    entries: {
      [draftKey]: {
        path,
        name: 'Custom Nodes E2E Blank Workflow.json',
        isTemporary: true,
        updatedAt
      }
    }
  })
  expect(state.payload).toEqual({
    data: JSON.stringify({
      last_node_id: 0,
      last_link_id: 0,
      nodes: [],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4
    }),
    updatedAt
  })
  expect(state.active).toEqual({ workspaceId: 'personal', path })
  expect(state.open).toEqual({
    workspaceId: 'personal',
    paths: [path],
    activeIndex: 0
  })
})

test('preserves the test failure while every cleanup runs', async () => {
  const calls: string[] = []
  const testError = new Error('original test failure')
  const guardError = new Error('guard teardown failure')

  let thrown: unknown
  await runWithCollectedCleanup(async () => {
    calls.push('test')
    throw testError
  }, [
    async () => {
      calls.push('guard')
      throw guardError
    },
    async () => {
      calls.push('perf')
    }
  ]).catch((error: unknown) => {
    thrown = error
  })

  expect(calls).toEqual(['test', 'guard', 'perf'])
  expect(thrown).toBeInstanceOf(AggregateError)
  expect((thrown as AggregateError).errors).toEqual([testError, guardError])
})

test('rethrows a sole run or cleanup error by identity', async () => {
  const runError = new Error('run failed')
  const cleanupError = new Error('cleanup failed')

  await expect(
    runWithCollectedCleanup(async () => {
      throw runError
    }, [])
  ).rejects.toBe(runError)
  await expect(
    runWithCollectedCleanup(async () => {}, [
      async () => {
        throw cleanupError
      }
    ])
  ).rejects.toBe(cleanupError)
})

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
