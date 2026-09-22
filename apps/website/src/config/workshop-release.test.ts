import { describe, expect, it, vi } from 'vitest'

import {
  assertWorkshopCloudEnvForBuild,
  isWorkshopInBuild
} from './workshop-release'

describe('isWorkshopInBuild', () => {
  it.for([
    {
      name: 'production includes Workshop',
      vercelEnv: 'production',
      expected: true
    },
    {
      name: 'preview includes Workshop',
      vercelEnv: 'preview',
      expected: true
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
      inBuild: '0',
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
