import { datadogRum } from '@datadog/browser-rum'
import posthog from 'posthog-js'
import type { CaptureResult } from 'posthog-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { CloudTelemetryConfig } from '@comfyorg/account-core/firebase'

import type { SessionIdentity } from '@/telemetry/billingWebTelemetry'
import {
  createBillingWebTelemetry,
  toSessionIdentity
} from '@/telemetry/billingWebTelemetry'
import type { ScrubbableRumEvent } from '@/telemetry/rum'
import { billingWebRumBeforeSend, initBillingWebRum } from '@/telemetry/rum'

vi.mock(import('@datadog/browser-rum'))
vi.mock(import('posthog-js'))

const CONFIGURED: CloudTelemetryConfig = {
  posthogProjectToken: 'phc_project',
  posthogApiHost: 'https://t.comfy.org'
}

function deferredConfig() {
  let resolve: (config: CloudTelemetryConfig) => void = () => {}
  const promise = new Promise<CloudTelemetryConfig>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/** PostHog's identity as its cookie keeps it, shared with every *.comfy.org page. */
function fakeIdentityCookie(identifiedAs?: string) {
  let identified = identifiedAs
  vi.mocked(posthog.get_distinct_id).mockImplementation(
    () => identified ?? 'anonymous-device'
  )
  vi.mocked(posthog.get_property).mockImplementation((key) =>
    key === '$user_state'
      ? identified
        ? 'identified'
        : 'anonymous'
      : undefined
  )
  vi.mocked(posthog.identify).mockImplementation((userId) => {
    identified = userId
  })
  vi.mocked(posthog.reset).mockImplementation(() => {
    identified = undefined
  })
}

describe('trackBillingEvent', () => {
  it('reports nothing, and never throws, before any sink is running', () => {
    const telemetry = createBillingWebTelemetry()

    expect(() =>
      telemetry.trackBillingEvent('billing.operation.started', {
        operation: 'operation',
        stage: 'started'
      })
    ).not.toThrow()
    expect(datadogRum.addAction).not.toHaveBeenCalled()
    expect(posthog.capture).not.toHaveBeenCalled()
  })

  it('stamps the billing web surface on every event, over whatever the caller sent', async () => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
    const telemetry = createBillingWebTelemetry()
    await telemetry.startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity: ref<SessionIdentity>({ kind: 'unknown' })
    })

    telemetry.trackBillingEvent('billing.operation.started', {
      operation: 'operation',
      stage: 'started',
      billing_op_id: 'op_1',
      billing_surface: 'cloud_app'
    })

    const stamped = {
      operation: 'operation',
      stage: 'started',
      billing_op_id: 'op_1',
      billing_surface: 'billing_web'
    }
    expect(datadogRum.addAction).toHaveBeenCalledWith(
      'billing.operation.started',
      stamped
    )
    expect(posthog.capture).toHaveBeenCalledWith(
      'billing.operation.started',
      stamped
    )
  })

  it('delivers an event tracked while PostHog loads once it is ready', async () => {
    const config = deferredConfig()
    const telemetry = createBillingWebTelemetry()
    const started = telemetry.startPostHog({
      config: config.promise,
      identity: ref<SessionIdentity>({ kind: 'unknown' })
    })

    telemetry.trackBillingEvent('billing.web_entry.opened', {
      operation: 'web_entry',
      stage: 'opened'
    })
    expect(posthog.capture).not.toHaveBeenCalled()
    config.resolve(CONFIGURED)
    await started

    expect(posthog.capture).toHaveBeenCalledExactlyOnceWith(
      'billing.web_entry.opened',
      {
        operation: 'web_entry',
        stage: 'opened',
        billing_surface: 'billing_web'
      }
    )
  })

  it('drops what was waiting when the Cloud origin names no PostHog project', async () => {
    const config = deferredConfig()
    const telemetry = createBillingWebTelemetry()
    const started = telemetry.startPostHog({
      config: config.promise,
      identity: ref<SessionIdentity>({ kind: 'unknown' })
    })

    telemetry.trackBillingEvent('billing.web_entry.opened', {
      operation: 'web_entry',
      stage: 'opened'
    })
    config.resolve({})
    await started

    expect(posthog.init).not.toHaveBeenCalled()
    expect(posthog.capture).not.toHaveBeenCalled()
  })

  it('holds back the events the backend switched off, and only those', async () => {
    const telemetry = createBillingWebTelemetry()
    await telemetry.startPostHog({
      config: Promise.resolve({
        ...CONFIGURED,
        telemetryDisabledEvents: ['billing.operation.started']
      }),
      identity: ref<SessionIdentity>({ kind: 'unknown' })
    })

    telemetry.trackBillingEvent('billing.operation.started', {
      operation: 'operation',
      stage: 'started'
    })
    telemetry.trackBillingEvent('billing.operation.succeeded', {
      operation: 'operation',
      stage: 'succeeded'
    })

    expect(vi.mocked(posthog.capture).mock.calls.map(([name]) => name)).toEqual(
      ['billing.operation.succeeded']
    )
  })

  it('never throws into the billing flow when a sink fails', async () => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
    vi.mocked(datadogRum.addAction).mockImplementation(() => {
      throw new Error('RUM unavailable')
    })
    vi.mocked(posthog.capture).mockImplementation(() => {
      throw new Error('PostHog unavailable')
    })
    const telemetry = createBillingWebTelemetry()
    await telemetry.startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity: ref<SessionIdentity>({ kind: 'unknown' })
    })

    expect(() =>
      telemetry.trackBillingEvent('billing.operation.started', {
        operation: 'operation',
        stage: 'started'
      })
    ).not.toThrow()
  })

  it('still sends the PostHog copy when RUM fails', async () => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
    vi.mocked(datadogRum.addAction).mockImplementation(() => {
      throw new Error('RUM unavailable')
    })
    const telemetry = createBillingWebTelemetry()
    await telemetry.startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity: ref<SessionIdentity>({ kind: 'unknown' })
    })

    telemetry.trackBillingEvent('billing.operation.started', {
      operation: 'operation',
      stage: 'started'
    })

    expect(posthog.capture).toHaveBeenCalledOnce()
  })
})

