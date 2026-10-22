import { setImmediate } from 'node:timers/promises'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope, ref } from 'vue'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { useAuthStore } from '@/stores/authStore'

import { useLocalAgentGrant } from './useLocalAgentGrant'

vi.mock(import('firebase/auth'))
vi.mock(import('@/config/comfyApi'), { spy: true })

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function start(scope = ref<string | null>('account-a/workspace-a/0')) {
  const owner = effectScope()
  const grant = owner.run(() => useLocalAgentGrant(scope))
  assert.exists(grant)
  onTestFinished(() => owner.stop())
  return { ...grant, scope, stop: () => owner.stop() }
}

beforeEach(() => {
  vi.mocked(getComfyCloudBaseUrl).mockReturnValue('https://cloud.comfy.test')
  vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue({
    Authorization: 'Bearer desktop-account-token'
  })
})

describe('useLocalAgentGrant', () => {
  it.for(['control', 'treatment'] as const)(
    'reads authenticated remote features and accepts %s',
    async (assignment) => {
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ agent_gratis_local_arm: assignment })
      )
      const { arm } = start()

      await vi.waitFor(() => expect(arm.value).toBe(assignment))

      expect(fetch).toHaveBeenCalledExactlyOnceWith(
        'https://cloud.comfy.test/api/features',
        {
          headers: { Authorization: 'Bearer desktop-account-token' },
          signal: expect.any(AbortSignal),
          cache: 'no-store',
          redirect: 'error'
        }
      )
    }
  )

  it.for([
    { label: 'missing', payload: {} },
    { label: 'null', payload: null },
    { label: 'unrecognized', payload: { agent_gratis_local_arm: 'free' } },
    { label: 'boolean', payload: { agent_gratis_local_arm: true } },
    {
      label: 'nested',
      payload: { features: { agent_gratis_local_arm: 'treatment' } }
    }
  ])('keeps $label assignment unknown', async ({ payload }) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(payload))
    const { arm } = start()

    await setImmediate()

    expect(fetch).toHaveBeenCalledOnce()
    expect(arm.value).toBe('unknown')
  })

  it.for([
    {
      label: 'unauthorized',
      response: () => new Response(null, { status: 401 })
    },
    {
      label: 'unavailable',
      response: () => new Response(null, { status: 503 })
    },
    { label: 'malformed', response: () => new Response('{') }
  ])('keeps $label responses unknown', async ({ response }) => {
    vi.mocked(fetch).mockResolvedValueOnce(response())
    const { arm } = start()

    await setImmediate()

    expect(arm.value).toBe('unknown')
  })

  it('keeps a network failure unknown', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'))
    const { arm } = start()

    await setImmediate()

    expect(arm.value).toBe('unknown')
  })

  it('does not read credentials or features without an eligible scope', async () => {
    const { arm } = start(ref(null))

    await setImmediate()

    expect(useAuthStore().getUserAuthHeader).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(arm.value).toBe('unknown')
  })

  it('does not make an unauthenticated request when credentials are absent', async () => {
    vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValueOnce(null)
    const { arm } = start()

    await setImmediate()

    expect(fetch).not.toHaveBeenCalled()
    expect(arm.value).toBe('unknown')
  })

  it('keeps a credential failure unknown', async () => {
    vi.mocked(useAuthStore().getUserAuthHeader).mockRejectedValueOnce(
      new Error('session expired')
    )
    const { arm } = start()

    await setImmediate()

    expect(fetch).not.toHaveBeenCalled()
    expect(arm.value).toBe('unknown')
  })

  it.for(['account-b/workspace-a/0', 'account-a/workspace-b/1'])(
    'discards an old response when the scope becomes %s',
    async (nextScope) => {
      const old = deferred<Response>()
      const current = deferred<Response>()
      vi.mocked(fetch)
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(current.promise)
      const { arm, scope } = start()
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
      const oldSignal = vi.mocked(fetch).mock.calls[0][1]?.signal

      scope.value = nextScope
      expect(oldSignal?.aborted).toBe(true)
      expect(arm.value).toBe('unknown')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
      current.resolve(Response.json({ agent_gratis_local_arm: 'control' }))
      await vi.waitFor(() => expect(arm.value).toBe('control'))
      old.resolve(Response.json({ agent_gratis_local_arm: 'treatment' }))
      await setImmediate()

      expect(arm.value).toBe('control')
    }
  )

  it('clears a known arm immediately when consent or identity is invalidated', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ agent_gratis_local_arm: 'treatment' })
    )
    const { arm, scope } = start()
    await vi.waitFor(() => expect(arm.value).toBe('treatment'))

    scope.value = null

    expect(arm.value).toBe('unknown')
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('does not send credentials that arrive after scope invalidation', async () => {
    const auth =
      deferred<
        Awaited<
          ReturnType<ReturnType<typeof useAuthStore>['getUserAuthHeader']>
        >
      >()
    vi.mocked(useAuthStore().getUserAuthHeader).mockReturnValueOnce(
      auth.promise
    )
    const { arm, scope } = start()

    scope.value = null
    auth.resolve({ Authorization: 'Bearer old-account-token' })
    await setImmediate()

    expect(fetch).not.toHaveBeenCalled()
    expect(arm.value).toBe('unknown')
  })

  it('aborts an outstanding request when its owner unmounts', async () => {
    const response = deferred<Response>()
    vi.mocked(fetch).mockReturnValueOnce(response.promise)
    const { arm, stop } = start()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal

    stop()
    response.resolve(Response.json({ agent_gratis_local_arm: 'treatment' }))
    await setImmediate()

    expect(signal?.aborted).toBe(true)
    expect(arm.value).toBe('unknown')
  })
})
