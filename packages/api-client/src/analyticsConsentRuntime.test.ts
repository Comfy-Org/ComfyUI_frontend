import { expect, it, vi } from 'vitest'
import {
  bindAnalyticsConsentRuntime,
  createAnalyticsConsentTransport,
  homepageConsentReceiptConfiguration
} from './analyticsConsentRuntime'
import type { AnalyticsConsentRuntimePorts } from './analyticsConsentRuntime'

type Credential = Parameters<typeof createAnalyticsConsentTransport>[1]
const credential = (uid = 'actor', workspace = 'workspace'): Credential => ({
  uid,
  token: 'fixture.jwt.token',
  expiresAt: Date.now() + 60_000,
  workspace: { id: workspace, name: 'Fixture', type: 'team' },
  role: 'owner',
  permissions: []
})
const receipt = {
  accepted: true,
  service: 'posthog',
  policy_version: 'v1',
  notice_digest: 'notice'
} as const
const ack = (actor = 'actor', workspace = 'workspace') =>
  Response.json({
    key: 'Comfy.Analytics.PostHogConsent',
    value: receipt,
    updated_at: new Date().toISOString(),
    scope: { actor_id: actor, workspace_id: workspace }
  })

it('sends no asserted identity, uses immutable JWT without cookies and validates ACK scope', async () => {
  const send = vi.fn<typeof fetch>().mockResolvedValue(ack())
  const transport = createAnalyticsConsentTransport(
    'https://cloud.example/api',
    credential(),
    () => true,
    send
  )
  await transport.grant(receipt)
  const init = send.mock.calls[0][1]
  expect(init?.credentials).toBe('omit')
  expect(init?.headers).toEqual({
    Authorization: 'Bearer fixture.jwt.token',
    'Content-Type': 'application/json'
  })
  expect(JSON.parse(String(init?.body))).toEqual({
    key: 'Comfy.Analytics.PostHogConsent',
    value: receipt
  })
  for (const response of [
    ack('other'),
    ack('actor', 'other'),
    Response.json({}),
    new Response('', { status: 403 })
  ]) {
    send.mockResolvedValueOnce(response)
    await expect(transport.grant(receipt)).resolves.toBe(false)
  }
})

it('rejects expired, API-key and stale-session grants without sending', async () => {
  const send = vi.fn<typeof fetch>()
  for (const [value, current] of [
    [{ ...credential(), expiresAt: 0 }, true],
    [{ ...credential(), token: 'comfyui-fixture' }, true],
    [credential(), false]
  ] as const) {
    await expect(
      createAnalyticsConsentTransport('/api', value, () => current, send).grant(
        receipt
      )
    ).resolves.toBe(false)
  }
  expect(send).not.toHaveBeenCalled()
})

it('a session switch during response parsing cannot acknowledge a grant', async () => {
  let current = true
  const response = ack()
  vi.spyOn(response, 'json').mockImplementation(async () => {
    current = false
    return {
      key: 'Comfy.Analytics.PostHogConsent',
      value: receipt,
      updated_at: new Date().toISOString(),
      scope: { actor_id: 'actor', workspace_id: 'workspace' }
    }
  })
  const send = vi.fn<typeof fetch>().mockResolvedValue(response)
  await expect(
    createAnalyticsConsentTransport(
      '/api',
      credential(),
      () => current,
      send
    ).grant(receipt)
  ).resolves.toBe(false)
})

it('accepts only successful or typed already-absent revocation', async () => {
  const send = vi.fn<typeof fetch>()
  const transport = createAnalyticsConsentTransport(
    '/api',
    credential(),
    () => true,
    send
  )
  for (const response of [
    new Response(null, { status: 204 }),
    Response.json({ code: 'NOT_FOUND', message: 'Absent' }, { status: 404 })
  ]) {
    send.mockResolvedValueOnce(response)
    await expect(transport.revoke()).resolves.toBe(true)
  }
  send.mockResolvedValueOnce(
    Response.json({ code: 'UNAUTHORIZED', message: 'Denied' }, { status: 404 })
  )
  await expect(transport.revoke()).resolves.toBe(false)
})

function runtime(
  configuration = { enabled: true, policyVersion: 'v1', noticeDigest: 'notice' }
) {
  let session: Parameters<
    AnalyticsConsentRuntimePorts['onSession']
  >[0] = () => {}
  let consent: Parameters<
    AnalyticsConsentRuntimePorts['onPostHogConsent']
  >[0] = () => {}
  const stopSession = vi.fn(),
    stopConsent = vi.fn(),
    setEligible = vi.fn()
  const send = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_url, init) =>
      init?.method === 'DELETE' ? new Response(null, { status: 204 }) : ack()
    )
  const bound = bindAnalyticsConsentRuntime(configuration, {
    apiBaseUrl: '/api',
    fetchImpl: send,
    setEligible,
    onSession: (listener) => {
      session = listener
      return stopSession
    },
    onPostHogConsent: (listener) => {
      consent = listener
      return stopConsent
    }
  })
  return {
    bound,
    session,
    consent,
    send,
    setEligible,
    stopSession,
    stopConsent
  }
}

it('production configuration neither subscribes nor sends', () => {
  const state = runtime(homepageConsentReceiptConfiguration)
  state.session(credential())
  state.consent(true)
  expect(state.send).not.toHaveBeenCalled()
  expect(state.setEligible).toHaveBeenLastCalledWith(false)
})

it('binds explicit consent to an authenticated session, revokes and disposes', async () => {
  const state = runtime()
  state.consent(true)
  state.session(credential())
  await vi.waitFor(() =>
    expect(state.setEligible).toHaveBeenLastCalledWith(true)
  )
  state.consent(false)
  expect(state.setEligible).toHaveBeenLastCalledWith(false)
  await vi.waitFor(() => expect(state.send).toHaveBeenCalledTimes(2))
  state.bound.dispose()
  expect(state.stopSession).toHaveBeenCalledOnce()
  expect(state.stopConsent).toHaveBeenCalledOnce()
})

it('workspace or identity replacement disposes stale acknowledgment', async () => {
  const state = runtime()
  let resolve!: (response: Response) => void
  state.send.mockImplementationOnce(
    () =>
      new Promise<Response>((done) => {
        resolve = done
      })
  )
  state.consent(true)
  state.session(credential())
  await vi.waitFor(() => expect(state.send).toHaveBeenCalledOnce())
  state.session(undefined)
  resolve(ack())
  await Promise.resolve()
  await Promise.resolve()
  expect(state.setEligible).toHaveBeenLastCalledWith(false)
  state.bound.dispose()
})

it('credential expiry immediately ends local eligibility', async () => {
  vi.useFakeTimers()
  try {
    const state = runtime()
    state.consent(true)
    state.session(credential())
    await vi.advanceTimersByTimeAsync(0)
    expect(state.setEligible).toHaveBeenLastCalledWith(true)
    await vi.advanceTimersByTimeAsync(60_001)
    expect(state.setEligible).toHaveBeenLastCalledWith(false)
    state.bound.dispose()
  } finally {
    vi.useRealTimers()
  }
})
