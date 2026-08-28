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

describe('captureCliConnectionTabClick', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('captures the tab click with the connection id', async () => {
    const { initPostHog, captureCliConnectionTabClick } =
      await import('./posthog')
    initPostHog()
    captureCliConnectionTabClick('cloud')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:cli_connection_tab_clicked',
      { connection: 'cloud' }
    )
  })

  it('does not capture before PostHog is initialized', async () => {
    const { captureCliConnectionTabClick } = await import('./posthog')
    captureCliConnectionTabClick('local')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})

describe('captureCliClientTabClick', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('captures the tab click with the client id', async () => {
    const { initPostHog, captureCliClientTabClick } = await import('./posthog')
    initPostHog()
    captureCliClientTabClick('claude-code')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:cli_client_tab_clicked',
      { client: 'claude-code' }
    )
  })

  it('does not capture before PostHog is initialized', async () => {
    const { captureCliClientTabClick } = await import('./posthog')
    captureCliClientTabClick('cursor')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})

describe('captureMcpClientTabClick', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('captures the tab click with the client id', async () => {
    const { initPostHog, captureMcpClientTabClick } = await import('./posthog')
    initPostHog()
    captureMcpClientTabClick('claude-code')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:mcp_client_tab_clicked',
      { client: 'claude-code' }
    )
  })

  it('does not capture before PostHog is initialized', async () => {
    const { captureMcpClientTabClick } = await import('./posthog')
    captureMcpClientTabClick('cursor')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})

describe('captureContactFormViewed', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('captures the contact form view with the locale', async () => {
    const { initPostHog, captureContactFormViewed } = await import('./posthog')
    initPostHog()
    captureContactFormViewed('zh-CN')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:contact_form_viewed',
      { locale: 'zh-CN' }
    )
  })

  it('does not capture before PostHog is initialized', async () => {
    const { captureContactFormViewed } = await import('./posthog')
    captureContactFormViewed('en')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})

describe('captureContactFormSubmitted', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('captures the contact form submission with the locale and form id', async () => {
    const { initPostHog, captureContactFormSubmitted } =
      await import('./posthog')
    initPostHog()
    captureContactFormSubmitted('en', 'form-guid')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:contact_form_submitted',
      { locale: 'en', form_id: 'form-guid' }
    )
  })

  it('does not capture before PostHog is initialized', async () => {
    const { captureContactFormSubmitted } = await import('./posthog')
    captureContactFormSubmitted('en', 'form-guid')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})

describe('captures made before initialization', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('are sent once PostHog initializes', async () => {
    const { initPostHog, captureContactFormViewed } = await import('./posthog')
    captureContactFormViewed('en')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()

    initPostHog()

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:contact_form_viewed',
      { locale: 'en' }
    )
  })

  it('are replayed in the order they were made', async () => {
    const { initPostHog, captureContactFormViewed, captureDownloadClick } =
      await import('./posthog')
    captureContactFormViewed('en')
    captureDownloadClick('mac')
    initPostHog()

    expect(hoisted.mockCapture.mock.calls.map((call) => call[0])).toEqual([
      'website:contact_form_viewed',
      'website:download_button_clicked'
    ])
  })

  it('are not replayed a second time on a repeat init', async () => {
    const { initPostHog, captureContactFormViewed } = await import('./posthog')
    captureContactFormViewed('en')
    initPostHog()
    initPostHog()

    expect(hoisted.mockCapture).toHaveBeenCalledOnce()
  })

  it('are dropped when initialization throws', async () => {
    hoisted.mockInit.mockImplementationOnce(() => {
      throw new Error('init blew up')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { initPostHog, captureContactFormViewed } = await import('./posthog')
    captureContactFormViewed('en')
    initPostHog()

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})
