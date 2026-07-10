import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useOnboarding } from './useOnboarding'

const KEY = 'test.onboarded'

describe('useOnboarding', () => {
  beforeEach(() => window.localStorage.clear())

  it('is active until finished, then persists as seen', async () => {
    const first = useOnboarding(KEY)
    expect(first.active.value).toBe(true)

    first.finish()
    expect(first.active.value).toBe(false)

    // useStorage flushes the write asynchronously; let it land before a fresh instance
    // reads the persisted flag and confirms it does not re-run.
    await nextTick()
    const second = useOnboarding(KEY)
    expect(second.active.value).toBe(false)
  })
})
