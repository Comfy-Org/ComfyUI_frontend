import { describe, expect, it, vi } from 'vitest'

import {
  assertWorkshopCloudEnvForBuild,
  isWorkshopInBuild,
  isWorkshopRoute
} from './workshop-release'

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
    expect(isWorkshopRoute('/models/demo/')).toBe(true)
    expect(isWorkshopRoute('/models/showcase/')).toBe(true)
    expect(isWorkshopRoute('/models')).toBe(false)
    expect(isWorkshopRoute('/models/')).toBe(false)

    expect(isWorkshopRoute('/')).toBe(false)
    expect(isWorkshopRoute('/pricing')).toBe(false)
    // A sibling route that merely starts with the same letters must survive.
    expect(isWorkshopRoute('/workshops-are-elsewhere')).toBe(false)
  })
})

describe('assertWorkshopCloudEnvForBuild', () => {
  it.for([
    { name: 'a local build needs no family' },
    { name: 'a local build may name one', family: 'test' },
    {
      name: 'a disabled production build ignores an invalid family',
      vercelEnv: 'production',
      inBuild: '0',
      family: 'production'
    },
    {
      name: 'a preview without Workshop ignores the family',
      vercelEnv: 'preview',
      family: 'prod'
    },
    {
      name: 'a production build with Workshop targets prod',
      vercelEnv: 'production',
      inBuild: '1',
      family: 'prod'
    },
    {
      name: 'a preview with Workshop may target staging',
      vercelEnv: 'preview',
      inBuild: '1',
      family: 'staging'
    },
    {
      name: 'a preview with Workshop may target test',
      vercelEnv: 'preview',
      inBuild: '1',
      family: 'test'
    }
  ])('$name', ({ vercelEnv, inBuild, family }) => {
    vi.stubEnv('VERCEL_ENV', vercelEnv)
    vi.stubEnv('WORKSHOP_IN_BUILD', inBuild)
    vi.stubEnv('PUBLIC_WORKSHOP_CLOUD_ENV', family)

    expect(() => assertWorkshopCloudEnvForBuild()).not.toThrow()
  })

  it.for([
    {
      name: 'a Workshop build rejects a misspelt family',
      vercelEnv: 'preview',
      inBuild: '1',
      family: 'production',
      message: /not one of prod, staging, test/
    },
    {
      name: 'a production build with Workshop must name its family',
      vercelEnv: 'production',
      inBuild: '1',
      message: /PUBLIC_WORKSHOP_CLOUD_ENV is unset/
    },
    {
      name: 'comfy.org may not reach staging',
      vercelEnv: 'production',
      inBuild: '1',
      family: 'staging',
      message: /may only reach prod Cloud/
    },
    {
      name: 'comfy.org may not reach test',
      vercelEnv: 'production',
      inBuild: '1',
      family: 'test',
      message: /may only reach prod Cloud/
    },
    {
      name: 'a preview with Workshop must name its family',
      vercelEnv: 'preview',
      inBuild: '1',
      message: /PUBLIC_WORKSHOP_CLOUD_ENV is unset/
    },
    {
      name: 'a preview with Workshop treats an empty family as unset',
      vercelEnv: 'preview',
      inBuild: '1',
      family: '',
      message: /PUBLIC_WORKSHOP_CLOUD_ENV is unset/
    },
    {
      name: 'a preview may not reach prod',
      vercelEnv: 'preview',
      inBuild: '1',
      family: 'prod',
      message: /may only reach staging or test Cloud/
    }
  ])('$name', ({ vercelEnv, inBuild, family, message }) => {
    vi.stubEnv('VERCEL_ENV', vercelEnv)
    vi.stubEnv('WORKSHOP_IN_BUILD', inBuild)
    vi.stubEnv('PUBLIC_WORKSHOP_CLOUD_ENV', family)

    expect(() => assertWorkshopCloudEnvForBuild()).toThrow(message)
  })
})
