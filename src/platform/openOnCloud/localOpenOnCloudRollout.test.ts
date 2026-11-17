import { expect, it, onTestFinished, vi } from 'vitest'
import { ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { getBuildTimeComfyCloudBaseUrl } from '@/config/comfyApi'
import { startLocalOpenOnCloudRollout } from '@/platform/openOnCloud/localOpenOnCloudRollout'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'

vi.mock(import('@/scripts/api'))

const allowed = {
  open_on_cloud_enabled: true,
  open_on_cloud_use_local_agent_enabled: true
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function start(getToken = async (userId: string | undefined) => userId) {
  const userId = ref<string>()
  onTestFinished(
    startLocalOpenOnCloudRollout(
      () => userId.value,
      () => getToken(userId.value)
    )
  )
  vi.mocked(api.getServerFeature).mockImplementation(
    (_path, defaultValue) => defaultValue
  )
  const previousConfig = remoteConfig.value
  remoteConfig.value = {
    comfy_cloud_base_url: 'https://runtime.example.com',
    open_on_cloud_enabled: true
  }
  onTestFinished(() => {
    remoteConfig.value = previousConfig
  })
  const { flags } = useFeatureFlags()
  return {
    userId,
    visible: () => flags.openOnCloudEnabled
  }
}

it('clears access on identity changes even when local config enables the flag', async () => {
  const { userId, visible } = start()
  const denies = deferredResponse()
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json(allowed))
    .mockReturnValueOnce(denies.promise)

  expect(visible()).toBe(false)
  expect(fetch).not.toHaveBeenCalled()

  userId.value = 'employee-token'
  await vi.waitFor(() => expect(visible()).toBe(true))
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    new URL('/api/features', getBuildTimeComfyCloudBaseUrl()),
    expect.objectContaining({
      headers: { Authorization: 'Bearer employee-token' },
      redirect: 'error'
    })
  )

  userId.value = 'other-token'
  expect(visible()).toBe(false)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  denies.resolve(
    Response.json({
      open_on_cloud_enabled: true,
      open_on_cloud_use_local_agent_enabled: false
    })
  )
  await vi.waitFor(() => expect(visible()).toBe(true))
  userId.value = undefined
  expect(visible()).toBe(false)
})

it('ignores a grant returned after sign-out and renders a denied account as off', async () => {
  const { userId, visible } = start()
  const grant = deferredResponse()
  vi.mocked(fetch)
    .mockReturnValueOnce(grant.promise)
    .mockResolvedValueOnce(
      Response.json({
        open_on_cloud_enabled: false,
        open_on_cloud_use_local_agent_enabled: false
      })
    )

  userId.value = 'employee-token'
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  userId.value = undefined
  grant.resolve(Response.json(allowed))
  await vi.advanceTimersByTimeAsync(0)
  expect(visible()).toBe(false)

  userId.value = 'other-token'
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  await vi.advanceTimersByTimeAsync(0)
  expect(visible()).toBe(false)
})

it('recovers for the same account after a missing token and a temporary Cloud error', async () => {
  const getToken = vi
    .fn(async (userId: string | undefined) => userId)
    .mockResolvedValueOnce(undefined)
  const { userId, visible } = start(getToken)
  vi.mocked(fetch)
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json(allowed))

  userId.value = 'employee-token'
  expect(visible()).toBe(false)
  await vi.advanceTimersByTimeAsync(1_500)

  expect(visible()).toBe(true)
  expect(getToken).toHaveBeenCalledTimes(3)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('stops retrying when the account signs out during backoff', async () => {
  const { userId, visible } = start()
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network offline'))

  userId.value = 'employee-token'
  await vi.advanceTimersByTimeAsync(0)
  userId.value = undefined
  await vi.advanceTimersByTimeAsync(2_000)

  expect(visible()).toBe(false)
  expect(fetch).toHaveBeenCalledOnce()
})
