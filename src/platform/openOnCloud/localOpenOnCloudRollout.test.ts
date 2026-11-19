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

function start() {
  const userId = ref<string>()
  const getToken = async () => userId.value
  onTestFinished(startLocalOpenOnCloudRollout(() => userId.value, getToken))
  vi.mocked(api.getServerFeature).mockImplementation(
    (_path, defaultValue) => defaultValue
  )
  const previousConfig = remoteConfig.value
  remoteConfig.value = { comfy_cloud_base_url: 'https://runtime.example.com' }
  onTestFinished(() => {
    remoteConfig.value = previousConfig
  })
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
