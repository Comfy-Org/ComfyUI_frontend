import { describe, expect, it, vi } from 'vitest'

import { isWorkshopInBuild, isWorkshopRoute } from './workshop-release'

describe('isWorkshopInBuild', () => {
  it.for([
    {
      name: 'production excludes Workshop',
      vercelEnv: 'production',
      expected: false
    },
    {
      name: 'preview excludes Workshop',
      vercelEnv: 'preview',
      expected: false
    },
    { name: 'an unset environment includes Workshop', expected: true },
    {
      name: 'development includes Workshop',
      vercelEnv: 'development',
      expected: true
    }
  ])('$name', ({ vercelEnv, expected }) => {
    vi.stubEnv('VERCEL_ENV', vercelEnv)
    vi.stubEnv('WORKSHOP_IN_BUILD', undefined)

    expect(isWorkshopInBuild()).toBe(expected)
  })

  it.for([
    {
      name: 'a preview can opt in',
      vercelEnv: 'preview',
      override: '1',
      expected: true
    },
    {
      name: 'local development can opt out',
      override: '0',
      expected: false
    }
  ])('$name', ({ vercelEnv, override, expected }) => {
    vi.stubEnv('VERCEL_ENV', vercelEnv)
    vi.stubEnv('WORKSHOP_IN_BUILD', override)

    expect(isWorkshopInBuild()).toBe(expected)
  })
})

describe('isWorkshopRoute', () => {
  it('claims the Workshop tree and nothing else', () => {
    expect(isWorkshopRoute('/workshop')).toBe(true)
    expect(isWorkshopRoute('/workshop/models/[slug]')).toBe(true)

    expect(isWorkshopRoute('/')).toBe(false)
    expect(isWorkshopRoute('/pricing')).toBe(false)
    // A sibling route that merely starts with the same letters must survive.
    expect(isWorkshopRoute('/workshops-are-elsewhere')).toBe(false)
  })
})
