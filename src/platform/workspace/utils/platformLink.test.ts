import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Distribution } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { platformLink, tagPlatformUrl } from './platformLink'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

const CLOUD_TAGS =
  'utm_source=comfy_cloud&utm_medium=app&utm_content=subscription-footer'

const BUILD_SOURCES: { distribution: Distribution; source: string }[] = [
  { distribution: 'localhost', source: 'comfyui' },
  { distribution: 'desktop', source: 'comfy_desktop' },
  { distribution: 'cloud', source: 'comfy_cloud' }
]

function setActiveWorkspace(id: string | null) {
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: id })
}

function usageLink(correlationId?: string) {
  return platformLink('/profile/usage', {
    surface: 'subscription-footer',
    correlationId
  })
}

describe('platformLink', () => {
  beforeEach(() => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    setActiveWorkspace(null)
  })

  it.for(BUILD_SOURCES)(
    'names the $distribution build as $source and the surface the link sits on',
    ({ distribution, source }) => {
      vi.stubGlobal('__DISTRIBUTION__', distribution)

      const { searchParams } = new URL(
        platformLink('/profile/deploy', { surface: 'deploy-setup-card' })
      )

      expect(Object.fromEntries(searchParams)).toEqual({
        utm_source: source,
        utm_medium: 'app',
        utm_content: 'deploy-setup-card'
      })
    }
  )

  it('carries the active workspace', () => {
    setActiveWorkspace('ws_team-1')

    expect(usageLink()).toBe(
      `https://platform.comfy.org/profile/usage?${CLOUD_TAGS}&workspace=ws_team-1`
    )
  })

  it('omits the workspace when there is no active workspace', () => {
    expect(usageLink()).toBe(
      `https://platform.comfy.org/profile/usage?${CLOUD_TAGS}`
    )
  })

  it('keeps the query already on the path and replaces its workspace instead of adding a second', () => {
    setActiveWorkspace('ws_team-1')

    const { searchParams } = new URL(
      platformLink('/profile/usage?tab=a&workspace=stale', {
        surface: 'subscription-footer'
      })
    )

    expect(searchParams.getAll('workspace')).toEqual(['ws_team-1'])
    expect(searchParams.get('tab')).toBe('a')
  })

  it('replaces tags already on the path instead of adding a second set', () => {
    const { searchParams } = new URL(
      platformLink('/profile/usage?utm_source=stale&utm_content=stale', {
        surface: 'subscription-footer'
      })
    )

    expect(searchParams.getAll('utm_source')).toEqual(['comfy_cloud'])
    expect(searchParams.getAll('utm_medium')).toEqual(['app'])
    expect(searchParams.getAll('utm_content')).toEqual(['subscription-footer'])
  })

  it('never sets a campaign', () => {
    expect(
      new URL(usageLink('journey-1')).searchParams.has('utm_campaign')
    ).toBe(false)
  })

  it('omits a workspace id outside the link charset rather than throwing', () => {
    setActiveWorkspace('bad/id')

    expect(usageLink()).toBe(
      `https://platform.comfy.org/profile/usage?${CLOUD_TAGS}`
    )
  })

  it.for([
    {
      workspace: 'ws_team-1',
      expected: `https://platform.comfy.org/profile/usage?${CLOUD_TAGS}&correlation_id=journey-1&workspace=ws_team-1`
    },
    {
      workspace: null,
      expected: `https://platform.comfy.org/profile/usage?${CLOUD_TAGS}&correlation_id=journey-1`
    }
  ])(
    'carries the correlation id with workspace $workspace',
    ({ workspace, expected }) => {
      setActiveWorkspace(workspace)

      expect(usageLink('journey-1')).toBe(expected)
    }
  )
})

describe('tagPlatformUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')
  })

  it('tags a URL built elsewhere and keeps its query', () => {
    expect(
      tagPlatformUrl(
        'https://platform.comfy.org/profile/builds/new?step=import&bundle=b-1&workspace=ws-1',
        'deploy-installation-button'
      )
    ).toBe(
      'https://platform.comfy.org/profile/builds/new?step=import&bundle=b-1&workspace=ws-1&utm_source=comfyui&utm_medium=app&utm_content=deploy-installation-button'
    )
  })

  it('keeps a one-time token in the fragment, out of the query', () => {
    const url = new URL(
      tagPlatformUrl(
        'https://platform.comfy.org/billing/handoff?intent=billing#token=secret',
        'billing-tab'
      )
    )

    expect(url.hash).toBe('#token=secret')
    expect(url.search).not.toContain('secret')
    expect(url.searchParams.get('utm_content')).toBe('billing-tab')
  })

  it('returns text that is not a URL unchanged', () => {
    expect(tagPlatformUrl('not a url', 'billing-tab')).toBe('not a url')
  })
})
