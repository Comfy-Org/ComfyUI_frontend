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

  it('keeps Workshop out of a preview, so preview matches production', () => {
    // A preview exists to answer "what goes out if we release right now?".
    // If it carries an unreleased feature it cannot answer that.
    process.env.VERCEL_ENV = 'preview'
    delete process.env.WORKSHOP_IN_BUILD

    expect(isWorkshopInBuild()).toBe(false)
  })

  it('keeps Workshop in local development, where it is being built', () => {
    delete process.env.WORKSHOP_IN_BUILD
    delete process.env.VERCEL_ENV

    expect(isWorkshopInBuild()).toBe(true)
  })

  it('gives an unrecognised VERCEL_ENV the local answer', () => {
    // `vercel dev` sets VERCEL_ENV=development. That is a developer's machine,
    // not a deployment, so it behaves like local rather than like a release.
    delete process.env.WORKSHOP_IN_BUILD
    process.env.VERCEL_ENV = 'development'

    expect(isWorkshopInBuild()).toBe(true)
  })

  it('puts Workshop in a deployed build on an explicit override', () => {
    // Two users: CI on a PR labelled `workshop`, to get a review URL...
    process.env.VERCEL_ENV = 'preview'
    process.env.WORKSHOP_IN_BUILD = '1'
    expect(isWorkshopInBuild()).toBe(true)

    // ...and production on the day Workshop launches. No code change either.
    process.env.VERCEL_ENV = 'production'
    expect(isWorkshopInBuild()).toBe(true)
  })

  it('can be forced off locally, to reproduce a release build', () => {
    delete process.env.VERCEL_ENV
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
