// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import HeroWaitlist01 from './HeroWaitlist01.vue'

// The hero renders the real waitlist form, so the Customer.io module is stubbed
// here for the same reason it is in the form's own test: to control the
// write-key gate and to observe what a signup sends.
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

type HeroWaitlistProps = ComponentProps<typeof HeroWaitlist01>

const requiredProps = {
  title: 'The first agent for craft',
  signupEvent: 'agent_beta_waitlist_joined'
} satisfies HeroWaitlistProps

function renderHero(props: Partial<HeroWaitlistProps> = {}) {
  return render(HeroWaitlist01, { props: { ...requiredProps, ...props } })
}

describe('HeroWaitlist01', () => {
  beforeEach(() => {
    hoisted.isEnabled = true
    hoisted.submit.mockReset().mockResolvedValue(undefined)
    hoisted.preload.mockClear()
    vi.stubGlobal('open', vi.fn())
  })

  it('renders the title as the h1', () => {
    renderHero()

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toContain('The first agent for craft')
  })

  it('renders the badge only when badgeText is given', () => {
    const { unmount } = renderHero({ badgeText: 'AGENT' })
    expect(screen.getByText('AGENT')).toBeTruthy()
    unmount()

    renderHero()
    expect(screen.queryByText('AGENT')).toBeNull()
  })

  it('renders the subtitle only when one is given', () => {
    const subtitle = 'An agent that lives inside ComfyUI.'
    const { unmount } = renderHero({ subtitle })
    expect(screen.getByText(subtitle)).toBeTruthy()
    unmount()

    renderHero()
    expect(screen.queryByText(subtitle)).toBeNull()
  })

  it('renders the footnote alongside the form when signup is enabled', () => {
    renderHero({ footnote: "We'll email you when it's ready." })

    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(screen.getByText("We'll email you when it's ready.")).toBeTruthy()
  })

  it('hides the footnote with the form when signup is disabled', () => {
    hoisted.isEnabled = false
    renderHero({ footnote: "We'll email you when it's ready." })

    // A promise to email must never outlive the control that would collect it.
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText("We'll email you when it's ready.")).toBeNull()
    // The heading still renders, so the hero is not blank.
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
  })

  // The hero owns the only path that reaches the form's locale, so a dropped
  // prop would leave an English form under Chinese hero copy.
  it('leaves the embedded form in English by default', () => {
    renderHero()

    expect(
      screen.getByRole('button', { name: 'Join the waitlist' })
    ).toBeTruthy()
  })

  it('passes its locale down to the form', () => {
    renderHero({ locale: 'zh-CN' })

    expect(screen.getByRole('button', { name: '加入候补名单' })).toBeTruthy()
    expect(screen.getByPlaceholderText('输入你的邮箱')).toBeTruthy()
  })

  it('passes its signupEvent down to the form', async () => {
    const user = userEvent.setup()
    renderHero({ signupEvent: 'cloud_beta_waitlist_joined' })

    await user.type(screen.getByRole('textbox'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    await screen.findByRole('status')
    expect(hoisted.submit).toHaveBeenCalledWith(
      'someone@example.com',
      'cloud_beta_waitlist_joined'
    )
  })
})
