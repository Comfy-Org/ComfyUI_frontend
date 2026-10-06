import { describe, expect, it } from 'vitest'

import {
  auditPublishedModelPages,
  isModelPagePath,
  recordModelPages,
  unrecordedModelPages
} from './published-model-pages'

const flux = '/hub/models/flux-pro/'
const localFlux = '/hub/models/local/flux-dev/'
const hub = '/hub/models/'

const redirectFrom = (
  source: string,
  destination: string,
  permanent = true
) => ({
  source,
  destination,
  permanent
})

describe('auditPublishedModelPages', () => {
  it.for([
    {
      name: 'a live page',
      live: [flux, localFlux],
      redirects: [],
      errors: []
    },
    {
      name: 'a removed page with no redirect',
      live: [flux],
      redirects: [],
      errors: [
        `${localFlux} removed: add a permanent redirect in src/config/redirects.ts or restore the page`
      ]
    },
    {
      name: 'a removed page with a permanent redirect to a live page',
      live: [flux],
      redirects: [redirectFrom(localFlux, flux)],
      errors: []
    },
    {
      name: 'a removed page whose redirect only covers the bare path',
      live: [flux],
      redirects: [redirectFrom('/hub/models/local/flux-dev', flux)],
      errors: [
        `${localFlux} removed: add a permanent redirect in src/config/redirects.ts or restore the page`
      ]
    },
    {
      name: 'a removed page with a temporary redirect',
      live: [flux],
      redirects: [redirectFrom(localFlux, flux, false)],
      errors: [
        `${localFlux} removed: its redirect to ${flux} is temporary; make it permanent in src/config/redirects.ts`
      ]
    },
    {
      name: 'a removed page that redirects to another removed page',
      live: [hub],
      redirects: [redirectFrom(localFlux, flux), redirectFrom(flux, hub)],
      errors: [
        `${localFlux} removed: its redirect lands on ${flux}, which is not a published page`
      ]
    }
  ])('reports $name', ({ live, redirects, errors }) => {
    expect(
      auditPublishedModelPages({
        published: [flux, localFlux],
        live: new Set(live),
        redirects,
        retiredWithoutRedirect: {}
      })
    ).toEqual(errors)
  })

  it.for([
    { reason: 'no relevant target, stays 404', errors: [] },
    { reason: ' ', errors: [`${localFlux} is retired without a reason`] }
  ])(
    'accepts a retired page only with a reason: "$reason"',
    ({ reason, errors }) => {
      expect(
        auditPublishedModelPages({
          published: [flux, localFlux],
          live: new Set([flux]),
          redirects: [],
          retiredWithoutRedirect: { [localFlux]: reason }
        })
      ).toEqual(errors)
    }
  )
})

describe('isModelPagePath', () => {
  const roots = ['/hub/models', '/p/supported-models']
  const locales = ['', '/zh-CN']

  it.for([
    { path: hub, expected: true },
    { path: localFlux, expected: true },
    { path: '/p/supported-models/flux1-dev-fp8/', expected: true },
    { path: '/zh-CN/hub/models/flux-pro/', expected: true },
    { path: '/hub/models-guide/', expected: false },
    { path: '/pricing/', expected: false }
  ])('$path → $expected', ({ path, expected }) => {
    expect(isModelPagePath(path, roots, locales)).toBe(expected)
  })
})

describe('recording model pages', () => {
  it('lists live pages the published list is missing', () => {
    expect(unrecordedModelPages([flux], [localFlux, flux])).toEqual([localFlux])
  })

  it('adds new pages and keeps removed ones', () => {
    expect(recordModelPages([localFlux, flux], [hub])).toEqual([
      hub,
      flux,
      localFlux
    ])
  })
})
