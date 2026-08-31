// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AgentBetaWaitlistForm from './AgentBetaWaitlistForm.vue'

const hoisted = vi.hoisted(() => ({
  isEnabled: true,
  preload: vi.fn(),
  submit: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../../scripts/customerio', () => ({
  get isDownloadLinkRequestEnabled() {
    return hoisted.isEnabled
  },
  joinAgentBetaWaitlist: hoisted.submit,
  preloadDownloadLinkAnalytics: hoisted.preload
}))

describe('AgentBetaWaitlistForm', () => {
  beforeEach(() => {
    hoisted.isEnabled = true
    hoisted.submit.mockReset().mockResolvedValue(undefined)
    hoisted.preload.mockClear()
  })

  it('renders nothing when the write key is not configured', () => {
    hoisted.isEnabled = false
    render(AgentBetaWaitlistForm)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(hoisted.preload).not.toHaveBeenCalled()
  })

  it('preloads the SDK when the form mounts', () => {
    render(AgentBetaWaitlistForm)
    expect(hoisted.preload).toHaveBeenCalledOnce()
  })

  it('shows an inline validation message for an invalid email and sends nothing', async () => {
    const user = userEvent.setup()
    render(AgentBetaWaitlistForm)

    await user.type(screen.getByRole('textbox'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/enter a valid email address/i)
    const input = screen.getByRole('textbox')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(alert.id)
    expect(hoisted.submit).not.toHaveBeenCalled()
  })

  it('fakes success without sending anything when the honeypot is filled', async () => {
    const user = userEvent.setup()
    render(AgentBetaWaitlistForm)

    const visibleInput = screen.getByRole('textbox')
    await user.type(visibleInput, 'someone@example.com')
    const decoy = screen
      .getAllByRole('textbox', { hidden: true })
      .find((input) => input !== visibleInput)!
    await fireEvent.update(decoy, 'spam corp')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    const confirmation = await screen.findByRole('status')
    expect(confirmation.textContent).toMatch(/you're on the waitlist/i)
    expect(hoisted.submit).not.toHaveBeenCalled()
  })

  it('shows pending feedback, then replaces the form with confirmation', async () => {
    let resolveSubmit!: () => void
    hoisted.submit.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve
        })
    )
    const user = userEvent.setup()
    render(AgentBetaWaitlistForm)

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    const pendingButton = screen.getByRole('button', { name: /joining/i })
    expect(pendingButton.getAttribute('aria-busy')).toBe('true')
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true)
    expect(hoisted.submit).toHaveBeenCalledWith('someone@example.com')

    resolveSubmit()

    const confirmation = await screen.findByRole('status')
    expect(confirmation.textContent).toMatch(/you're on the waitlist/i)
    expect(confirmation.textContent).toContain('someone@example.com')
    expect(screen.queryByRole('textbox')).toBeNull()
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(confirmation)
  })

  it('shows a retryable failure and succeeds on retry', async () => {
    hoisted.submit.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    render(AgentBetaWaitlistForm)

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /something went wrong/i
    )
    expect(screen.getByRole('textbox')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    expect((await screen.findByRole('status')).textContent).toMatch(
      /you're on the waitlist/i
    )
    expect(hoisted.submit).toHaveBeenCalledTimes(2)
  })
})
