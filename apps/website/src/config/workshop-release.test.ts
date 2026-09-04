import { afterEach, describe, expect, it } from 'vitest'

import { isWorkshopInBuild, isWorkshopRoute } from './workshop-release'

const saved = {
  vercel: process.env.VERCEL_ENV,
  override: process.env.WORKSHOP_IN_BUILD
}

afterEach(() => {
  process.env.VERCEL_ENV = saved.vercel
  process.env.WORKSHOP_IN_BUILD = saved.override
  if (saved.vercel === undefined) delete process.env.VERCEL_ENV
  if (saved.override === undefined) delete process.env.WORKSHOP_IN_BUILD
})

describe('isWorkshopInBuild', () => {
  it('keeps Workshop out of a production build', () => {
    // The whole point: an unfinished feature must not be reachable at a URL
    // on comfy.org, and noindex does not achieve that.
    process.env.VERCEL_ENV = 'production'
    delete process.env.WORKSHOP_IN_BUILD

    expect(isWorkshopInBuild()).toBe(false)
  })

  it('keeps Workshop in preview and local builds, where it is reviewed', () => {
    delete process.env.WORKSHOP_IN_BUILD

    process.env.VERCEL_ENV = 'preview'
    expect(isWorkshopInBuild()).toBe(true)

    delete process.env.VERCEL_ENV
    expect(isWorkshopInBuild()).toBe(true)
  })

  it('launches on an explicit override, with no code change', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.WORKSHOP_IN_BUILD = '1'

    expect(isWorkshopInBuild()).toBe(true)
  })

  it('can be forced off in a preview too', () => {
    // So the exact release output can be reviewed before it is released.
    process.env.VERCEL_ENV = 'preview'
    process.env.WORKSHOP_IN_BUILD = '0'

    expect(isWorkshopInBuild()).toBe(false)
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
