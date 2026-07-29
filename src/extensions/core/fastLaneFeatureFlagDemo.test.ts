import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    enabled: ref(false),
    fetchApi: vi.fn().mockResolvedValue(new Response()),
    recordExposure: vi.fn(),
    registerExtension: vi.fn(),
    remoteConfigState: ref<
      'unloaded' | 'anonymous' | 'authenticated' | 'error'
    >('anonymous')
  }
})

vi.mock('@/composables/useFeatureGate', () => ({
  useFeatureGate: () => ({
    value: mocks.enabled,
    recordExposure: mocks.recordExposure
  })
}))

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfigState: mocks.remoteConfigState
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
  beforeEach(() => {
    mocks.enabled.value = false
    mocks.fetchApi.mockClear()
    mocks.recordExposure.mockClear()
    mocks.remoteConfigState.value = 'anonymous'
  })

  it('records resolved decisions and only calls Cloud when enabled', async () => {
    const extension = mocks.registerExtension.mock.calls[0][0]
    extension.setup()

    mocks.remoteConfigState.value = 'authenticated'
    await nextTick()

    expect(mocks.recordExposure).toHaveBeenCalledOnce()
    expect(mocks.fetchApi).not.toHaveBeenCalled()

    mocks.remoteConfigState.value = 'anonymous'
    await nextTick()
    mocks.enabled.value = true
    mocks.remoteConfigState.value = 'authenticated'
    await nextTick()

    expect(mocks.recordExposure).toHaveBeenCalledTimes(2)
    expect(mocks.fetchApi).toHaveBeenCalledExactlyOnceWith('/fastlane-demo')
  })
})
