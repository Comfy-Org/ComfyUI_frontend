import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import type {
  WebSessionRequests,
  WebSessionRequestScope
} from '@comfyorg/api-client/webSessionFetch'
import { provideWebSessionRequests } from '@comfyorg/api-client/webSessionFetch'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'
import { DEFAULT_RETRY_POLICY } from '@comfyorg/api-client/retryPolicy'

import { workspaceApi } from './workspaceApi'
import { installWorkspaceApiAuth } from './workspaceApiAuth'

vi.mock(import('@/i18n'))

vi.mock(import('@/platform/remote/ingest/ingestApiUrl'), () => ({
  ingestApiUrl: (path: string) => `/api${path}`
}))

vi.mock(import('firebase/auth'), { spy: true })

beforeEach(() => {
  stubFirebaseAuthHarness()
})

installWorkspaceApiAuth()

function provideSessionSending(...answers: Response[]) {
  const send = vi.fn<WebSessionRequests['send']>(async () => {
    const answer = answers.shift()
    if (!answer) throw new Error('send called more times than scripted')
    return answer
  })
  const release = provideWebSessionRequests(
    fromPartial<WebSessionRequests>({
      scope: async () => fromPartial<WebSessionRequestScope>({}),
      send
    })
  )
  onTestFinished(release)
  return send
}

const unavailable = (headers?: Record<string, string>) =>
  new Response('{"message":"unavailable"}', { status: 503, headers })

describe('workspaceApi on the web session', () => {
  it('recovers from a 503 on the session adapter', async () => {
    vi.useFakeTimers()
    const send = provideSessionSending(
      unavailable(),
      new Response('{"workspaces":[]}', { status: 200 })
    )

    const pending = workspaceApi.list()
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(pending).resolves.toEqual({ workspaces: [] })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('sends no more than the policy attempt count on a persistent 503', async () => {
    vi.useFakeTimers()
    const send = provideSessionSending(
      unavailable(),
      unavailable(),
      unavailable()
    )

    const pending = workspaceApi.list().catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(await pending).toMatchObject({ status: 503 })
    expect(send).toHaveBeenCalledTimes(DEFAULT_RETRY_POLICY.maxAttempts)
  })

  it('sends a read once when the caller opts out of the status retry', async () => {
    const send = provideSessionSending(unavailable())

    await expect(
      workspaceApi.list({ skipStatusRetry: true })
    ).rejects.toMatchObject({ status: 503 })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('sends the deployment listing once, leaving retries to its boot loop', async () => {
    const send = provideSessionSending(unavailable())

    await expect(
      workspaceApi.listDeployments('ws-1', [])
    ).rejects.toMatchObject({
      status: 503
    })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it.for([
    { started: [], url: '/api/workspaces/ws-1/deployments' },
    {
      started: ['dep-1', 'dep-2'],
      url: '/api/workspaces/ws-1/deployments?started_deployment_id=dep-1&started_deployment_id=dep-2'
    }
  ])(
    'asks for $url, naming each deployment this browser started',
    async ({ started, url }) => {
      const send = provideSessionSending(
        new Response('{"items":[],"builds_visible":true}', { status: 200 })
      )

      await workspaceApi.listDeployments('ws-1', started)

      expect(send.mock.calls.map(([sentUrl]) => sentUrl)).toEqual([url])
    }
  )

  it('does not retry a write that got a 503', async () => {
    const send = provideSessionSending(unavailable())

    await expect(workspaceApi.create({ name: 'Team' })).rejects.toMatchObject({
      status: 503
    })
    expect(send).toHaveBeenCalledTimes(1)
  })
})
