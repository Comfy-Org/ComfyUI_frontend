import { describe, expect, it } from 'vitest'

import {
  catalogCardFixtures,
  dayZeroModelFixtures,
  measuredTrendingModelFixtures
} from './modelExploreFixtures'
import { modelVersionReleases } from './modelVersionReleases'
import { trendModelVersions } from './modelTrends'

describe('measured trending collection', () => {
  it('lists unique individual versions with owned destinations', () => {
    const hrefs = measuredTrendingModelFixtures.map((model) => model.href)
    expect(measuredTrendingModelFixtures).toHaveLength(8)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(
      hrefs.filter(
        (href) =>
          !href.startsWith('/hub/models/') &&
          !href.startsWith('/p/supported-models/')
      )
    ).toEqual([])
    expect(
      measuredTrendingModelFixtures.filter(
        (model) => model.description.length === 0
      )
    ).toEqual([])
  })

  it('contains only tracked versions, never support-dated or popularity-ordered cards', () => {
    const trackedHrefs = new Set<string>(
      trendModelVersions.map((model) => model.href)
    )
    expect(
      measuredTrendingModelFixtures.filter(
        (model) => !trackedHrefs.has(model.href)
      )
    ).toEqual([])
  })
})

describe('latest collection', () => {
  it('contains only publisher-dated releases ordered newest first', () => {
    expect(dayZeroModelFixtures).toHaveLength(
      new Set(modelVersionReleases.map(({ versionId }) => versionId)).size
    )
    expect(
      dayZeroModelFixtures.filter(
        (model) => !model.releasedAt || !model.sourceUrl || model.supportedAt
      )
    ).toEqual([])
    const dates = dayZeroModelFixtures.map((model) => model.releasedAt ?? '')
    expect(dates).toEqual(dates.toSorted((a, b) => b.localeCompare(a)))
  })
})

describe('catalog card fixtures', () => {
  it('are kept apart from Trending and Latest', () => {
    const featuredHrefs = new Set(
      [...measuredTrendingModelFixtures, ...dayZeroModelFixtures].map(
        (model) => model.href
      )
    )
    const dated = catalogCardFixtures.filter((model) => model.supportedAt)
    expect(dated.length).toBeGreaterThan(0)
    expect(dated.filter((model) => featuredHrefs.has(model.href))).toEqual([])
  })
})

it('provides a provider mark for every featured and catalog card', () => {
  expect(
    [
      ...measuredTrendingModelFixtures,
      ...dayZeroModelFixtures,
      ...catalogCardFixtures
    ].filter((model) => !model.provider)
  ).toEqual([])
})
