import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const churnkeyCancellation = vi.hoisted(() => vi.fn())
const useFeatureFlagsMock = vi.hoisted(() => vi.fn())
const useChurnkeyMock = vi.hoisted(() => vi.fn())

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackEvent: vi.fn() })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: { value: true },
    isFreeTier: { value: false },
    type: { value: 'workspace' }
  })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: useFeatureFlagsMock
}))

vi.mock('@/platform/cloud/churnkey/useChurnkey', () => ({
  useChurnkey: useChurnkeyMock
}))

vi.mock('@/platform/cloud/churnkey/launchChurnkeyCancellation', () => ({
  launchChurnkeyCancellation: churnkeyCancellation
}))

vi.mock(
  '@/components/dialog/content/subscription/CancelSubscriptionDialogContent.vue',
  () => ({ default: { name: 'CancelSubscriptionDialogContent' } })
)

import { useDialogService } from '@/services/dialogService'

describe('launchCancellationFlow', () => {
  beforeEach(() => {
    showDialog.mockReset()
    churnkeyCancellation.mockReset()
    useFeatureFlagsMock.mockReset()
    useChurnkeyMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('launches Churnkey when flag is enabled and configured', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    useChurnkeyMock.mockReturnValue({ isConfigured: true })

    await useDialogService().launchCancellationFlow('2026-12-01')

    expect(churnkeyCancellation).toHaveBeenCalledTimes(1)
    expect(showDialog).not.toHaveBeenCalled()
  })

  it('falls back to legacy dialog when flag is enabled but Churnkey is not configured', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    useChurnkeyMock.mockReturnValue({ isConfigured: false })

    await useDialogService().launchCancellationFlow('2026-12-01')

    expect(churnkeyCancellation).not.toHaveBeenCalled()
    expect(showDialog).toHaveBeenCalledTimes(1)
    expect(showDialog.mock.calls[0][0]).toMatchObject({
      key: 'cancel-subscription',
      props: { cancelAt: '2026-12-01' }
    })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('VITE_CHURNKEY_APP_ID')
    )
  })

  it('uses the legacy dialog when flag is disabled', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: false }
    })

    await useDialogService().launchCancellationFlow('2026-12-01')

    expect(churnkeyCancellation).not.toHaveBeenCalled()
    expect(useChurnkeyMock).not.toHaveBeenCalled()
    expect(showDialog).toHaveBeenCalledTimes(1)
  })
})
