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
  joinWaitlist: hoisted.submit,
  preloadDownloadLinkAnalytics: hoisted.preload
}))

const APPLICATION_URL = 'https://form.typeform.com/to/UqL3PpAM'

describe('AgentBetaWaitlistForm', () => {
  let openSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    hoisted.isEnabled = true
    hoisted.submit.mockReset().mockResolvedValue(undefined)
    hoisted.preload.mockClear()
    openSpy = vi.fn()
    vi.stubGlobal('open', openSpy)
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
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('fakes success without sending anything when the honeypot is filled', async () => {
    const user = userEvent.setup()
    render(AgentBetaWaitlistForm)

    const visibleInput = screen.getByRole('textbox')
    await user.type(visibleInput, 'someone@example.com')
    const decoy = screen
      .getAllByRole('textbox', { hidden: true })
      .find((input) => input !== visibleInput)
    // Narrows, and fails on the missing honeypot rather than downstream.
    if (!decoy) throw new Error('honeypot input was not rendered')
    await fireEvent.update(decoy, 'spam corp')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    const confirmation = await screen.findByRole('status')
    expect(confirmation.textContent).toMatch(/you're on the waitlist/i)
    expect(hoisted.submit).not.toHaveBeenCalled()
    // A bot must not be handed the real application form either.
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('tracks the signup under the caller-supplied event', async () => {
    const user = userEvent.setup()
    render(AgentBetaWaitlistForm, {
      props: { signupEvent: 'cloud_beta_waitlist_joined' }
    })

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    await screen.findByRole('status')
    expect(hoisted.submit).toHaveBeenCalledWith(
      'someone@example.com',
      'cloud_beta_waitlist_joined'
    )
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
    expect(pendingButton.hasAttribute('disabled')).toBe(true)
    expect(hoisted.submit).toHaveBeenCalledWith(
      'someone@example.com',
      'agent_alpha_waitlist_joined'
    )

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
    // Retrying the capture must not spawn a second application tab.
    expect(openSpy).toHaveBeenCalledTimes(1)
  })

  it('opens the application form in a new tab on submit', async () => {
    const user = userEvent.setup()
    render(AgentBetaWaitlistForm)

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    expect(openSpy).toHaveBeenCalledWith(
      APPLICATION_URL,
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('opens the application before awaiting the capture, so the click still counts', async () => {
    // A popup blocker only honours window.open while the click's user
    // activation is live, which an awaited network call would spend.
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

    expect(screen.getByRole('button', { name: /joining/i })).toBeTruthy()
    expect(openSpy).toHaveBeenCalledOnce()

    resolveSubmit()
    await screen.findByRole('status')
  })

  it('offers a fallback link when the browser blocks the new tab', async () => {
    const user = userEvent.setup()
    render(AgentBetaWaitlistForm)

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    await screen.findByRole('status')
    const fallback = screen.getByRole('link', { name: /open them here/i })
    expect(fallback.getAttribute('href')).toBe(APPLICATION_URL)
    expect(fallback.getAttribute('target')).toBe('_blank')
    expect(fallback.getAttribute('rel')).toBe('noopener noreferrer')
  })

  // The form is the only interactive control on the agent page, so every
  // string a zh-CN visitor can reach is asserted here rather than trusting
  // the locale prop to be threaded correctly.
  describe('zh-CN', () => {
    const props = { locale: 'zh-CN' } as const

    it('labels the field and the submit control in Chinese', () => {
      render(AgentBetaWaitlistForm, { props })

      expect(screen.getByLabelText('邮箱地址')).toBeTruthy()
      expect(
        screen.getByPlaceholderText('输入你的邮箱').getAttribute('type')
      ).toBe('email')
      expect(screen.getByRole('button', { name: '加入候补名单' })).toBeTruthy()
    })

    it('reports an invalid email in Chinese', async () => {
      const user = userEvent.setup()
      render(AgentBetaWaitlistForm, { props })

      await user.type(screen.getByRole('textbox'), 'not-an-email')
      await user.click(screen.getByRole('button', { name: '加入候补名单' }))

      expect((await screen.findByRole('alert')).textContent).toContain(
        '请输入有效的邮箱地址。'
      )
      expect(hoisted.submit).not.toHaveBeenCalled()
    })

    it('reports a failed submission in Chinese', async () => {
      hoisted.submit.mockRejectedValueOnce(new Error('network down'))
      const user = userEvent.setup()
      render(AgentBetaWaitlistForm, { props })

      await user.type(screen.getByRole('textbox'), 'someone@example.com')
      await user.click(screen.getByRole('button', { name: '加入候补名单' }))

      expect((await screen.findByRole('alert')).textContent).toContain(
        '出错了，请重试。'
      )
    })

    it('shows Chinese pending text, then a confirmation naming the email', async () => {
      let resolveSubmit!: () => void
      hoisted.submit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSubmit = resolve
          })
      )
      const user = userEvent.setup()
      render(AgentBetaWaitlistForm, { props })

      await user.type(screen.getByRole('textbox'), 'someone@example.com')
      await user.click(screen.getByRole('button', { name: '加入候补名单' }))

      expect(screen.getByRole('button', { name: '提交中…' })).toBeTruthy()

      resolveSubmit()

      const confirmation = await screen.findByRole('status')
      expect(confirmation.textContent).toContain('你已加入候补名单！')
      // The {email} placeholder has to be substituted, not rendered raw.
      expect(confirmation.textContent).toContain('someone@example.com')
      expect(confirmation.textContent).not.toContain('{email}')
      // The application form stays reachable when the popup was blocked.
      expect(
        screen.getByRole('link', { name: '点这里打开' }).getAttribute('href')
      ).toBe(APPLICATION_URL)
    })
  })
})
