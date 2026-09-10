import { beforeEach, describe, expect, it, vi } from 'vitest'

const distributionMocks = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => distributionMocks)
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyCloudBaseUrl: () => 'https://testcloud.comfy.org'
}))
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { apiURL: (route: string) => `/api${route}` }
}))

import { workspaceApiUrl } from './workspaceApiUrl'

describe('workspaceApiUrl', () => {
  beforeEach(() => {
    distributionMocks.isCloud = false
  })

  it('uses the paired Cloud gateway outside Cloud', () => {
    expect(workspaceApiUrl('/workspaces')).toBe(
      'https://testcloud.comfy.org/api/workspaces'
    )
  })

  it('keeps same-origin routing on Cloud', () => {
    distributionMocks.isCloud = true

    expect(workspaceApiUrl('/workspaces')).toBe('/api/workspaces')
  })
})
