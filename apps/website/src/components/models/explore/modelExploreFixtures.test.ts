import { describe, expect, it } from 'vitest'

import {
  dayZeroModelFixtures,
  trendingModelFixtures
} from './modelExploreFixtures'

describe('expanded trending collection', () => {
  it('includes more than one preview of image models with unique owned destinations', () => {
    const images = trendingModelFixtures.filter(
      (model) => model.modality === 'image'
    )
    expect(images.length).toBeGreaterThan(8)
    const hrefs = trendingModelFixtures.map((model) => model.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(
      hrefs.every(
        (href) =>
          href.startsWith('/hub/models/') ||
          href.startsWith('/p/supported-models/')
      )
    ).toBe(true)
    expect(
      trendingModelFixtures.every((model) => model.description.length > 0)
    ).toBe(true)
  })
})

it('includes open-weight audio in both collections and orders Latest by date', () => {
  expect(
    trendingModelFixtures.filter((model) => model.modality === 'audio').length
  ).toBeGreaterThan(8)
  expect(
    dayZeroModelFixtures.filter((model) => model.modality === 'audio').length
  ).toBeGreaterThan(4)
  const dates = dayZeroModelFixtures.map(
    (model) => model.releasedAt ?? model.supportedAt ?? ''
  )
  expect(dates).toEqual([...dates].sort().reverse())
})

it.for([
  'image',
  'video',
  'audio',
  '3d',
  'llm',
  'edit',
  'upscale',
  'open',
  'partner'
])('has enough eligible models for the %s previews', (filter) => {
  const matches = (model: (typeof trendingModelFixtures)[number]) => {
    if (filter === 'open') return model.statuses?.includes('open-weights')
    if (filter === 'partner') return !model.statuses?.includes('open-weights')
    if (filter === 'edit' || filter === 'upscale')
      return model.capabilities?.some((capability) =>
        capability.includes(filter)
      )
    return model.modality === filter
  }
  expect(trendingModelFixtures.filter(matches).length).toBeGreaterThanOrEqual(8)
  expect(dayZeroModelFixtures.filter(matches).length).toBeGreaterThanOrEqual(4)
})

it('provides a provider mark for every model in both collections', () => {
  for (const model of [...trendingModelFixtures, ...dayZeroModelFixtures]) {
    expect(model.provider).toBeTruthy()
  }
})
