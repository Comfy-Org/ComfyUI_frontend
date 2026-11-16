import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Distribution } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { platformLink } from './platformLink'

const build = vi.hoisted(() => ({
  distribution: 'cloud' as 'desktop' | 'localhost' | 'cloud'
}))

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return build.distribution === 'cloud'
  },
  get isDesktop() {
    return build.distribution === 'desktop'
  }
}))

function setDistribution(distribution: Distribution) {
  build.distribution = distribution
}

function setActiveWorkspace(id: string | null) {
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: id })
}

describe('platformLink', () => {
  beforeEach(() => {
    setDistribution('cloud')
    setActiveWorkspace(null)
  })

  it.for([
    { distribution: 'cloud', returnTo: 'comfyui_workspace' },
    { distribution: 'localhost', returnTo: 'comfyui_local' },
    { distribution: 'desktop', returnTo: 'comfyui_local' }
  ] as const)(
    'names $returnTo as the return target on a $distribution build',
    ({ distribution, returnTo }) => {
      setDistribution(distribution)

      const url = new URL(platformLink('/profile/usage'))

      expect(url.searchParams.getAll('return_to')).toEqual([returnTo])
    }
  )

  it('links a local build with no active workspace to the path with only its return target', () => {
    setDistribution('localhost')

    expect(platformLink('/login')).toBe(
      'https://platform.comfy.org/login?return_to=comfyui_local'
    )
  })

  it('carries the paywall the person saw as the source', () => {
    const url = new URL(
      platformLink('/profile/billing/plans', 'journey-1', 'subscribe_to_run')
    )

    expect(url.searchParams.get('source')).toBe('subscribe_to_run')
  })

  it.for(['cloud', 'desktop', 'not_a_paywall', '', undefined])(
    'leaves off a source of %s, which names no paywall',
    (source) => {
      const url = new URL(
        platformLink('/profile/billing/plans', 'journey-1', source)
      )

      expect(url.searchParams.has('source')).toBe(false)
    }
  )

  it('carries the active workspace', () => {
    setActiveWorkspace('ws_team-1')

    expect(platformLink('/profile/usage')).toBe(
      'https://platform.comfy.org/profile/usage?return_to=comfyui_workspace&workspace=ws_team-1'
    )
  })

  it('omits the workspace when there is no active workspace', () => {
    expect(platformLink('/profile/usage')).toBe(
      'https://platform.comfy.org/profile/usage?return_to=comfyui_workspace'
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
      'https://platform.comfy.org/profile/usage?return_to=comfyui_workspace'
    )
  })

  it.for([
    {
      workspace: 'ws_team-1',
      expected:
        'https://platform.comfy.org/profile/usage?correlation_id=journey-1&return_to=comfyui_workspace&workspace=ws_team-1'
    },
    {
      workspace: null,
      expected:
        'https://platform.comfy.org/profile/usage?correlation_id=journey-1&return_to=comfyui_workspace'
    }
  ])(
    'carries the correlation id with workspace $workspace',
    ({ workspace, expected }) => {
      setActiveWorkspace(workspace)

      expect(platformLink('/profile/usage', 'journey-1')).toBe(expected)
    }
  )
})
