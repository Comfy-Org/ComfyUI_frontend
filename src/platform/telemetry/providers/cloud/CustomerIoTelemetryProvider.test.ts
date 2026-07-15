import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const analytics = {
    identify: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    register: vi.fn().mockResolvedValue(undefined)
  }
  let resolvedCb: ((user: { id: string }) => void) | undefined
  let logoutCb: (() => void) | undefined
  const resolvedUserInfo = { value: null as { id: string } | null }
  return {
    analytics,
    load: vi.fn(() => analytics),
    inAppPlugin: vi.fn(() => ({ name: 'Customer.io In-App Plugin' })),
    userEmail: { value: null as string | null },
    onUserResolved: vi.fn((cb: (user: { id: string }) => void) => {
      resolvedCb = cb
      if (resolvedUserInfo.value) cb(resolvedUserInfo.value)
    }),
    onUserLogout: vi.fn((cb: () => void) => {
      logoutCb = cb
    }),
    resolvedUserInfo,
    resolveUser: (id: string) => {
      resolvedUserInfo.value = { id }
      resolvedCb?.({ id })
    },
    logoutUser: () => {
      resolvedUserInfo.value = null
      logoutCb?.()
    },
    resetCallbacks: () => {
      resolvedCb = undefined
      logoutCb = undefined
      resolvedUserInfo.value = null
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
    resolvedUserInfo: hoisted.resolvedUserInfo,
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
    hoisted.analytics.reset.mockReset().mockResolvedValue(undefined)
    hoisted.analytics.register.mockResolvedValue(undefined)
    hoisted.userEmail.value = null
    window.__CONFIG__ = {} as typeof window.__CONFIG__
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

    await vi.waitFor(() =>
      expect(hoisted.analytics.identify).toHaveBeenCalledWith(
        'test-uid-7f3a9c',
        { email: 'user@example.com' }
      )
    )
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

  it('identifies a restored session with the configured user id once', async () => {
    hoisted.userEmail.value = 'restored@example.com'
    hoisted.resolvedUserInfo.value = { id: 'resolved-uid' }

    createProvider({
      customer_io: {
        write_key: WRITE_KEY,
        site_id: SITE_ID,
        user_id: 'forced-uid'
      }
    })
    await vi.dynamicImportSettled()

    expect(hoisted.analytics.identify).toHaveBeenCalledOnce()
    expect(hoisted.analytics.identify).toHaveBeenCalledWith('forced-uid', {
      email: 'restored@example.com'
    })
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

    await vi.waitFor(() =>
      expect(hoisted.analytics.identify).toHaveBeenNthCalledWith(
        2,
        'forced-uid',
        { email: 'returning@example.com' }
      )
    )
    expect(hoisted.analytics.reset).toHaveBeenCalledOnce()
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

  it('restores the resolved user after flushing an older auth event', async () => {
    let activeUser: string | null = null
    const trackedUsers: Array<[string, string | null]> = []
    hoisted.analytics.identify.mockImplementation((userId: string) => {
      activeUser = userId
      return Promise.resolve()
    })
    hoisted.analytics.track.mockImplementation((event: string) => {
      trackedUsers.push([event, activeUser])
      return Promise.resolve()
    })
    hoisted.userEmail.value = 'current@example.com'
    hoisted.resolvedUserInfo.value = { id: 'current-uid' }
    const provider = createProvider()

    provider.trackAuth({
      user_id: 'queued-uid',
      email: 'queued@example.com'
    })
    provider.trackWorkflowExecution()
    await vi.dynamicImportSettled()

    await vi.waitFor(() =>
      expect(hoisted.analytics.identify.mock.calls).toEqual([
        ['current-uid', { email: 'current@example.com' }],
        ['queued-uid', { email: 'queued@example.com' }],
        ['current-uid', { email: 'current@example.com' }]
      ])
    )
    expect(activeUser).toBe('current-uid')
    expect(trackedUsers).toEqual([
      ['app:user_auth_completed', 'queued-uid'],
      ['execution_start', 'current-uid']
    ])
  })

  it('resets identity after flushing auth for a signed-out user', async () => {
    let activeUser: string | null = null
    let trackedUser: string | null = null
    hoisted.analytics.identify.mockImplementation((userId: string) => {
      activeUser = userId
      return Promise.resolve()
    })
    hoisted.analytics.track.mockImplementation(() => {
      trackedUser = activeUser
      return Promise.resolve()
    })
    hoisted.analytics.reset.mockImplementation(() => {
      activeUser = null
    })
    const provider = createProvider()

    provider.trackAuth({
      user_id: 'queued-uid',
      email: 'queued@example.com'
    })
    await vi.dynamicImportSettled()

    await vi.waitFor(() => expect(hoisted.analytics.reset).toHaveBeenCalled())
    expect(trackedUser).toBe('queued-uid')
    expect(activeUser).toBeNull()
  })

  it('resets on logout', async () => {
    createProvider()
    await vi.dynamicImportSettled()

    hoisted.logoutUser()

    await vi.waitFor(() =>
      expect(hoisted.analytics.reset).toHaveBeenCalledOnce()
    )
  })

  it('continues tracking after reset fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    hoisted.analytics.reset.mockRejectedValueOnce(new Error('reset failed'))
    const provider = createProvider()
    await vi.dynamicImportSettled()

    hoisted.logoutUser()
    provider.trackWorkflowExecution()

    await vi.waitFor(() =>
      expect(hoisted.analytics.track).toHaveBeenCalledWith(
        'execution_start',
        SOURCE
      )
    )
    expect(console.error).toHaveBeenCalledWith(
      'Failed to process Customer.io operation:',
      expect.any(Error)
    )
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

      await vi.waitFor(() =>
        expect(hoisted.analytics.track).toHaveBeenCalledWith(event, expected)
      )
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

  it('reuses matching resolved-user identification for auth delivery', async () => {
    const identifyResult = createDeferred()
    hoisted.analytics.identify.mockReturnValueOnce(identifyResult.promise)
    const provider = createProvider()
    await vi.dynamicImportSettled()

    hoisted.userEmail.value = 'person@example.com'
    hoisted.resolveUser('uid-1')
    provider.trackAuth({
      user_id: 'uid-1',
      email: 'person@example.com'
    })

    await vi.waitFor(() =>
      expect(hoisted.analytics.identify).toHaveBeenCalledOnce()
    )
    expect(hoisted.analytics.track).not.toHaveBeenCalled()
    identifyResult.resolve()

    await vi.waitFor(() =>
      expect(hoisted.analytics.track).toHaveBeenCalledWith(
        'app:user_auth_completed',
        { ...SOURCE, user_id: 'uid-1' }
      )
    )
    expect(hoisted.analytics.identify).toHaveBeenCalledOnce()
  })

  it('tracks auth before resetting identity on logout', async () => {
    const identifyResult = createDeferred()
    const trackResult = createDeferred()
    let activeUser: string | null = null
    let trackedUser: string | null = null
    hoisted.analytics.identify.mockImplementationOnce((userId: string) => {
      activeUser = userId
      return identifyResult.promise
    })
    hoisted.analytics.track.mockImplementationOnce(() => {
      trackedUser = activeUser
      return trackResult.promise
    })
    hoisted.analytics.reset.mockImplementationOnce(() => {
      activeUser = null
    })
    const provider = createProvider()
    await vi.dynamicImportSettled()

    provider.trackAuth({
      user_id: 'uid-1',
      email: 'person@example.com'
    })
    hoisted.logoutUser()
    identifyResult.resolve()

    await vi.waitFor(() => expect(hoisted.analytics.reset).toHaveBeenCalled())
    expect(trackedUser).toBe('uid-1')
    expect(hoisted.analytics.track.mock.invocationCallOrder[0]).toBeLessThan(
      hoisted.analytics.reset.mock.invocationCallOrder[0]
    )
    trackResult.resolve()
  })

  it('restores a configured identity after tracking auth with the Firebase uid', async () => {
    const provider = createProvider({
      customer_io: {
        write_key: WRITE_KEY,
        site_id: SITE_ID,
        user_id: 'forced-uid'
      }
    })
    await vi.dynamicImportSettled()
    hoisted.analytics.identify.mockClear()

    provider.trackAuth({
      user_id: 'firebase-uid',
      email: 'person@example.com'
    })

    await vi.waitFor(() =>
      expect(hoisted.analytics.identify.mock.calls).toEqual([
        ['firebase-uid', { email: 'person@example.com' }],
        ['forced-uid', undefined]
      ])
    )
    expect(hoisted.analytics.track.mock.invocationCallOrder[0]).toBeLessThan(
      hoisted.analytics.identify.mock.invocationCallOrder[1]
    )
  })

  it('tracks auth after identifying a user without an email', async () => {
    const provider = createProvider()
    await vi.dynamicImportSettled()

    provider.trackAuth({ user_id: 'uid-without-email' })

    await vi.waitFor(() =>
      expect(hoisted.analytics.identify).toHaveBeenCalledWith(
        'uid-without-email',
        undefined
      )
    )
    await vi.waitFor(() =>
      expect(hoisted.analytics.track).toHaveBeenCalledWith(
        'app:user_auth_completed',
        { ...SOURCE, user_id: 'uid-without-email' }
      )
    )
  })

  it('tracks auth without identifying when user_id is absent', async () => {
    const provider = createProvider()
    await vi.dynamicImportSettled()

    provider.trackAuth({ method: 'google', email: 'person@example.com' })

    await vi.waitFor(() =>
      expect(hoisted.analytics.track).toHaveBeenCalledWith(
        'app:user_auth_completed',
        { ...SOURCE, method: 'google' }
      )
    )
    expect(hoisted.analytics.identify).not.toHaveBeenCalled()
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

  it('waits for queued auth identification before later events', async () => {
    const identifyResult = createDeferred()
    hoisted.analytics.identify.mockReturnValueOnce(identifyResult.promise)
    const provider = createProvider()
    provider.trackAuth({
      user_id: 'uid-1',
      email: 'person@example.com'
    })
    provider.trackWorkflowExecution()

    await vi.dynamicImportSettled()

    expect(hoisted.analytics.track).not.toHaveBeenCalled()
    identifyResult.resolve()
    await vi.waitFor(() =>
      expect(hoisted.analytics.track.mock.calls).toEqual([
        ['app:user_auth_completed', { ...SOURCE, user_id: 'uid-1' }],
        ['execution_start', SOURCE]
      ])
    )
  })

  it('does not wait for event delivery before handing off later events', async () => {
    const trackResult = createDeferred()
    hoisted.analytics.track.mockReturnValueOnce(trackResult.promise)
    const provider = createProvider()
    await vi.dynamicImportSettled()

    provider.trackWorkflowExecution()
    provider.trackAddApiCreditButtonClicked()

    await vi.waitFor(() =>
      expect(hoisted.analytics.track.mock.calls).toEqual([
        ['execution_start', SOURCE],
        ['app:add_api_credit_button_clicked', SOURCE]
      ])
    )
    trackResult.resolve()
  })

  it('snapshots resolved user email before queued identification', async () => {
    const identifyResult = createDeferred()
    hoisted.analytics.identify.mockReturnValueOnce(identifyResult.promise)
    const provider = createProvider()
    await vi.dynamicImportSettled()

    provider.trackAuth({ user_id: 'blocking-uid' })
    hoisted.userEmail.value = 'first@example.com'
    hoisted.resolveUser('resolved-uid')
    hoisted.userEmail.value = 'second@example.com'
    identifyResult.resolve()

    await vi.waitFor(() =>
      expect(hoisted.analytics.identify).toHaveBeenNthCalledWith(
        2,
        'resolved-uid',
        { email: 'first@example.com' }
      )
    )
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

    await vi.waitFor(() =>
      expect(hoisted.analytics.track).toHaveBeenCalledTimes(2)
    )
    expect(console.error).toHaveBeenCalledWith(
      'Failed to track Customer.io event:',
      expect.any(Error)
    )
  })
})
