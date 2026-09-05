import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

import {
  getComfyApiBaseUrl,
  getComfyCloudBaseUrl,
  getComfyPlatformBaseUrl
} from './comfyApi'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (route: string) => `/api${route}`,
    fetchApi: vi.fn()
  }
}))

interface BaseUrlCase {
  label: string
  getBaseUrl: () => string
  setOverride: (value: string) => void
  defaultUrl: string
}

const baseUrlCases: BaseUrlCase[] = [
  {
    label: 'API',
    getBaseUrl: getComfyApiBaseUrl,
    setOverride: (value) => {
      remoteConfig.value = { comfy_api_base_url: value }
    },
    defaultUrl: 'https://stagingapi.comfy.org'
  },
  {
    label: 'Cloud',
    getBaseUrl: getComfyCloudBaseUrl,
    setOverride: (value) => {
      remoteConfig.value = { comfy_cloud_base_url: value }
    },
    defaultUrl: 'https://testcloud.comfy.org'
  },
  {
    label: 'Platform',
    getBaseUrl: getComfyPlatformBaseUrl,
    setOverride: (value) => {
      remoteConfig.value = { comfy_platform_base_url: value }
    },
    defaultUrl: 'https://stagingplatform.comfy.org'
  }
]

describe.for(baseUrlCases)(
  '$label base URL',
  ({ getBaseUrl, setOverride, defaultUrl }) => {
    const originalConfig = remoteConfig.value

    beforeEach(() => {
      remoteConfig.value = {}
    })

    afterEach(() => {
      remoteConfig.value = originalConfig
    })

    it('honors a server-provided HTTPS override', () => {
      setOverride('https://custom.example.com')
      expect(getBaseUrl()).toBe('https://custom.example.com')
    })

    it('removes a trailing slash from the override', () => {
      setOverride('https://custom.example.com/')
      expect(getBaseUrl()).toBe('https://custom.example.com')
    })

    it.for([undefined, '', 'not-a-url', 'http://custom.example.com'])(
      'falls back to the build-time default for %s',
      (override) => {
        if (override !== undefined) setOverride(override)
        expect(getBaseUrl()).toBe(defaultUrl)
      }
    )
  }
)

describe('compatibility with comfyui servers that predate the override keys', () => {
  const originalConfig = remoteConfig.value

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    remoteConfig.value = {}
  })

  afterEach(() => {
    remoteConfig.value = originalConfig
  })

  it('falls back to build-time defaults when /features omits the URL keys', async () => {
    // An older comfyui server has /features but doesn't know about
    // comfy_api_base_url / comfy_cloud_base_url / comfy_platform_base_url yet.
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        supports_preview_metadata: true,
        max_upload_size: 104857600
      })
    } as Response)

    await refreshRemoteConfig({ useAuth: false })

    expect(getComfyApiBaseUrl()).toBe('https://stagingapi.comfy.org')
    expect(getComfyCloudBaseUrl()).toBe('https://testcloud.comfy.org')
    expect(getComfyPlatformBaseUrl()).toBe('https://stagingplatform.comfy.org')
  })
})