describe('startPostHog', () => {
  it('turns off every PostHog capture that would carry page text or a full URL', async () => {
    const telemetry = createBillingWebTelemetry()

    await telemetry.startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity: ref<SessionIdentity>({ kind: 'unknown' })
    })

    expect(posthog.init).toHaveBeenCalledWith(
      'phc_project',
      expect.objectContaining({
        disable_session_recording: true,
        capture_performance: false,
        capture_heatmaps: false,
        capture_dead_clicks: false,
        capture_exceptions: false,
        disable_external_dependency_loading: true,
        mask_personal_data_properties: true,
        custom_personal_data_properties: expect.arrayContaining([
          'promo',
          'payment_intent_client_secret',
          'setup_intent_client_secret'
        ])
      })
    )
  })

  it.for([
    {
      name: 'the host the Cloud origin names',
      apiHost: 'https://ph.example',
      expected: 'https://ph.example'
    },
    {
      name: 'the Cloud app default host',
      apiHost: undefined,
      expected: 'https://t.comfy.org'
    }
  ])(
    "joins the Cloud app's PostHog project through $name, profiling identified users only",
    async ({ apiHost, expected }) => {
      const telemetry = createBillingWebTelemetry()

      await telemetry.startPostHog({
        config: Promise.resolve({
          posthogProjectToken: 'phc_project',
          posthogApiHost: apiHost
        }),
        identity: ref<SessionIdentity>({ kind: 'unknown' })
      })

      expect(posthog.init).toHaveBeenCalledWith(
        'phc_project',
        expect.objectContaining({
          api_host: expected,
          person_profiles: 'identified_only',
          autocapture: false
        })
      )
    }
  )

  it('sends no email, client secret or query string with a pageview', async () => {
    const telemetry = createBillingWebTelemetry()
    await telemetry.startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity: ref<SessionIdentity>({ kind: 'unknown' })
    })
    const pageview: CaptureResult = {
      uuid: 'event-1',
      event: '$pageview',
      properties: {
        $current_url:
          'https://billing.comfy.org/v1/checkout?payment_intent_client_secret=pi_1_secret_2',
        $referrer: 'https://cloud.comfy.org/?correlation_id=c1',
        email: 'ada@example.com',
        billing_op_id: 'op_1'
      },
      $set: { email: 'ada@example.com' },
      $set_once: {
        $initial_current_url:
          'https://billing.comfy.org/v1/checkout?promo=SPRING'
      }
    }

    const sendHooks = [
      vi.mocked(posthog.init).mock.lastCall?.[1]?.before_send ?? []
    ].flat()
    const sent = sendHooks.reduce<CaptureResult | null>(
      (event, send) => send(event),
      pageview
    )

    expect(sent).toEqual({
      uuid: 'event-1',
      event: '$pageview',
      properties: {
        $current_url: 'https://billing.comfy.org/v1/checkout',
        $referrer: 'https://cloud.comfy.org/',
        billing_op_id: 'op_1'
      },
      $set: {},
      $set_once: {
        $initial_current_url: 'https://billing.comfy.org/v1/checkout'
      }
    })
  })

  it('stays silent, without rejecting, when PostHog fails to start', async () => {
    vi.mocked(posthog.init).mockImplementation(() => {
      throw new Error('PostHog failed to load')
    })
    const telemetry = createBillingWebTelemetry()

    await expect(
      telemetry.startPostHog({
        config: Promise.resolve(CONFIGURED),
        identity: ref<SessionIdentity>({ kind: 'unknown' })
      })
    ).resolves.toBeUndefined()
    telemetry.trackBillingEvent('billing.operation.started', {
      operation: 'operation',
      stage: 'started'
    })

    expect(posthog.capture).not.toHaveBeenCalled()
  })
})

