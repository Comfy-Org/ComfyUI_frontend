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
    visible: () => flags.openOnCloudEnabled
  }
}

it('renders the served flag for the current account and clears it on identity changes', async () => {
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
