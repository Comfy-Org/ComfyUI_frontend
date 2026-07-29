import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { remoteConfigState } from '@/platform/remoteConfig/remoteConfig'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    isActiveSubscription: ref(false),
    isLoggedIn: ref(true),
    refreshRemoteConfig: vi.fn(),
    registerExtension: vi.fn(),
    resolvedUserInfo: ref<{ id: string } | null>({ id: 'user-a' })
  }
})

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    isLoggedIn: mocks.isLoggedIn,
    resolvedUserInfo: mocks.resolvedUserInfo
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: mocks.isActiveSubscription
  })
}))

vi.mock('@/platform/remoteConfig/refreshRemoteConfig', () => ({
  refreshRemoteConfig: mocks.refreshRemoteConfig
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: mocks.registerExtension
  })
}))

await import('./cloudRemoteConfig')

describe('cloudRemoteConfig', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.isLoggedIn.value = true
    mocks.resolvedUserInfo.value = { id: 'user-a' }
    remoteConfigState.value = 'authenticated'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fails closed immediately when the authenticated user changes', async () => {
    const extension = mocks.registerExtension.mock.calls[0][0]
    await extension.setup()

    mocks.resolvedUserInfo.value = { id: 'user-b' }

    expect(remoteConfigState.value).toBe('anonymous')
  })
})