describe('PostHog identity', () => {
  it('identifies the signed-in user once, however often the session re-resolves', async () => {
    fakeIdentityCookie()
    const identity = ref<SessionIdentity>({ kind: 'unknown' })
    await createBillingWebTelemetry().startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity
    })

    identity.value = { kind: 'signed_in', userId: 'user_1' }
    await nextTick()
    identity.value = { kind: 'signed_in', userId: 'user_1' }
    await nextTick()

    expect(posthog.identify).toHaveBeenCalledExactlyOnceWith('user_1')
  })

  it('resets PostHog when the identified user signs out', async () => {
    fakeIdentityCookie()
    const identity = ref<SessionIdentity>({
      kind: 'signed_in',
      userId: 'user_1'
    })
    await createBillingWebTelemetry().startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity
    })

    identity.value = { kind: 'signed_out' }
    await nextTick()

    expect(posthog.reset).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('leaves the shared identity alone for a visitor who never signed in here', async () => {
    fakeIdentityCookie('cloud_user')
    const identity = ref<SessionIdentity>({ kind: 'unknown' })
    await createBillingWebTelemetry().startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity
    })

    identity.value = { kind: 'signed_out' }
    await nextTick()

    expect(posthog.reset).not.toHaveBeenCalled()
  })

  it('starts a fresh identity before identifying a different user', async () => {
    fakeIdentityCookie()
    const identity = ref<SessionIdentity>({
      kind: 'signed_in',
      userId: 'user_1'
    })
    await createBillingWebTelemetry().startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity
    })

    identity.value = { kind: 'signed_in', userId: 'user_2' }
    await nextTick()

    expect(vi.mocked(posthog.identify).mock.calls).toEqual([
      ['user_1'],
      ['user_2']
    ])
    expect(posthog.reset).toHaveBeenCalledOnce()
    expect(vi.mocked(posthog.reset).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(posthog.identify).mock.invocationCallOrder[1]
    )
  })

  it('starts fresh when the shared cookie already holds a different user', async () => {
    fakeIdentityCookie('cloud_user')

    await createBillingWebTelemetry().startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity: ref<SessionIdentity>({ kind: 'signed_in', userId: 'user_1' })
    })

    expect(posthog.reset).toHaveBeenCalledOnce()
    expect(posthog.identify).toHaveBeenCalledExactlyOnceWith('user_1')
    expect(vi.mocked(posthog.reset).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(posthog.identify).mock.invocationCallOrder[0]
    )
  })

  it('keeps the identity the Cloud app already set for the same user', async () => {
    fakeIdentityCookie('user_1')

    await createBillingWebTelemetry().startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity: ref<SessionIdentity>({ kind: 'signed_in', userId: 'user_1' })
    })

    expect(posthog.identify).not.toHaveBeenCalled()
    expect(posthog.reset).not.toHaveBeenCalled()
  })
})

