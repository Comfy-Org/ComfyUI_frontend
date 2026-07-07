import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useOnboarding } from './useOnboarding'

const steps = [
  { target: '#a', title: 'A', body: 'first' },
  { target: '#b', title: 'B', body: 'second' }
]
const KEY = 'test.onboarded'

describe('useOnboarding', () => {
  beforeEach(() => window.localStorage.clear())

  it('is active until finished, then persists as seen', async () => {
    const first = useOnboarding({ steps, storageKey: KEY })
    expect(first.active.value).toBe(true)
    expect(first.currentStep.value?.title).toBe('A')

    first.next()
    expect(first.currentStep.value?.title).toBe('B')
    expect(first.isLast.value).toBe(true)

    first.next()
    expect(first.active.value).toBe(false)

    // useStorage flushes the write asynchronously; let it land before a fresh instance
    // reads the persisted flag and confirms it does not re-run.
    await nextTick()
    const second = useOnboarding({ steps, storageKey: KEY })
    expect(second.active.value).toBe(false)
  })

  it('skip finishes immediately and restart re-enables', () => {
    const onboarding = useOnboarding({ steps, storageKey: KEY })
    onboarding.skip()
    expect(onboarding.active.value).toBe(false)
    onboarding.restart()
    expect(onboarding.active.value).toBe(true)
    expect(onboarding.index.value).toBe(0)
  })

  it('is inactive when there are no steps', () => {
    const onboarding = useOnboarding({ steps: [], storageKey: KEY })
    expect(onboarding.active.value).toBe(false)
  })
})
