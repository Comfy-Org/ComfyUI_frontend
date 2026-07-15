import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const analytics = {
    identify: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    register: vi.fn().mockResolvedValue(undefined)
  }
  let resolvedCb: ((user: { id: string }) => void) | undefined
  let logoutCb: (() => void) | undefined
  return {
    analytics,
    load: vi.fn(() => analytics),
    inAppPlugin: vi.fn(() => ({ name: 'Customer.io In-App Plugin' })),
    userEmail: { value: null as string | null },
    onUserResolved: vi.fn((cb: (user: { id: string }) => void) => {
      resolvedCb = cb
    }),
    onUserLogout: vi.fn((cb: () => void) => {
      logoutCb = cb
    }),
    resolveUser: (id: string) => resolvedCb?.({ id }),
    logoutUser: () => logoutCb?.(),
    resetCallbacks: () => {
      resolvedCb = undefined
      logoutCb = undefined
    }
  }
})

vi.mock('@customerio/cdp-analytics-browser', () => ({
  AnalyticsBrowser: { load: hoisted.load },
  InAppPlugin: hoisted.inAppPlugin
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userEmail: hoisted.userEmail,
    onUserResolved: hoisted.onUserResolved,
    onUserLogout: hoisted.onUserLogout
  })
}))

import {
  CustomerIoTelemetryProvider,
  EVENT_SOURCE
} from './CustomerIoTelemetryProvider'

const WRITE_KEY = 'cdp_test_write_key'
const SITE_ID = 'f87746f8c188c8ddcf41'
const SOURCE = { event_source: EVENT_SOURCE }

function createProvider(
  config: Partial<typeof window.__CONFIG__> = {
    customer_io: { write_key: WRITE_KEY, site_id: SITE_ID }
  }
): CustomerIoTelemetryProvider {
  window.__CONFIG__ = config as typeof window.__CONFIG__
  return new CustomerIoTelemetryProvider()
}

