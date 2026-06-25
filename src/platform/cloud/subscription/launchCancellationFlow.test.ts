import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ChurnkeyAuthUnavailableError,
  ChurnkeyEmbedLoadError
} from '@/platform/cloud/churnkey/errors'

const showCancelSubscriptionDialog = vi.hoisted(() => vi.fn())
const launchChurnkeyCancellationMock = vi.hoisted(() => vi.fn())
const useFeatureFlagsMock = vi.hoisted(() => vi.fn())
const isChurnkeyConfiguredMock = vi.hoisted(() => vi.fn())

vi.mock('./showCancelSubscriptionDialog', () => ({
  showCancelSubscriptionDialog
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: useFeatureFlagsMock
}))

vi.mock('@/platform/cloud/churnkey/churnkeyClient', () => ({
  isChurnkeyConfigured: isChurnkeyConfiguredMock
}))

vi.mock('@/platform/cloud/churnkey/launchChurnkeyCancellation', () => ({
  launchChurnkeyCancellation: launchChurnkeyCancellationMock
}))

const { launchCancellationFlow } = await import('./launchCancellationFlow')

describe('launchCancellationFlow', () => {
  beforeEach(() => {
    showCancelSubscriptionDialog.mockReset()
    launchChurnkeyCancellationMock.mockReset()
    useFeatureFlagsMock.mockReset()
    isChurnkeyConfiguredMock.mockReset()
  })

  it('launches Churnkey when the flag is on and the embed is configured', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    isChurnkeyConfiguredMock.mockReturnValue(true)
    launchChurnkeyCancellationMock.mockResolvedValue(undefined)

    await launchCancellationFlow('2026-12-01')

    expect(launchChurnkeyCancellationMock).toHaveBeenCalledTimes(1)
    expect(showCancelSubscriptionDialog).not.toHaveBeenCalled()
  })

  it('falls back to the legacy dialog when the flag is off', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: false }
    })

    await launchCancellationFlow('2026-12-01')

    expect(launchChurnkeyCancellationMock).not.toHaveBeenCalled()
    expect(isChurnkeyConfiguredMock).not.toHaveBeenCalled()
    expect(showCancelSubscriptionDialog).toHaveBeenCalledWith('2026-12-01')
  })

  it('falls back to the legacy dialog when CHURNKEY_APP_ID is missing', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    isChurnkeyConfiguredMock.mockReturnValue(false)

    await launchCancellationFlow('2026-12-01')

    expect(launchChurnkeyCancellationMock).not.toHaveBeenCalled()
    expect(showCancelSubscriptionDialog).toHaveBeenCalledWith('2026-12-01')
  })

  it('falls back to the legacy dialog on ChurnkeyAuthUnavailableError', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    isChurnkeyConfiguredMock.mockReturnValue(true)
    launchChurnkeyCancellationMock.mockRejectedValue(
      new ChurnkeyAuthUnavailableError()
    )

    await launchCancellationFlow('2026-12-01')

    expect(showCancelSubscriptionDialog).toHaveBeenCalledWith('2026-12-01')
  })

  it('falls back to the legacy dialog when the embed script fails to load', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    isChurnkeyConfiguredMock.mockReturnValue(true)
    launchChurnkeyCancellationMock.mockRejectedValue(
      new ChurnkeyEmbedLoadError()
    )

    await launchCancellationFlow('2026-12-01')

    expect(showCancelSubscriptionDialog).toHaveBeenCalledWith('2026-12-01')
  })

  it('does not fall back when Churnkey throws other errors', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    isChurnkeyConfiguredMock.mockReturnValue(true)
    launchChurnkeyCancellationMock.mockRejectedValue(
      new Error('something else')
    )

    await expect(launchCancellationFlow('2026-12-01')).rejects.toThrow(
      'something else'
    )
    expect(showCancelSubscriptionDialog).not.toHaveBeenCalled()
  })
})
