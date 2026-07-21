import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IWidget } from '@/lib/litegraph/src/litegraph'
import { useRemoteWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useRemoteWidget'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof axios>()
  return {
    default: {
      ...actual,
      get: vi.fn()
    }
  }
})

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

const DEFAULT_VALUE = 'Loading...'
const PROBE_RATIO = 1.05
const MAX_PROBE_DELAY = 600_000

function createMockWidget(): IWidget {
  return {
    name: 'test_widget',
    type: 'text',
    value: '',
    options: {}
  } as Partial<IWidget> as IWidget
}

function createHook() {
  return useRemoteWidget({
    remoteConfig: {
      route: `/api/test/${Math.random().toString(36).slice(2)}`,
      refresh: 0,
      max_retries: 100
    },
    defaultValue: DEFAULT_VALUE,
    node: createMockLGraphNode({
      addWidget: vi.fn(() => createMockWidget()),
      onRemoved: undefined
    }),
    widget: createMockWidget()
  })
}

async function resolveValue(hook: ReturnType<typeof useRemoteWidget>) {
  await new Promise<void>((resolve) => {
    hook.getValue(() => resolve())
  })
}

function fetchCount() {
  return vi.mocked(axios.get).mock.calls.length
}

/**
 * Returns the smallest probed delay (ms) at which a widget that has already
 * failed `failures` times is willing to attempt another fetch.
 */
async function measureBackoff(failures: number) {
  const hook = createHook()

  for (let n = 0; n < failures; n++) {
    vi.setSystemTime(Date.now() + MAX_PROBE_DELAY * 2)
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'))
    await resolveValue(hook)
  }
  expect(hook.getCacheEntry()?.retryCount).toBe(failures)

  const lastErrorTime = Date.now()
  vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'))

  for (
    let delay = 1;
    delay <= MAX_PROBE_DELAY;
    delay = Math.ceil(delay * PROBE_RATIO)
  ) {
    const before = fetchCount()
    vi.setSystemTime(lastErrorTime + delay)
    await resolveValue(hook)
    if (fetchCount() > before) return delay
  }

  throw new Error(`No retry attempted within ${MAX_PROBE_DELAY}ms`)
}

describe('useRemoteWidget retry backoff', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits strictly longer after each successive failure', async () => {
    const afterOne = await measureBackoff(1)
    const afterTwo = await measureBackoff(2)
    const afterThree = await measureBackoff(3)

    expect(afterTwo).toBeGreaterThan(afterOne)
    expect(afterThree).toBeGreaterThan(afterTwo)
  })
})
