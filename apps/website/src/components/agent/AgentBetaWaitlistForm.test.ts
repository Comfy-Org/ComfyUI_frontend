// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AgentBetaWaitlistForm from './AgentBetaWaitlistForm.vue'

const hoisted = vi.hoisted(() => ({
  preload: vi.fn(),
  submit: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../../scripts/customerio', () => ({
  joinAgentBetaWaitlist: hoisted.submit,
  preloadDownloadLinkAnalytics: hoisted.preload
}))

describe('AgentBetaWaitlistForm', () => {
  beforeEach(() => {
    hoisted.submit.mockReset().mockResolvedValue(undefined)
    hoisted.preload.mockClear()
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
