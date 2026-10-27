import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

const distributionMocks = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => distributionMocks)
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyCloudBaseUrl: () => 'https://testcloud.comfy.org'
}))
vi.mock(import('@/scripts/api'))

import { ingestApiUrl as ingestApiUrl } from '@/platform/remote/ingest/ingestApiUrl'

describe('ingestApiUrl', () => {
  beforeEach(() => {
    distributionMocks.isCloud = false
    vi.mocked(api.apiURL).mockImplementation((route) => `/api${route}`)
  })

  it('uses the paired Cloud gateway outside Cloud', () => {
    expect(ingestApiUrl('/workspaces')).toBe(
      'https://testcloud.comfy.org/api/workspaces'
    )
  })

  it('keeps same-origin routing on Cloud', () => {
    distributionMocks.isCloud = true

    expect(ingestApiUrl('/workspaces')).toBe('/api/workspaces')
  })
})
