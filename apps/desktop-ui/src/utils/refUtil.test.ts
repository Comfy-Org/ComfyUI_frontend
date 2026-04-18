import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { withSetup } from '@/test/withSetup'
import { useMinLoadingDurationRef } from '@/utils/refUtil'

describe('useMinLoadingDurationRef', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reflects false when source is initially false', () => {
    const source = ref(false)
    const result = withSetup(() => useMinLoadingDurationRef(source))
    expect(result.value).toBe(false)
  })

  it('reflects true when source is initially true', () => {
    const source = ref(true)
    const result = withSetup(() => useMinLoadingDurationRef(source))
    expect(result.value).toBe(true)
  })

  it('becomes true immediately when source transitions to true', async () => {
    const source = ref(false)
    const result = withSetup(() => useMinLoadingDurationRef(source))
    source.value = true
    await nextTick()
    expect(result.value).toBe(true)
  })

  it('stays true within minDuration after source returns to false', async () => {
    const source = ref(false)
    const result = withSetup(() => useMinLoadingDurationRef(source, 250))

    source.value = true
    await nextTick()
    source.value = false
    await nextTick()

    vi.advanceTimersByTime(100)
    await nextTick()
    expect(result.value).toBe(true)
  })

  it('becomes false after minDuration has elapsed', async () => {
    const source = ref(false)
    const result = withSetup(() => useMinLoadingDurationRef(source, 250))

    source.value = true
    await nextTick()
    source.value = false
    await nextTick()

    vi.advanceTimersByTime(250)
    await nextTick()
    expect(result.value).toBe(false)
  })

  it('remains true while source is true even after minDuration elapses', async () => {
    const source = ref(false)
    const result = withSetup(() => useMinLoadingDurationRef(source, 250))

    source.value = true
    await nextTick()
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(result.value).toBe(true)
  })

  it('works with a computed ref as input', async () => {
    const raw = ref(false)
    const source = computed(() => raw.value)
    const result = withSetup(() => useMinLoadingDurationRef(source))

    raw.value = true
    await nextTick()
    expect(result.value).toBe(true)
  })

  it('uses 250ms as default minDuration', async () => {
    const source = ref(false)
    const result = withSetup(() => useMinLoadingDurationRef(source))

    source.value = true
    await nextTick()
    source.value = false
    await nextTick()

    vi.advanceTimersByTime(249)
    await nextTick()
    expect(result.value).toBe(true)

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(result.value).toBe(false)
  })
})
