import { describe, expect, it } from 'vitest'

import { isMediaRoute, scopeMediaRoute } from './sessionMediaUrl'

describe('isMediaRoute', () => {
  it.for([
    '/api/view?filename=a.png',
    '/view',
    '/api/assets/abc/content',
    '/api/assets/abc/content#t=10',
    '/api/assets/abc/content?x=1#t=10'
  ])('matches %s', (route) => {
    expect(isMediaRoute(route)).toBe(true)
  })

  it.for(['/api/queue', '/api/assets/abc', '/api/assets/abc/content/more'])(
    'does not match %s',
    (route) => {
      expect(isMediaRoute(route)).toBe(false)
    }
  )
})

describe('scopeMediaRoute', () => {
  it('starts the query on a route without one', () => {
    expect(scopeMediaRoute('/api/view', 'ws 1')).toBe(
      '/api/view?workspace_id=ws%201'
    )
  })

  it('appends to an existing query', () => {
    expect(scopeMediaRoute('/api/view?filename=a.mp4', 'ws-1')).toBe(
      '/api/view?filename=a.mp4&workspace_id=ws-1'
    )
  })

  it('inserts the param before a fragment', () => {
    expect(scopeMediaRoute('/api/assets/abc/content#t=10', 'ws-1')).toBe(
      '/api/assets/abc/content?workspace_id=ws-1#t=10'
    )
    expect(scopeMediaRoute('/api/view?filename=a.mp4#t=10', 'ws-1')).toBe(
      '/api/view?filename=a.mp4&workspace_id=ws-1#t=10'
    )
  })

  it('ignores a workspace_id that only appears in the fragment', () => {
    expect(scopeMediaRoute('/api/view?a=1#?workspace_id=x', 'ws-1')).toBe(
      '/api/view?a=1&workspace_id=ws-1#?workspace_id=x'
    )
  })

  it('keeps a workspace_id already in the query', () => {
    const route = '/api/view?workspace_id=other#t=10'

    expect(scopeMediaRoute(route, 'ws-1')).toBe(route)
  })

  it('leaves non-media routes and a missing workspace alone', () => {
    expect(scopeMediaRoute('/api/queue', 'ws-1')).toBe('/api/queue')
    expect(scopeMediaRoute('/api/view', undefined)).toBe('/api/view')
  })
})
