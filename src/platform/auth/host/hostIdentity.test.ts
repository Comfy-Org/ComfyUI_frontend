import { afterEach, describe, expect, it } from 'vitest'

import type {
  HostAuthBridge,
  HostAuthRefusal
} from '@/platform/auth/host/hostAuthBridge'

import {
  fakeHostAuthBridge,
  SIGNED_IN
} from '@/platform/auth/host/__tests__/fakeHostAuthBridge'
import {
  hostAccessToken,
  hostIdentityState,
  hostRefusalReason,
  hostUser,
  isHostIdentityActive,
  reportHostRefusal,
  requestHostSignIn,
  startHostIdentity,
  stopHostIdentity
} from '@/platform/auth/host/hostIdentity'

afterEach(() => stopHostIdentity())

function refusal(status: number, body: string): Response {
  return new Response(body, { status })
}

describe('hostIdentity', () => {
  it('takes the host account as the identity when the host offers one', async () => {
    const { bridge } = fakeHostAuthBridge()

    await startHostIdentity(bridge)

    expect(isHostIdentityActive()).toBe(true)
    expect(hostUser()).toEqual({
      id: 'comfy-user-1',
      email: 'ada@example.com',
      workspaceId: 'ws-1'
    })
    await expect(hostAccessToken()).resolves.toBe('host-access-token')
  })

  it.for<{ label: string; makeBridge: () => HostAuthBridge }>([
    {
      label: 'the host reports disabled',
      makeBridge: () => fakeHostAuthBridge({ status: 'disabled' }).bridge
    },
    {
      label: 'the bridge fails',
      makeBridge: () => {
        const { bridge } = fakeHostAuthBridge()
        bridge.getState.mockRejectedValue(new Error('no handler'))
        return bridge
      }
    }
  ])('stays inactive when $label', async ({ makeBridge }) => {
    await startHostIdentity(makeBridge())

    expect(isHostIdentityActive()).toBe(false)
    await expect(hostAccessToken()).resolves.toBeUndefined()
  })

  it('follows sign-out and sign-in pushed by the host', async () => {
    const { bridge, push } = fakeHostAuthBridge()
    await startHostIdentity(bridge)

    push({ status: 'signed_out' })
    expect(hostIdentityState.value).toEqual({ status: 'signed_out' })
    await expect(hostAccessToken()).resolves.toBeUndefined()

    push(SIGNED_IN)
    expect(hostUser()?.id).toBe('comfy-user-1')
  })

  it('asks the host to sign in', async () => {
    const { bridge } = fakeHostAuthBridge({ status: 'signed_out' })
    await startHostIdentity(bridge)

    await requestHostSignIn()

    expect(bridge.requestSignIn).toHaveBeenCalledOnce()
    expect(hostUser()?.id).toBe('comfy-user-1')
  })

  it.for<{
    status: number
    body: string
    reason: HostAuthRefusal | undefined
  }>([
    { status: 401, body: '', reason: 'unauthorized' },
    { status: 403, body: '{"code":"sso_required"}', reason: 'sso_required' },
    {
      status: 403,
      body: '{"message":"sso_required: your organization requires single sign-on"}',
      reason: 'sso_required'
    },
    {
      status: 403,
      body: '{"code":"workspace_access_denied"}',
      reason: undefined
    },
    { status: 500, body: 'sso_required', reason: undefined }
  ])('classifies $status $body as $reason', ({ status, body, reason }) => {
    expect(hostRefusalReason(status, body)).toBe(reason)
  })

  it('reports a refused host token and signs out when the host does', async () => {
    const { bridge } = fakeHostAuthBridge()
    await startHostIdentity(bridge)
    await hostAccessToken()

    await reportHostRefusal(refusal(403, '{"code":"sso_required"}'))

    expect(bridge.reportRefusal).toHaveBeenCalledWith(
      'host-access-token',
      'sso_required'
    )
    expect(hostIdentityState.value).toEqual({ status: 'signed_out' })
  })

  it('does not report refusals unrelated to the credential', async () => {
    const { bridge } = fakeHostAuthBridge()
    await startHostIdentity(bridge)
    await hostAccessToken()

    await reportHostRefusal(refusal(403, '{"code":"workspace_access_denied"}'))
    await reportHostRefusal(refusal(200, ''))

    expect(bridge.reportRefusal).not.toHaveBeenCalled()
  })
})
