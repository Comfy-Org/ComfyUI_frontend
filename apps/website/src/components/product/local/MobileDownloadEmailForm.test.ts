// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MobileDownloadEmailForm from './MobileDownloadEmailForm.vue'

const hoisted = vi.hoisted(() => ({
  isEnabled: true,
  isMobileUa: true,
  mockPreload: vi.fn(),
  mockSubmit: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../../../composables/useDownloadLinkRequest', () => ({
  useDownloadLinkRequest: () => ({
    isEnabled: hoisted.isEnabled,
    preload: hoisted.mockPreload,
    submit: hoisted.mockSubmit
  })
}))

vi.mock('../../../composables/useDownloadUrl', async () => {
  const { computed } = await import('vue')
  return {
    useDownloadUrl: () => ({
      isMobileUa: computed(() => hoisted.isMobileUa)
    })
  }
})

describe('MobileDownloadEmailForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.isEnabled = true
    hoisted.isMobileUa = true
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when the write key is not configured', () => {
    hoisted.isEnabled = false
    render(MobileDownloadEmailForm)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('renders nothing for non-mobile user agents', () => {
    hoisted.isMobileUa = false
    render(MobileDownloadEmailForm)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('preloads the SDK when the visible form mounts', () => {
    render(MobileDownloadEmailForm)
    expect(hoisted.mockPreload).toHaveBeenCalledOnce()
  })

  it('does not preload the SDK for non-mobile user agents', () => {
    hoisted.isMobileUa = false
    render(MobileDownloadEmailForm)
    expect(hoisted.mockPreload).not.toHaveBeenCalled()
  })

  it('submits the entered email and swaps to the success line', async () => {
    const user = userEvent.setup()
    render(MobileDownloadEmailForm)

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    await user.click(
      screen.getByRole('button', { name: /send download link/i })
    )

    expect(hoisted.mockSubmit).toHaveBeenCalledWith('someone@example.com')
    expect(
      await screen.findByText(/check your email for the download link/i)
    ).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
