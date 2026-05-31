import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

import { getComfyApiBaseUrl, getComfyPlatformBaseUrl } from './comfyApi'

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
