import { createPinia, defineStore, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const trackFeatureUsed = vi.hoisted(() => vi.fn())

vi.mock('./useSurveyFeatureTracking', () => ({
  useSurveyFeatureTracking: () => ({
    trackFeatureUsed,
    useCount: ref(0)
  })
}))

const useFakeExecutionErrorStore = defineStore('fakeExecutionError', () => {
  const hasAnyError = ref(false)
  return { hasAnyError }
})

vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => useFakeExecutionErrorStore()
}))

import { useErrorSurveyTracking } from './useErrorSurveyTracking'

describe('useErrorSurveyTracking', () => {
  let scope: ReturnType<typeof effectScope>
  let store: ReturnType<typeof useFakeExecutionErrorStore>

  function setup() {
    scope = effectScope()
    scope.run(() => useErrorSurveyTracking())
  }

  beforeEach(() => {
    trackFeatureUsed.mockReset()
    setActivePinia(createPinia())
    store = useFakeExecutionErrorStore()
  })

  afterEach(() => {
    scope?.stop()
  })

  it('counts false → true transition once', async () => {
    setup()
    store.hasAnyError = true
    await nextTick()

    expect(trackFeatureUsed).toHaveBeenCalledTimes(1)
  })

  it('counts initial true state on mount', async () => {
    store.hasAnyError = true
    setup()
    await nextTick()

    expect(trackFeatureUsed).toHaveBeenCalledTimes(1)
  })

  it('does not count initial false state on mount', async () => {
    setup()
    await nextTick()

    expect(trackFeatureUsed).not.toHaveBeenCalled()
  })

  it('does not count true → false transition', async () => {
    setup()
    store.hasAnyError = true
    await nextTick()
    store.hasAnyError = false
    await nextTick()

    expect(trackFeatureUsed).toHaveBeenCalledTimes(1)
  })

  it('counts a fresh error after clear as a second use', async () => {
    setup()
    store.hasAnyError = true
    await nextTick()
    store.hasAnyError = false
    await nextTick()
    store.hasAnyError = true
    await nextTick()

    expect(trackFeatureUsed).toHaveBeenCalledTimes(2)
  })

  it('does not double-count when state stays true', async () => {
    setup()
    store.hasAnyError = true
    await nextTick()
    store.hasAnyError = true
    await nextTick()

    expect(trackFeatureUsed).toHaveBeenCalledTimes(1)
  })
})