describe('RUM user', () => {
  const RUM_RUNNING = { clientToken: 'pub', applicationId: 'app' }

  beforeEach(() => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue(RUM_RUNNING)
  })

  it('sets the signed-in user as an opaque id and nothing else', () => {
    createBillingWebTelemetry().startRumUser(
      ref<SessionIdentity>({ kind: 'signed_in', userId: 'user_1' })
    )

    const users = vi.mocked(datadogRum.setUser).mock.calls.map(([user]) => user)
    expect(users).toEqual([{ id: 'user_1' }])
    expect(Object.keys(users[0])).toEqual(['id'])
  })

  it('waits for the session to resolve before setting a user', async () => {
    const identity = ref<SessionIdentity>({ kind: 'unknown' })
    createBillingWebTelemetry().startRumUser(identity)
    expect(datadogRum.setUser).not.toHaveBeenCalled()

    identity.value = { kind: 'signed_in', userId: 'user_1' }
    await nextTick()

    expect(datadogRum.setUser).toHaveBeenCalledExactlyOnceWith({ id: 'user_1' })
  })

  it('replaces the user when a different one signs in', async () => {
    const identity = ref<SessionIdentity>({
      kind: 'signed_in',
      userId: 'user_1'
    })
    createBillingWebTelemetry().startRumUser(identity)

    identity.value = { kind: 'signed_in', userId: 'user_2' }
    await nextTick()

    expect(vi.mocked(datadogRum.setUser).mock.calls).toEqual([
      [{ id: 'user_1' }],
      [{ id: 'user_2' }]
    ])
    expect(datadogRum.clearUser).not.toHaveBeenCalled()
  })

  it('clears the user it set when that user signs out, once', async () => {
    const identity = ref<SessionIdentity>({
      kind: 'signed_in',
      userId: 'user_1'
    })
    createBillingWebTelemetry().startRumUser(identity)

    identity.value = { kind: 'signed_out' }
    await nextTick()
    identity.value = { kind: 'unknown' }
    await nextTick()
    identity.value = { kind: 'signed_out' }
    await nextTick()

    expect(datadogRum.clearUser).toHaveBeenCalledOnce()
  })

  it('leaves a user it did not set alone when it only sees a sign-out', async () => {
    const identity = ref<SessionIdentity>({ kind: 'unknown' })
    createBillingWebTelemetry().startRumUser(identity)

    identity.value = { kind: 'signed_out' }
    await nextTick()

    expect(datadogRum.clearUser).not.toHaveBeenCalled()
    expect(datadogRum.setUser).not.toHaveBeenCalled()
  })

  it('keeps the user while the session is refused or resolving again', async () => {
    const identity = ref<SessionIdentity>({
      kind: 'signed_in',
      userId: 'user_1'
    })
    createBillingWebTelemetry().startRumUser(identity)

    identity.value = { kind: 'unknown' }
    await nextTick()

    expect(datadogRum.clearUser).not.toHaveBeenCalled()
  })

  it.for<{
    phase: Parameters<typeof toSessionIdentity>[0]
    reading: string
  }>([
    { phase: undefined, reading: 'a session not yet decided' },
    { phase: 'pending', reading: 'a session still resolving' },
    { phase: 'minting', reading: 'a session minting its credential' },
    { phase: 'error', reading: 'a refused session' }
  ])('sets no user for $reading', ({ phase }) => {
    createBillingWebTelemetry().startRumUser(() =>
      toSessionIdentity(phase, undefined)
    )

    expect(datadogRum.setUser).not.toHaveBeenCalled()
    expect(datadogRum.clearUser).not.toHaveBeenCalled()
  })

  it('does nothing, and never throws, when RUM is not running on this host', async () => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue(undefined)
    const identity = ref<SessionIdentity>({
      kind: 'signed_in',
      userId: 'user_1'
    })

    expect(() =>
      createBillingWebTelemetry().startRumUser(identity)
    ).not.toThrow()
    identity.value = { kind: 'signed_out' }
    await nextTick()

    expect(datadogRum.setUser).not.toHaveBeenCalled()
    expect(datadogRum.clearUser).not.toHaveBeenCalled()
  })

  it.for(['setUser', 'clearUser'] as const)(
    'never throws into the billing flow when RUM %s fails',
    async (failing) => {
      vi.mocked(datadogRum[failing]).mockImplementation(() => {
        throw new Error('RUM unavailable')
      })
      const identity = ref<SessionIdentity>({
        kind: 'signed_in',
        userId: 'user_1'
      })

      expect(() =>
        createBillingWebTelemetry().startRumUser(identity)
      ).not.toThrow()
      identity.value = { kind: 'signed_out' }
      await nextTick()

      expect(datadogRum[failing]).toHaveBeenCalledOnce()
    }
  )

  it('follows the same identity, with the same id, as PostHog', async () => {
    fakeIdentityCookie()
    const identity = ref<SessionIdentity>({
      kind: 'signed_in',
      userId: 'user_1'
    })
    const telemetry = createBillingWebTelemetry()
    telemetry.startRumUser(identity)
    await telemetry.startPostHog({
      config: Promise.resolve(CONFIGURED),
      identity
    })

    expect(posthog.identify).toHaveBeenCalledExactlyOnceWith('user_1')
    expect(datadogRum.setUser).toHaveBeenCalledWith({ id: 'user_1' })

    identity.value = { kind: 'signed_out' }
    await nextTick()

    expect(posthog.reset).toHaveBeenCalledOnce()
    expect(datadogRum.clearUser).toHaveBeenCalledOnce()
  })

  it('sends the id nowhere else in RUM', async () => {
    const identity = ref<SessionIdentity>({ kind: 'unknown' })
    const telemetry = createBillingWebTelemetry()
    telemetry.startRumUser(identity)

    identity.value = { kind: 'signed_in', userId: 'user_1' }
    await nextTick()
    telemetry.trackBillingEvent('billing.operation.started', {
      operation: 'operation',
      stage: 'started'
    })

    expect(datadogRum.setUserProperty).not.toHaveBeenCalled()
    expect(datadogRum.setGlobalContext).not.toHaveBeenCalled()
    expect(datadogRum.setGlobalContextProperty).not.toHaveBeenCalled()
    expect(datadogRum.setAccount).not.toHaveBeenCalled()
    expect(datadogRum.addAction).toHaveBeenCalledExactlyOnceWith(
      'billing.operation.started',
      {
        operation: 'operation',
        stage: 'started',
        billing_surface: 'billing_web'
      }
    )
  })

  it('keeps scrubbing what RUM sends once a user is set', () => {
    vi.mocked(datadogRum.getInitConfiguration)
      .mockReturnValueOnce(undefined)
      .mockReturnValue(RUM_RUNNING)
    initBillingWebRum({ hostname: 'billing.comfy.org', version: 'commit-sha' })
    createBillingWebTelemetry().startRumUser(
      ref<SessionIdentity>({ kind: 'signed_in', userId: 'user_1' })
    )
    const click: ScrubbableRumEvent = {
      type: 'action',
      view: {
        url: 'https://billing.comfy.org/v1/checkout?payment_intent_client_secret=pi_1_secret_2'
      },
      action: { target: { name: 'Signed in as ada@example.com' } }
    }

    expect(datadogRum.setUser).toHaveBeenCalledWith({ id: 'user_1' })
    expect(vi.mocked(datadogRum.init).mock.lastCall?.[0].beforeSend).toBe(
      billingWebRumBeforeSend
    )
    expect(billingWebRumBeforeSend(click)).toBe(true)
    expect(click).toEqual({
      type: 'action',
      view: { url: 'https://billing.comfy.org/v1/checkout' },
      action: { target: { name: 'Signed in as [email]' } }
    })
  })
})

describe('toSessionIdentity', () => {
  it.for<{
    phase: Parameters<typeof toSessionIdentity>[0]
    userId: string | undefined
    expected: SessionIdentity
  }>([
    {
      phase: 'signed-out',
      userId: undefined,
      expected: { kind: 'signed_out' }
    },
    {
      phase: 'authenticated',
      userId: 'user_1',
      expected: { kind: 'signed_in', userId: 'user_1' }
    },
    {
      phase: 'authenticated',
      userId: undefined,
      expected: { kind: 'unknown' }
    },
    { phase: 'pending', userId: undefined, expected: { kind: 'unknown' } },
    { phase: undefined, userId: undefined, expected: { kind: 'unknown' } }
  ])(
    'reads $phase with user $userId as $expected.kind',
    ({ phase, userId, expected }) => {
      expect(toSessionIdentity(phase, userId)).toEqual(expected)
    }
  )
})
