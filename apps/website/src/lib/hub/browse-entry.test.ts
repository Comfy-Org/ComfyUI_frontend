import { describe, expect, it } from 'vitest'

import type { BrowseEntry, CatalogueOrder } from './browse-entry'
import { browseRequestFrom, sortBrowseEntries } from './browse-entry'

describe('browseRequestFrom', () => {
  it('opens on everything when the link asks for nothing', () => {
    expect(browseRequestFrom('')).toEqual({
      type: 'all',
      useCase: 'all',
      usesModel: '',
      query: ''
    })
  })

  it('reads the type, the use case and the search off the link', () => {
    expect(browseRequestFrom('?type=app&useCase=edit-images&q=poster')).toEqual(
      {
        type: 'app',
        useCase: 'edit-images',
        usesModel: '',
        query: 'poster'
      }
    )
  })

  it('ignores a type and a use case it does not have', () => {
    const asked = browseRequestFrom('?type=sculpture&useCase=knitting')
    expect(asked.type).toBe('all')
    expect(asked.useCase).toBe('all')
  })

  // "42 workflows use this" is a link, and what it means is the workflows, not
  // the model beside them.
  it('reads a model link as a request for the workflows that use it', () => {
    const asked = browseRequestFrom('?model=Nano%20Banana%20Pro')
    expect(asked.usesModel).toBe('Nano Banana Pro')
    expect(asked.type).toBe('workflow')
  })

  it('lets the model link win over a type the same link names', () => {
    expect(browseRequestFrom('?model=Flux&type=model').type).toBe('workflow')
  })
})

describe('sortBrowseEntries', () => {
  const entry = (overrides: Partial<BrowseEntry>): BrowseEntry => ({
    key: overrides.title ?? 'x',
    kind: 'workflow',
    title: 'x',
    useCases: [],
    outputs: [],
    provider: undefined,
    runsHere: false,
    needsCustomNodes: false,
    models: [],
    tags: [],
    standing: 0,
    date: undefined,
    credits: undefined,
    card: {} as BrowseEntry['card'],
    ...overrides
  })

  const order = (entries: readonly BrowseEntry[], by: CatalogueOrder) =>
    sortBrowseEntries(entries, by).map((entry) => entry.title)

  // A rank and an install count share no scale, so "popular" reads the
  // capabilities first and then what is built on them, each by its own measure.
  it('ranks models ahead of workflows and each by its own measure', () => {
    const entries = [
      entry({ title: 'Busy workflow', standing: 900 }),
      entry({ title: 'Second model', kind: 'model', standing: 2 }),
      entry({ title: 'Quiet workflow', standing: 4 }),
      entry({ title: 'First model', kind: 'model', standing: 1 })
    ]

    expect(order(entries, 'popular')).toEqual([
      'First model',
      'Second model',
      'Busy workflow',
      'Quiet workflow'
    ])
  })

  it('breaks a tie by title rather than by input order', () => {
    const entries = [
      entry({ title: 'Beta', standing: 5 }),
      entry({ title: 'Alpha', standing: 5 })
    ]

    expect(order(entries, 'popular')).toEqual(['Alpha', 'Beta'])
    expect(order(entries, 'name')).toEqual(['Alpha', 'Beta'])
  })

  it('reads newest by date and sends the undated to the back', () => {
    const entries = [
      entry({ title: 'Undated' }),
      entry({ title: 'Older', date: '2026-01-01' }),
      entry({ title: 'Newer', date: '2026-09-01' })
    ]

    expect(order(entries, 'newest')).toEqual(['Newer', 'Older', 'Undated'])
  })

  // Something with no price is neither the cheapest nor the dearest, so it
  // waits at the end of both readings rather than winning one of them.
  it('keeps the unpriced out of both ends of a price order', () => {
    const entries = [
      entry({ title: 'Free of charge' }),
      entry({ title: 'Dear', credits: 90 }),
      entry({ title: 'Cheap', credits: 10 })
    ]

    expect(order(entries, 'priceAsc')).toEqual([
      'Cheap',
      'Dear',
      'Free of charge'
    ])
    expect(order(entries, 'priceDesc')).toEqual([
      'Dear',
      'Cheap',
      'Free of charge'
    ])
  })

  it('leaves the list it was given alone', () => {
    const entries = [entry({ title: 'B' }), entry({ title: 'A' })]
    sortBrowseEntries(entries, 'name')

    expect(entries.map((entry) => entry.title)).toEqual(['B', 'A'])
  })
})
