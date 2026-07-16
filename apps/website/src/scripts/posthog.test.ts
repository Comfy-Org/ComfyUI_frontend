// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockCapture: vi.fn()
}))

vi.mock('posthog-js', () => ({
  default: {
    init: hoisted.mockInit,
    capture: hoisted.mockCapture
  }
}))

describe('initPostHog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('passes a before_send hook to posthog.init that strips PII end-to-end', async () => {
    const { initPostHog } = await import('./posthog')
    initPostHog()

    expect(hoisted.mockInit).toHaveBeenCalledOnce()
    const initOptions = hoisted.mockInit.mock.calls[0][1]
    expect(initOptions.person_profiles).toBe('identified_only')
    expect(typeof initOptions.before_send).toBe('function')

    const event = {
      properties: {
        email: 'a@example.com',
        prompt: 'hello',
        user_email: 'b@example.com',
        $email: 'c@example.com',
        method: 'google'
      },
      $set: { email: 'd@example.com', name: 'keep me' },
      $set_once: { $email: 'e@example.com', plan: 'free' }
    }

    const result = initOptions.before_send(event)

    expect(result.properties).not.toHaveProperty('email')
    expect(result.properties).not.toHaveProperty('prompt')
    expect(result.properties).not.toHaveProperty('user_email')
    expect(result.properties).not.toHaveProperty('$email')
    expect(result.properties).toHaveProperty('method', 'google')
    expect(result.$set).not.toHaveProperty('email')
    expect(result.$set).toHaveProperty('name', 'keep me')
    expect(result.$set_once).not.toHaveProperty('$email')
    expect(result.$set_once).toHaveProperty('plan', 'free')
  })
})

describe('captureDownloadClick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('captures the download event with the platform', async () => {
    const { initPostHog, captureDownloadClick } = await import('./posthog')
    initPostHog()
    captureDownloadClick('mac')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:download_button_clicked',
      { platform: 'mac' }
    )
  })

  it('does not capture before PostHog is initialized', async () => {
    const { captureDownloadClick } = await import('./posthog')
    captureDownloadClick('windows')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})

describe('captureNavigationClick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('captures the navigation item and placement', async () => {
    const { initPostHog, captureNavigationClick } = await import('./posthog')
    initPostHog()
    captureNavigationClick('customer-stories', 'desktop-enterprise')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:navigation_clicked',
      {
        item: 'customer-stories',
        placement: 'desktop-enterprise'
      }
    )
  })
})
