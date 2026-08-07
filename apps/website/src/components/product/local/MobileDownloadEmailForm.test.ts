// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MobileDownloadEmailForm from './MobileDownloadEmailForm.vue'

const hoisted = vi.hoisted(() => ({
  isEnabled: true,
  isMobileUa: true,
  mockPreload: vi.fn(),
  mockSubmit: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../../../scripts/customerio', () => ({
  get isDownloadLinkRequestEnabled() {
    return hoisted.isEnabled
  },
  preloadDownloadLinkAnalytics: hoisted.mockPreload,
  requestDownloadLink: hoisted.mockSubmit
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

  it('shows an inline validation message for an invalid email and sends nothing', async () => {
    const user = userEvent.setup()
    render(MobileDownloadEmailForm)

    await user.type(screen.getByRole('textbox'), 'not-an-email')
    await user.click(
      screen.getByRole('button', { name: /send download link/i })
    )

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/enter a valid email address/i)
    const input = screen.getByRole('textbox')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(alert.id)
    expect(hoisted.mockSubmit).not.toHaveBeenCalled()
  })

  it('fakes success without sending anything when the honeypot is filled', async () => {
    const user = userEvent.setup()
    render(MobileDownloadEmailForm)

    const visibleInput = screen.getByRole('textbox')
    await user.type(visibleInput, 'someone@example.com')
    const decoy = screen
      .getAllByRole('textbox', { hidden: true })
      .find((input) => input !== visibleInput)!
    await fireEvent.update(decoy, 'spam corp')
    await user.click(
      screen.getByRole('button', { name: /send download link/i })
    )

    expect(
      await screen.findByText(/link is sent to someone@example\.com/i)
    ).toBeTruthy()
    expect(hoisted.mockSubmit).not.toHaveBeenCalled()
  })

  it('shows an inline error on failure and lets a retry succeed', async () => {
    const user = userEvent.setup()
    hoisted.mockSubmit.mockRejectedValueOnce(new Error('network down'))
    render(MobileDownloadEmailForm)

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    const submitButton = screen.getByRole('button', {
      name: /send download link/i
    })
    await user.click(submitButton)

    expect(await screen.findByText(/something went wrong/i)).toBeTruthy()
    expect(screen.getByRole('textbox')).toBeTruthy()

    await user.click(submitButton)

    expect(
      await screen.findByText(/link is sent to someone@example\.com/i)
    ).toBeTruthy()
    expect(hoisted.mockSubmit).toHaveBeenCalledTimes(2)
  })

  it('locks out repeat taps and signals busy while a submission is in flight', async () => {
    const user = userEvent.setup()
    let resolveSubmit!: () => void
    hoisted.mockSubmit.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve
        })
    )
    render(MobileDownloadEmailForm)

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    const submitButton = screen.getByRole('button', {
      name: /send download link/i
    })
    await user.click(submitButton)

    expect(submitButton.getAttribute('aria-busy')).toBe('true')
    expect((submitButton as HTMLButtonElement).disabled).toBe(true)

    await user.click(submitButton)
    expect(hoisted.mockSubmit).toHaveBeenCalledTimes(1)

    resolveSubmit()
    expect(
      await screen.findByText(/link is sent to someone@example\.com/i)
    ).toBeTruthy()
  })

  it('submits the entered email and swaps to the success line', async () => {
    const user = userEvent.setup()
    render(MobileDownloadEmailForm)

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    await user.click(
      screen.getByRole('button', { name: /send download link/i })
    )

    expect(hoisted.mockSubmit).toHaveBeenCalledWith('someone@example.com', 'en')
    expect(
      await screen.findByText(/link is sent to someone@example\.com/i)
    ).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('moves focus to the success message when the form is removed', async () => {
    const user = userEvent.setup()
    render(MobileDownloadEmailForm)

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    await user.click(
      screen.getByRole('button', { name: /send download link/i })
    )

    const successRegion = await screen.findByRole('status')
    expect(successRegion.textContent).toMatch(
      /link is sent to someone@example\.com/i
    )
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(successRegion)
  })

  it('forwards a non-default locale to requestDownloadLink', async () => {
    const user = userEvent.setup()
    render(MobileDownloadEmailForm, { props: { locale: 'zh-CN' } })

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: '发送下载链接' }))

    expect(hoisted.mockSubmit).toHaveBeenCalledWith(
      'someone@example.com',
      'zh-CN'
    )
  })
})
