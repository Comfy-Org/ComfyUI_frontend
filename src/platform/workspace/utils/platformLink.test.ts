import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { platformLink } from './platformLink'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

function setActiveWorkspace(id: string | null) {
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: id })
}

describe('platformLink', () => {
  beforeEach(() => {
    setActiveWorkspace(null)
  })

  it('carries the active workspace', () => {
    setActiveWorkspace('ws_team-1')

    expect(platformLink('/profile/usage')).toBe(
      'https://platform.comfy.org/profile/usage?workspace=ws_team-1'
    )
  })

  it('omits the workspace when there is no active workspace', () => {
    expect(platformLink('/profile/usage')).toBe(
      'https://platform.comfy.org/profile/usage'
    )
  })

  it('replaces a workspace already on the path instead of adding a second', () => {
    setActiveWorkspace('ws_team-1')

    const url = new URL(platformLink('/profile/usage?tab=a&workspace=stale'))

    expect(url.searchParams.getAll('workspace')).toEqual(['ws_team-1'])
    expect(url.searchParams.get('tab')).toBe('a')
  })

  it('omits a workspace id outside the link charset rather than throwing', () => {
    setActiveWorkspace('bad/id')

    expect(platformLink('/profile/usage')).toBe(
      'https://platform.comfy.org/profile/usage'
    )
  })
})
