import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  platformFrameOrigin,
  platformFrameUrl,
  platformVersionPageUrl
} from './platformFrameUrl'
import type { PlatformFrameRequest } from './platformFrameUrl'

const base = vi.hoisted(() => ({ url: 'https://platform.comfy.org' }))

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => base.url
}))

function paramsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href).searchParams)
}

beforeEach(() => {
  base.url = 'https://platform.comfy.org'
})

describe('platformFrameUrl', () => {
  it.for<{ label: string; request: PlatformFrameRequest; params: object }>([
    {
      label: 'a new deployment at its nodes',
      request: { step: 'new', startAtNodes: true },
      params: { step: 'new', start: 'nodes' }
    },
    {
      label: 'a new deployment for the open workflow',
      request: { step: 'new', handsOverWorkflow: true },
      params: { step: 'new' }
    },
    {
      label: 'an update of a deployment',
      request: { step: 'update', deploymentId: 'dep-1' },
      params: { step: 'update', deployment: 'dep-1' }
    },
    {
      label: 'the nodes of a deployment',
      request: { step: 'nodes', deploymentId: 'dep-1' },
      params: { step: 'nodes', deployment: 'dep-1' }
    },
    {
      label: 'the models of a deployment',
      request: { step: 'models', deploymentId: 'dep-1' },
      params: { step: 'models', deployment: 'dep-1' }
    },
    {
      label: 'a started version to follow again',
      request: { step: 'follow', releaseId: 'r-2', version: 2 },
      params: { step: 'follow', release: 'r-2', version: '2' }
    }
  ])('asks Platform for $label', ({ request, params }) => {
    expect(paramsOf(platformFrameUrl(request, 'ws-1'))).toEqual({
      ...params,
      workspace: 'ws-1',
      parent: window.location.origin
    })
  })

  it('opens the embed page on the Platform base, without a doubled slash', () => {
    base.url = 'https://stagingplatform.comfy.org/'
    const url = new URL(platformFrameUrl({ step: 'new' }, null))
    expect(url.origin).toBe('https://stagingplatform.comfy.org')
    expect(url.pathname).toBe('/embed/custom-deployment')
  })

  it('leaves out the workspace when the editor has none', () => {
    expect(paramsOf(platformFrameUrl({ step: 'new' }, null))).toEqual({
      step: 'new',
      parent: window.location.origin
    })
  })

  it('sends a release to follow only on the follow step', () => {
    expect(
      paramsOf(
        platformFrameUrl(
          { step: 'update', deploymentId: 'dep-1', releaseId: 'r-2' },
          'ws-1'
        )
      )
    ).not.toHaveProperty('release')
  })

  it('starts at nodes only for a new deployment', () => {
    expect(
      paramsOf(
        platformFrameUrl(
          { step: 'update', deploymentId: 'dep-1', startAtNodes: true },
          'ws-1'
        )
      )
    ).not.toHaveProperty('start')
  })
})

describe('platformFrameOrigin', () => {
  it.for([
    { url: 'https://platform.comfy.org', origin: 'https://platform.comfy.org' },
    { url: 'http://localhost:3000/', origin: 'http://localhost:3000' },
    { url: 'javascript:alert(1)', origin: null },
    { url: 'not a url', origin: null }
  ])('reads $url as $origin', ({ url, origin }) => {
    base.url = url
    expect(platformFrameOrigin()).toBe(origin)
  })
})

describe('platformVersionPageUrl', () => {
  const version = { buildId: 'b-1', releaseId: 'r-2', workspaceId: 'ws-1' }

  it('opens the version on Platform in its workspace', () => {
    expect(platformVersionPageUrl(version)).toBe(
      'https://platform.comfy.org/profile/builds/b-1/releases/r-2?workspace=ws-1'
    )
  })

  it('opens its deployments for a failed deploy', () => {
    expect(platformVersionPageUrl(version, 'deployments')).toBe(
      'https://platform.comfy.org/profile/builds/b-1/releases/r-2?workspace=ws-1#deployments'
    )
  })

  it('keeps the ids inside their path parts and leaves out a missing workspace', () => {
    base.url = 'https://stagingplatform.comfy.org/'
    expect(
      platformVersionPageUrl({
        buildId: 'b/1',
        releaseId: 'r?2',
        workspaceId: null
      })
    ).toBe(
      'https://stagingplatform.comfy.org/profile/builds/b%2F1/releases/r%3F2'
    )
  })
})
