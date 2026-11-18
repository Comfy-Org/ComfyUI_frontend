import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import {
  platformLink,
  platformLinkRel,
  platformLinkWindowFeatures,
  platformSurfaceLink,
  tagPlatformUrl
} from './platformLink'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

const TAGS = 'utm_source=comfyui&utm_medium=app'

function setActiveWorkspace(id: string | null) {
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: id })
}

describe('platformLink', () => {
  beforeEach(() => {
    setActiveWorkspace(null)
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')
  })

  it.for([
    {
      distribution: 'localhost',
      source: 'comfyui',
      rel: 'noopener noreferrer'
    },
    {
      distribution: 'desktop',
      source: 'comfy_desktop',
      rel: 'noopener noreferrer'
    },
    { distribution: 'cloud', source: 'comfy_cloud', rel: 'noopener' }
  ] as const)(
    'names the $distribution build, and only Cloud sends a referrer',
    ({ distribution, source, rel }) => {
      vi.stubGlobal('__DISTRIBUTION__', distribution)

      expect(platformLink('/profile/usage')).toBe(
        `https://platform.comfy.org/profile/usage?utm_source=${source}&utm_medium=app`
      )
      expect(platformLinkRel()).toBe(rel)
      expect(platformLinkWindowFeatures()).toBe(rel.replace(' ', ','))
    }
  )

  it('names Desktop when a local build runs inside the Desktop host', () => {
    vi.stubGlobal('__comfyDesktop2', {})

    expect(platformLink('/profile/usage')).toContain('utm_source=comfy_desktop')
  })

  it('names the surface the link sits on and never sets a campaign', () => {
    const url = new URL(
      platformSurfaceLink('/profile/builds', 'deployment-switcher')
    )

    expect(url.searchParams.get('utm_content')).toBe('deployment-switcher')
    expect(url.searchParams.has('utm_campaign')).toBe(false)
  })

  it('carries the active workspace', () => {
    setActiveWorkspace('ws_team-1')

    expect(platformLink('/profile/usage')).toBe(
      `https://platform.comfy.org/profile/usage?${TAGS}&workspace=ws_team-1`
    )
  })

  it('keeps the query on the path and replaces its tags and workspace instead of adding a second', () => {
    setActiveWorkspace('ws_team-1')

    const url = new URL(
      platformLink('/profile/usage?tab=a&workspace=stale&utm_source=stale')
    )

    expect(url.searchParams.getAll('workspace')).toEqual(['ws_team-1'])
    expect(url.searchParams.getAll('utm_source')).toEqual(['comfyui'])
    expect(url.searchParams.get('tab')).toBe('a')
  })

  it('omits a workspace id outside the link charset rather than throwing', () => {
    setActiveWorkspace('bad/id')

    expect(platformLink('/profile/usage')).toBe(
      `https://platform.comfy.org/profile/usage?${TAGS}`
    )
  })

  it.for([
    {
      workspace: 'ws_team-1',
      expected: `https://platform.comfy.org/profile/usage?${TAGS}&correlation_id=journey-1&workspace=ws_team-1`
    },
    {
      workspace: null,
      expected: `https://platform.comfy.org/profile/usage?${TAGS}&correlation_id=journey-1`
    }
  ])(
    'carries the correlation id with workspace $workspace',
    ({ workspace, expected }) => {
      setActiveWorkspace(workspace)

      expect(platformLink('/profile/usage', 'journey-1')).toBe(expected)
    }
  )
})

describe('tagPlatformUrl', () => {
  it('tags a URL built elsewhere, keeping its query and its one-time token in the fragment', () => {
    expect(
      tagPlatformUrl(
        'https://platform.comfy.org/billing/handoff?intent=billing#token=secret',
        'deploy-installation-button'
      )
    ).toBe(
      `https://platform.comfy.org/billing/handoff?intent=billing&${TAGS}&utm_content=deploy-installation-button#token=secret`
    )
  })

  it('returns text that is not a URL unchanged', () => {
    expect(tagPlatformUrl('not a url')).toBe('not a url')
  })
})
