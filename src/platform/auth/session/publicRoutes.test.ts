import { describe, expect, it } from 'vitest'

import { isPublicRoute } from '@/platform/auth/session/publicRoutes'

describe('isPublicRoute', () => {
  it('recognises a public route by name when the path does not match', () => {
    expect(isPublicRoute({ name: 'cloud-login', path: '/elsewhere' })).toBe(
      true
    )
  })

  it('recognises a public route by path when the name does not match', () => {
    // Navigations that have not resolved a name yet still have to be let past.
    expect(isPublicRoute({ name: 'GraphView', path: '/cloud/login' })).toBe(
      true
    )
  })

  it('treats the canvas as private, so the auth guard still runs there', () => {
    expect(isPublicRoute({ name: 'GraphView', path: '/' })).toBe(false)
  })
})
