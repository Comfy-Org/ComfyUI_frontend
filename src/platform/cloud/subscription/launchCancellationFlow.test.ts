import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ChurnkeyAuthUnavailableError,
  ChurnkeyEmbedLoadError
} from '@/platform/cloud/churnkey/errors'

const showCancelSubscriptionDialog = vi.hoisted(() => vi.fn())
const launchChurnkeyCancellationMock = vi.hoisted(() => vi.fn())
const isChurnkeyConfiguredMock = vi.hoisted(() => vi.fn())

vi.mock('./showCancelSubscriptionDialog', () => ({
  showCancelSubscriptionDialog
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
    isChurnkeyConfiguredMock.mockReset()
  })

  it('launches Churnkey when the churnkey_app_id flag is set', async () => {
    isChurnkeyConfiguredMock.mockReturnValue(true)
    launchChurnkeyCancellationMock.mockResolvedValue(undefined)

    await launchCancellationFlow('2026-12-01')

    expect(launchChurnkeyCancellationMock).toHaveBeenCalledTimes(1)
    expect(showCancelSubscriptionDialog).not.toHaveBeenCalled()
  })

  it('falls back to the legacy dialog when the churnkey_app_id flag is not set', async () => {
    isChurnkeyConfiguredMock.mockReturnValue(false)

    await launchCancellationFlow('2026-12-01')

    expect(launchChurnkeyCancellationMock).not.toHaveBeenCalled()
    expect(showCancelSubscriptionDialog).toHaveBeenCalledWith('2026-12-01')
  })

  it('falls back to the legacy dialog on ChurnkeyAuthUnavailableError', async () => {
    isChurnkeyConfiguredMock.mockReturnValue(true)
    launchChurnkeyCancellationMock.mockRejectedValue(
      new ChurnkeyAuthUnavailableError()
    )

    await launchCancellationFlow('2026-12-01')

    expect(showCancelSubscriptionDialog).toHaveBeenCalledWith('2026-12-01')
  })

  it('falls back to the legacy dialog when the embed script fails to load', async () => {
    isChurnkeyConfiguredMock.mockReturnValue(true)
    launchChurnkeyCancellationMock.mockRejectedValue(
      new ChurnkeyEmbedLoadError()
    )

    await launchCancellationFlow('2026-12-01')

    expect(showCancelSubscriptionDialog).toHaveBeenCalledWith('2026-12-01')
  })

  it('does not fall back when Churnkey throws other errors', async () => {
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