function createDeferred() {
  let resolve = () => {}
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

describe('CustomerIoTelemetryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.resetCallbacks()
    hoisted.load.mockReturnValue(hoisted.analytics)
    hoisted.analytics.identify.mockResolvedValue(undefined)
    hoisted.analytics.track.mockResolvedValue(undefined)
    hoisted.analytics.register.mockResolvedValue(undefined)
    hoisted.userEmail.value = null
    window.__CONFIG__ = {} as typeof window.__CONFIG__
  })

  it('loads the client and registers the in-app plugin with the site id', async () => {
    createProvider()
    await vi.dynamicImportSettled()

    expect(hoisted.load).toHaveBeenCalledWith({ writeKey: WRITE_KEY })
    expect(hoisted.inAppPlugin).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: SITE_ID })
    )
    expect(hoisted.analytics.register).toHaveBeenCalled()
  })

  it('does not initialize without a write key', async () => {
    const provider = createProvider({ customer_io: { site_id: SITE_ID } })
    await vi.dynamicImportSettled()

    provider.trackWorkflowExecution()
    expect(hoisted.load).not.toHaveBeenCalled()
    expect(hoisted.analytics.track).not.toHaveBeenCalled()
  })

  it('does not initialize without a site id', async () => {
    createProvider({ customer_io: { write_key: WRITE_KEY } })
    await vi.dynamicImportSettled()

    expect(hoisted.load).not.toHaveBeenCalled()
  })

  it('identifies the resolved user with uid and email traits', async () => {
    createProvider()
    await vi.dynamicImportSettled()

    hoisted.userEmail.value = 'user@example.com'
    hoisted.resolveUser('test-uid-7f3a9c')

    expect(hoisted.analytics.identify).toHaveBeenCalledWith('test-uid-7f3a9c', {
      email: 'user@example.com'
    })
  })

  it('identifies with the configured user_id override without waiting for auth', async () => {
    createProvider({
      customer_io: {
        write_key: WRITE_KEY,
        site_id: SITE_ID,
        user_id: 'forced-uid'
      }
    })
    await vi.dynamicImportSettled()

    expect(hoisted.analytics.identify).toHaveBeenCalledWith(
      'forced-uid',
      undefined
    )
    expect(hoisted.onUserResolved).toHaveBeenCalledOnce()
  })

  it('re-identifies with the configured user id after logout and re-login', async () => {
    createProvider({
      customer_io: {
        write_key: WRITE_KEY,
        site_id: SITE_ID,
        user_id: 'forced-uid'
      }
    })
    await vi.dynamicImportSettled()

    hoisted.logoutUser()
    hoisted.userEmail.value = 'returning@example.com'
    hoisted.resolveUser('resolved-uid')

    expect(hoisted.analytics.reset).toHaveBeenCalledOnce()
    expect(hoisted.analytics.identify).toHaveBeenNthCalledWith(
      2,
      'forced-uid',
      { email: 'returning@example.com' }
    )
  })

  it('identifies before flushing events buffered before the SDK loads', async () => {
    const provider = createProvider({
      customer_io: {
        write_key: WRITE_KEY,
        site_id: SITE_ID,
        user_id: 'forced-uid'
      }
    })
    provider.trackWorkflowExecution()

    await vi.dynamicImportSettled()

    const identifyOrder = hoisted.analytics.identify.mock.invocationCallOrder[0]
    const trackOrder = hoisted.analytics.track.mock.invocationCallOrder[0]
    expect(identifyOrder).toBeLessThan(trackOrder)
  })

  it('resets on logout', async () => {
    createProvider()
    await vi.dynamicImportSettled()

    hoisted.logoutUser()

    expect(hoisted.analytics.reset).toHaveBeenCalledOnce()
  })

  const DIRECT_EVENTS: Array<{
    event: string
    invoke: (p: CustomerIoTelemetryProvider) => void
    expected: Record<string, unknown>
  }> = [
    {
      event: 'app:user_auth_completed',
      invoke: (p) => p.trackAuth({ method: 'google', is_new_user: true }),
      expected: { ...SOURCE, method: 'google', is_new_user: true }
    },
    {
      event: 'app:subscription_required_modal_opened',
      invoke: (p) =>
        p.trackSubscription('modal_opened', { current_tier: 'pro' }),
      expected: { ...SOURCE, current_tier: 'pro' }
    },
    {
      event: 'app:subscribe_now_button_clicked',
      invoke: (p) => p.trackSubscription('subscribe_clicked'),
      expected: SOURCE
    },
    {
      event: 'app:add_api_credit_button_clicked',
      invoke: (p) => p.trackAddApiCreditButtonClicked(),
      expected: SOURCE
    },
    {
      event: 'execution_start',
      invoke: (p) => p.trackWorkflowExecution(),
      expected: SOURCE
    },
    {
      event: 'execution_success',
      invoke: (p) => p.trackExecutionSuccess({ jobId: 'job-abc' }),
      expected: { ...SOURCE, jobId: 'job-abc' }
    },
    {
      event: 'app:template_workflow_opened',
      invoke: (p) => p.trackTemplate({ workflow_name: 'flux-dev' }),
      expected: { ...SOURCE, workflow_name: 'flux-dev' }
    },
    {
      event: 'app:template_library_opened',
      invoke: (p) => p.trackTemplateLibraryOpened({ source: 'sidebar' }),
      expected: { ...SOURCE, source: 'sidebar' }
    },
    {
      event: 'app:share_flow',
      invoke: (p) =>
        p.trackShareFlow({
          step: 'dialog_opened',
          share_id: 'share-1',
          view_mode: 'graph',
          is_app_mode: false
        }),
      expected: {
        ...SOURCE,
        step: 'dialog_opened',
        view_mode: 'graph',
        is_app_mode: false
      }
    }
  ]

  it.for(DIRECT_EVENTS)(
    'sends $event with its metadata merged under the event_source tag',
    async ({ event, invoke, expected }) => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      invoke(provider)

      expect(hoisted.analytics.track).toHaveBeenCalledWith(event, expected)
    }
  )

  it('awaits auth identification before tracking without raw identifiers', async () => {
    const identifyResult = createDeferred()
    hoisted.analytics.identify.mockReturnValueOnce(identifyResult.promise)
    const provider = createProvider()

    provider.trackAuth({
      method: 'google',
      is_new_user: true,
      user_id: 'uid-1',
      email: 'person@example.com',
      share_id: 'share-1'
    })
    await vi.dynamicImportSettled()

    expect(hoisted.analytics.identify).toHaveBeenCalledWith('uid-1', {
      email: 'person@example.com'
    })
    expect(hoisted.analytics.track).not.toHaveBeenCalled()

    identifyResult.resolve()

    await vi.waitFor(() =>
      expect(hoisted.analytics.track).toHaveBeenCalledWith(
        'app:user_auth_completed',
        {
          ...SOURCE,
          method: 'google',
          is_new_user: true,
          user_id: 'uid-1'
        }
      )
    )
    expect(hoisted.analytics.identify.mock.invocationCallOrder[0]).toBeLessThan(
      hoisted.analytics.track.mock.invocationCallOrder[0]
    )
  })

  it('tracks auth after identifying a user without an email', async () => {
    const provider = createProvider()
    await vi.dynamicImportSettled()

    provider.trackAuth({ user_id: 'uid-without-email' })

    expect(hoisted.analytics.identify).toHaveBeenCalledWith(
      'uid-without-email',
      undefined
    )
    await vi.waitFor(() =>
      expect(hoisted.analytics.track).toHaveBeenCalledWith(
        'app:user_auth_completed',
        { ...SOURCE, user_id: 'uid-without-email' }
      )
    )
  })

  it('tracks auth after identification fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    hoisted.analytics.identify.mockRejectedValueOnce(
      new Error('identify failed')
    )
    const provider = createProvider()
    await vi.dynamicImportSettled()

    provider.trackAuth({
      user_id: 'uid-1',
      email: 'person@example.com'
    })

    await vi.waitFor(() =>
      expect(hoisted.analytics.track).toHaveBeenCalledWith(
        'app:user_auth_completed',
        { ...SOURCE, user_id: 'uid-1' }
      )
    )
    expect(console.error).toHaveBeenCalledWith(
      'Failed to identify Customer.io user:',
      expect.any(Error)
    )
  })

  it('flushes events buffered before load once, in order', async () => {
    const provider = createProvider()
    provider.trackWorkflowExecution()
    provider.trackAddApiCreditButtonClicked()
    expect(hoisted.analytics.track).not.toHaveBeenCalled()

    await vi.dynamicImportSettled()

    expect(hoisted.analytics.track.mock.calls).toEqual([
      ['execution_start', SOURCE],
      ['app:add_api_credit_button_clicked', SOURCE]
    ])
  })

  it('disables tracking when the SDK fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    hoisted.load.mockImplementation(() => {
      throw new Error('network down')
    })

    const provider = createProvider()
    provider.trackWorkflowExecution()
    await vi.dynamicImportSettled()

    provider.trackWorkflowExecution()

    expect(hoisted.analytics.track).not.toHaveBeenCalled()
  })

  it('keeps tracking after an individual event fails to send', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const provider = createProvider()
    await vi.dynamicImportSettled()

    hoisted.analytics.track.mockImplementationOnce(() =>
      Promise.reject(new Error('network blip'))
    )
    provider.trackWorkflowExecution()
    provider.trackAddApiCreditButtonClicked()

    expect(hoisted.analytics.track).toHaveBeenCalledTimes(2)
    await vi.waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Failed to track Customer.io event:',
        expect.any(Error)
      )
    )
  })
})
