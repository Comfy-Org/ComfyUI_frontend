import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

import { getComfyApiBaseUrl, getComfyPlatformBaseUrl } from './comfyApi'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (route: string) => `/api${route}`,
    fetchApi: vi.fn()
  }
}))

vi.stubGlobal('fetch', vi.fn())

describe('getComfyApiBaseUrl', () => {
  const originalConfig = remoteConfig.value

  beforeEach(() => {
    remoteConfig.value = {}
  })

  afterEach(() => {
    remoteConfig.value = originalConfig
  })

  it('honors the server-provided override', () => {
    remoteConfig.value = { comfy_api_base_url: 'https://my-ephem.example.com' }
    expect(getComfyApiBaseUrl()).toBe('https://my-ephem.example.com')
  })

  it('falls back to the build-time default when the key is absent', () => {
    expect(getComfyApiBaseUrl()).toBe('https://stagingapi.comfy.org')
  })

  it('falls back to the build-time default when the value is empty', () => {
    remoteConfig.value = { comfy_api_base_url: '' }
    expect(getComfyApiBaseUrl()).toBe('https://stagingapi.comfy.org')
  })
})

describe('getComfyPlatformBaseUrl', () => {
  const originalConfig = remoteConfig.value

  beforeEach(() => {
    remoteConfig.value = {}
  })

  afterEach(() => {
    remoteConfig.value = originalConfig
  })

  it('honors the server-provided override', () => {
    remoteConfig.value = {
      comfy_platform_base_url: 'https://my-ephem-platform.example.com'
    }
    expect(getComfyPlatformBaseUrl()).toBe(
      'https://my-ephem-platform.example.com'
    )
  })

  it('falls back to the build-time default when the key is absent', () => {
    expect(getComfyPlatformBaseUrl()).toBe('https://stagingplatform.comfy.org')
  })

  it('falls back to the build-time default when the value is empty', () => {
    remoteConfig.value = { comfy_platform_base_url: '' }
    expect(getComfyPlatformBaseUrl()).toBe('https://stagingplatform.comfy.org')
  })
})

describe('compatibility with comfyui servers that predate the override keys', () => {
  const originalConfig = remoteConfig.value

  beforeEach(() => {
    vi.clearAllMocks()
    remoteConfig.value = {}
  })

  afterEach(() => {
    remoteConfig.value = originalConfig
  })

  it('falls back to build-time defaults when /features omits the URL keys', async () => {
    // An older comfyui server has /features but doesn't know about
    // comfy_api_base_url / comfy_platform_base_url yet.
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        supports_preview_metadata: true,
        max_upload_size: 104857600
      })
    } as Response)

    await refreshRemoteConfig({ useAuth: false })

    expect(getComfyApiBaseUrl()).toBe('https://stagingapi.comfy.org')
    expect(getComfyPlatformBaseUrl()).toBe('https://stagingplatform.comfy.org')
  })
})
