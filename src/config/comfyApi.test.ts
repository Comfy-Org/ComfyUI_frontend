import { describe, expect, it } from 'vitest'

import { getComfyApiBaseUrlForEnvironment } from '@/config/comfyApi'

describe('comfy api config', () => {
  it('uses same-origin API calls for cloud local development', () => {
    expect(
      getComfyApiBaseUrlForEnvironment({
        isCloudDistribution: true,
        isDev: true,
        devServerComfyUIUrl: 'http://127.0.0.1:8188',
        useProdConfig: false
      })
    ).toBe('')
  })

  it('keeps staging API for non-local staging builds', () => {
    expect(
      getComfyApiBaseUrlForEnvironment({
        isCloudDistribution: true,
        isDev: false,
        useProdConfig: false
      })
    ).toBe('https://stagingapi.comfy.org')
  })
})
