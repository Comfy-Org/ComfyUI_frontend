import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

const trackFeatureUsed = vi.hoisted(() => vi.fn())

vi.mock<unknown>(import('./useSurveyFeatureTracking'), () => ({
  useSurveyFeatureTracking: () => ({
    trackFeatureUsed,
    useCount: ref(0)
  })
}))

import { useErrorSurveyTracking } from './useErrorSurveyTracking'

describe('useErrorSurveyTracking', () => {
  let scope: ReturnType<typeof effectScope>
  let store: ReturnType<typeof useExecutionErrorStore>

  function setup() {
    scope = effectScope()
    scope.run(() => useErrorSurveyTracking())
  }

  beforeEach(() => {
    store = useExecutionErrorStore()
    Object.assign(store, { hasAnyError: false })
  })

  afterEach(() => {
    scope.stop()
  })

  it('counts false → true transition once', async () => {
    setup()
    Object.assign(store, { hasAnyError: true })
    await nextTick()

    expect(trackFeatureUsed).toHaveBeenCalledTimes(1)
  })

  it('counts initial true state on mount', async () => {
    Object.assign(store, { hasAnyError: true })
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
    Object.assign(store, { hasAnyError: true })
    await nextTick()
    Object.assign(store, { hasAnyError: false })
    await nextTick()

    expect(trackFeatureUsed).toHaveBeenCalledTimes(1)
  })

  it('counts a fresh error after clear as a second use', async () => {
    setup()
    Object.assign(store, { hasAnyError: true })
    await nextTick()
    Object.assign(store, { hasAnyError: false })
    await nextTick()
    Object.assign(store, { hasAnyError: true })
    await nextTick()

    expect(trackFeatureUsed).toHaveBeenCalledTimes(2)
  })

  it('does not double-count when state stays true', async () => {
    setup()
    Object.assign(store, { hasAnyError: true })
    await nextTick()
    Object.assign(store, { hasAnyError: true })
    await nextTick()

    expect(trackFeatureUsed).toHaveBeenCalledTimes(1)
  })
})
