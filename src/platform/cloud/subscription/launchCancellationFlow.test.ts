import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const showCancelSubscriptionDialog = vi.hoisted(() => vi.fn())
const launchChurnkeyCancellationMock = vi.hoisted(() => vi.fn())
const useFeatureFlagsMock = vi.hoisted(() => vi.fn())
const useChurnkeyMock = vi.hoisted(() => vi.fn())

class FakeAuthUnavailableError extends Error {
  constructor() {
    super('Churnkey auth endpoint not available')
    this.name = 'ChurnkeyAuthUnavailableError'
  }
}

vi.mock('./showCancelSubscriptionDialog', () => ({
  showCancelSubscriptionDialog
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: useFeatureFlagsMock
}))

vi.mock('@/platform/cloud/churnkey/useChurnkey', () => ({
  useChurnkey: useChurnkeyMock,
  ChurnkeyAuthUnavailableError: FakeAuthUnavailableError
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
    useChurnkeyMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('launches Churnkey when the flag is on and the embed is configured', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    useChurnkeyMock.mockReturnValue({ isConfigured: true })
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
    expect(useChurnkeyMock).not.toHaveBeenCalled()
    expect(showCancelSubscriptionDialog).toHaveBeenCalledWith('2026-12-01')
  })

  it('falls back to the legacy dialog when CHURNKEY_APP_ID is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    useChurnkeyMock.mockReturnValue({ isConfigured: false })

    await launchCancellationFlow('2026-12-01')

    expect(launchChurnkeyCancellationMock).not.toHaveBeenCalled()
    expect(showCancelSubscriptionDialog).toHaveBeenCalledWith('2026-12-01')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('CHURNKEY_APP_ID')
    )
  })

  it('falls back to the legacy dialog on ChurnkeyAuthUnavailableError', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    useChurnkeyMock.mockReturnValue({ isConfigured: true })
    launchChurnkeyCancellationMock.mockRejectedValue(
      new FakeAuthUnavailableError()
    )

    await launchCancellationFlow('2026-12-01')

    expect(showCancelSubscriptionDialog).toHaveBeenCalledWith('2026-12-01')
  })

  it('does not fall back when Churnkey throws other errors', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { churnkeyCancellationEnabled: true }
    })
    useChurnkeyMock.mockReturnValue({ isConfigured: true })
    launchChurnkeyCancellationMock.mockRejectedValue(
      new Error('something else')
    )

    await expect(launchCancellationFlow('2026-12-01')).rejects.toThrow(
      'something else'
    )
    expect(showCancelSubscriptionDialog).not.toHaveBeenCalled()
  })
})
