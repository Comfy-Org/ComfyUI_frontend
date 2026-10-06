import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { provideWebSessionRequests } from '@/platform/auth/session/webSessionFetch'
import type { WebSessionRequests } from '@/platform/auth/session/webSessionFetch'
import { resolveMediaSrc } from '@/platform/assets/utils/assetUrlUtil'

describe('resolveMediaSrc', () => {
  let release: (() => void) | undefined

  function startWebSession(workspaceId: string | undefined) {
    release = provideWebSessionRequests(
      fromPartial<WebSessionRequests>({ workspaceId: () => workspaceId })
    )
  }

  beforeEach(() => startWebSession('ws-1'))

  afterEach(() => {
    release?.()
    release = undefined
  })

  it('names the workspace on a relative assets content URL', () => {
    expect(resolveMediaSrc('/api/assets/abc/content')).toBe(
      '/api/assets/abc/content?workspace_id=ws-1'
    )
  })

  it('keeps existing query params and does not double-prefix /api', () => {
    expect(resolveMediaSrc('/api/view?filename=a.mp4&type=output')).toBe(
      '/api/view?filename=a.mp4&type=output&workspace_id=ws-1'
    )
  })

  it('adds the /api prefix to a media route that lacks it', () => {
    expect(resolveMediaSrc('/view?filename=a.mp4')).toBe(
      '/api/view?filename=a.mp4&workspace_id=ws-1'
    )
  })

  it('does not add a second workspace_id', () => {
    const url = '/api/view?filename=a.mp4&workspace_id=other'

    expect(resolveMediaSrc(url)).toBe(url)
  })

  it('leaves the URL as is when there is no workspace to name', () => {
    release?.()
    startWebSession(undefined)

    expect(resolveMediaSrc('/api/assets/abc/content')).toBe(
      '/api/assets/abc/content'
    )
  })

  it('leaves the URL as is when the web session is off', () => {
    release?.()
    release = undefined

    expect(resolveMediaSrc('/api/assets/abc/content')).toBe(
      '/api/assets/abc/content'
    )
  })

  it.for([
    'https://storage.googleapis.com/bucket/a.mp4?X-Goog-Signature=abc',
    'http://localhost:8188/api/view?filename=a.mp4',
    'blob:http://localhost/1234',
    'data:video/mp4;base64,AAAA',
    '//cdn.example.com/api/view?filename=a.mp4'
  ])('leaves %s untouched', (url) => {
    expect(resolveMediaSrc(url)).toBe(url)
  })

  it.for(['/api/queue', '/api/assets/abc', '/some/other/route'])(
    'leaves the non-media route %s untouched',
    (url) => {
      expect(resolveMediaSrc(url)).toBe(url)
    }
  )

  it.for([undefined, ''])('returns an empty string for %j', (url) => {
    expect(resolveMediaSrc(url)).toBe('')
  })
})
