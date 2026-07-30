import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    enabled: ref(false),
    fetchApi: vi.fn().mockResolvedValue(new Response()),
    gateState: ref<'unloaded' | 'loading' | 'resolved' | 'error'>('unloaded'),
    recordExposure: vi.fn(),
    registerExtension: vi.fn()
  }
})

vi.mock('@/composables/useFeatureGate', () => ({
  useFeatureGate: () => ({
    state: mocks.gateState,
    value: mocks.enabled,
    recordExposure: mocks.recordExposure
  })
}))

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: mocks.fetchApi
  }
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: mocks.registerExtension
  })
}))

await import('./fastLaneFeatureFlagDemo')

describe('fastLaneFeatureFlagDemo', () => {
  let scope: EffectScope

  beforeEach(() => {
    scope = effectScope()
    mocks.enabled.value = false
    mocks.fetchApi.mockClear()
    mocks.gateState.value = 'unloaded'
    mocks.recordExposure.mockClear()
  })

  afterEach(() => {
    scope.stop()
  })

  it('records resolved decisions and only calls Cloud when enabled', async () => {
    const extension = mocks.registerExtension.mock.calls[0][0]
    scope.run(() => extension.setup())

    mocks.gateState.value = 'resolved'
    await nextTick()

    expect(mocks.recordExposure).toHaveBeenCalledOnce()
    expect(mocks.fetchApi).not.toHaveBeenCalled()

    mocks.gateState.value = 'unloaded'
    await nextTick()
    mocks.enabled.value = true
    mocks.gateState.value = 'resolved'
    await nextTick()

    expect(mocks.recordExposure).toHaveBeenCalledTimes(2)
    expect(mocks.fetchApi).toHaveBeenCalledExactlyOnceWith('/fastlane-demo')
  })

  it('records an evaluation failure as OFF without calling Cloud', async () => {
    const extension = mocks.registerExtension.mock.calls[0][0]
    scope.run(() => extension.setup())

    mocks.gateState.value = 'error'
    await nextTick()

    expect(mocks.recordExposure).toHaveBeenCalledOnce()
    expect(mocks.fetchApi).not.toHaveBeenCalled()
  })
})
