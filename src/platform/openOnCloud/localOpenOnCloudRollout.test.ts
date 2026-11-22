import { expect, it, onTestFinished, vi } from 'vitest'
import { ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { getBuildTimeComfyCloudBaseUrl } from '@/config/comfyApi'
import {
  bindLocalOpenOnCloudGrant,
  startLocalOpenOnCloudRollout
} from '@/platform/openOnCloud/localOpenOnCloudRollout'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { api } from '@/scripts/api'

vi.mock(import('@/scripts/api'))

const allowed = {
  open_on_cloud_enabled: true,
  open_on_cloud_use_local_agent_enabled: true
}

const denied = {
  open_on_cloud_enabled: false,
  open_on_cloud_use_local_agent_enabled: false
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function timedOutBody(): Response {
  const response = Response.json(allowed)
  vi.spyOn(response, 'json').mockRejectedValue(
    new DOMException('Body read timed out', 'AbortError')
  )
  return response
}

function start(getCredential?: () => Promise<string | undefined>) {
  const userId = ref<string>()
  const getToken = getCredential ?? (async () => userId.value)
  onTestFinished(startLocalOpenOnCloudRollout(() => userId.value, getToken))
  vi.mocked(api.getServerFeature).mockImplementation(
    (_path, defaultValue) => defaultValue
  )
  useRemoteConfigStore().acceptConfig(
    { comfy_cloud_base_url: 'https://runtime.example.com' },
    false
  )
  const { flags } = useFeatureFlags()
  return {
    userId,
    visible: () => [
      flags.openOnCloudEnabled,
      flags.openOnCloudUseLocalAgentEnabled
    ]
  }
}

it('shows the public Cloud button using the existing flag without a signed-in account', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({ ...denied, open_on_cloud_enabled: true })
  )
  const { visible } = start()

  await vi.waitFor(() => expect(visible()).toEqual([true, false]))
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    new URL('/api/features', getBuildTimeComfyCloudBaseUrl()),
    expect.objectContaining({ credentials: 'omit', headers: undefined })
  )
})

it('renders both served flags for the current account and clears them on identity changes', async () => {
  const otherAccount = deferredResponse()
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json(denied))
    .mockResolvedValueOnce(Response.json(allowed))
    .mockReturnValueOnce(otherAccount.promise)
    .mockResolvedValueOnce(Response.json(denied))
  const { userId, visible } = start()

  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(visible()).toEqual([false, false])

  userId.value = 'employee-token'
  await vi.waitFor(() => expect(visible()).toEqual([true, true]))
  expect(fetch).toHaveBeenLastCalledWith(
    new URL('/api/features', getBuildTimeComfyCloudBaseUrl()),
    expect.objectContaining({
      headers: { Authorization: 'Bearer employee-token' },
      redirect: 'error'
    })
  )

  userId.value = 'other-token'
  expect(visible()).toEqual([false, false])
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  otherAccount.resolve(
    Response.json({
      open_on_cloud_enabled: true,
      open_on_cloud_use_local_agent_enabled: false
    })
  )
  await vi.waitFor(() => expect(visible()).toEqual([true, false]))
  userId.value = undefined
  expect(visible()).toEqual([false, false])
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4))
})

it('ignores a grant returned after sign-out and renders a denied account as off', async () => {
  const grant = deferredResponse()
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json(denied))
    .mockReturnValueOnce(grant.promise)
    .mockResolvedValueOnce(Response.json(denied))
    .mockResolvedValueOnce(Response.json(denied))
  const { userId, visible } = start()
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

  userId.value = 'employee-token'
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  userId.value = undefined
  grant.resolve(Response.json(allowed))
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  await vi.advanceTimersByTimeAsync(0)
  expect(visible()).toEqual([false, false])

  userId.value = 'other-token'
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4))
  await vi.advanceTimersByTimeAsync(0)
  expect(visible()).toEqual([false, false])
})

it('recovers for the same account after the token and Cloud service become available', async () => {
  const getToken = vi
    .fn<() => Promise<string | undefined>>()
    .mockResolvedValueOnce(undefined)
    .mockResolvedValue('employee-token')
  const { userId, visible } = start(getToken)
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json(denied))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json(allowed))

  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  userId.value = 'employee'
  expect(visible()).toEqual([false, false])

  await vi.advanceTimersByTimeAsync(2_000)
  expect(visible()).toEqual([true, true])
  expect(getToken).toHaveBeenCalledTimes(3)
  expect(fetch).toHaveBeenCalledTimes(3)
})

it.for(['online', 'focus'])(
  'recovers after all startup attempts fail when the window receives %s',
  async (event) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json(denied))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(allowed))
    const { userId, visible } = start()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    userId.value = 'employee-token'

    await vi.advanceTimersByTimeAsync(2_000)
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(visible()).toEqual([false, false])

    window.dispatchEvent(new Event(event))

    await vi.waitFor(() => expect(visible()).toEqual([true, true]))
    expect(fetch).toHaveBeenCalledTimes(5)
  }
)

it('retries startup when Cloud sends headers but reading the body times out', async () => {
  const { userId, visible } = start()
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json(denied))
    .mockResolvedValueOnce(timedOutBody())
    .mockResolvedValueOnce(Response.json(allowed))
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  userId.value = 'employee-token'

  await vi.advanceTimersByTimeAsync(1_000)

  expect(fetch).toHaveBeenCalledTimes(3)
  expect(visible()).toEqual([true, true])
})

it('refreshes the grant for the initiating account and clears it on denial', async () => {
  const { userId, visible } = start()
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json(denied))
    .mockResolvedValueOnce(Response.json(allowed))
    .mockResolvedValueOnce(Response.json({ open_on_cloud_enabled: false }))
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  userId.value = 'employee-token'
  await vi.waitFor(() => expect(visible()).toEqual([true, true]))
  const authorization = bindLocalOpenOnCloudGrant()

  await expect(authorization.revalidate()).resolves.toBe(false)
  expect(visible()).toEqual([false, false])
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('blocks the timed-out handoff and leaves the same account able to retry', async () => {
  const { userId, visible } = start()
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json(denied))
    .mockResolvedValueOnce(Response.json(allowed))
    .mockResolvedValueOnce(timedOutBody())
    .mockResolvedValueOnce(Response.json(allowed))
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  userId.value = 'employee-token'
  await vi.waitFor(() => expect(visible()).toEqual([true, true]))
  const authorization = bindLocalOpenOnCloudGrant()

  await expect(authorization.revalidate()).resolves.toBe(false)
  expect(visible()).toEqual([true, true])
  await expect(authorization.revalidate()).resolves.toBe(true)
  expect(fetch).toHaveBeenCalledTimes(4)
})

it('cannot use a revalidation response after the initiating account signs out', async () => {
  const { userId, visible } = start()
  const granted = deferredResponse()
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json(denied))
    .mockResolvedValueOnce(Response.json(allowed))
    .mockReturnValueOnce(granted.promise)
    .mockResolvedValueOnce(Response.json(denied))
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  userId.value = 'employee-token'
  await vi.waitFor(() => expect(visible()).toEqual([true, true]))
  const authorization = bindLocalOpenOnCloudGrant()
  const refreshed = authorization.revalidate()
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  userId.value = undefined
  granted.resolve(Response.json(allowed))

  await expect(refreshed).resolves.toBe(false)
  expect(authorization.isCurrent()).toBe(false)
  expect(visible()).toEqual([false, false])
})

it('shares a fresh grant read for overlapping handoffs in the same account', async () => {
  const { userId, visible } = start()
  const fresh = deferredResponse()
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json(denied))
    .mockResolvedValueOnce(Response.json(allowed))
    .mockReturnValueOnce(fresh.promise)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  userId.value = 'employee-token'
  await vi.waitFor(() => expect(visible()).toEqual([true, true]))

  const first = bindLocalOpenOnCloudGrant().revalidate()
  const second = bindLocalOpenOnCloudGrant().revalidate()
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  fresh.resolve(Response.json(allowed))

  await expect(Promise.all([first, second])).resolves.toEqual([true, true])
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('revalidates a signed-out handoff using the anonymous Cloud rollout', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json(allowed))
    .mockResolvedValueOnce(Response.json(denied))
  const { visible } = start()
  await vi.waitFor(() => expect(visible()).toEqual([true, true]))

  await expect(bindLocalOpenOnCloudGrant().revalidate()).resolves.toBe(false)
  expect(visible()).toEqual([false, false])
  expect(fetch).toHaveBeenLastCalledWith(
    new URL('/api/features', getBuildTimeComfyCloudBaseUrl()),
    expect.objectContaining({ credentials: 'omit', headers: undefined })
  )
})
