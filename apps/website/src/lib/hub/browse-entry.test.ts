import { describe, expect, it } from 'vitest'

import type { BrowseEntry, CatalogueOrder } from './browse-entry'
import { browseRequestFrom, sortBrowseEntries } from './browse-entry'

describe('browseRequestFrom', () => {
  // There is no tab holding both, so a link that names none opens on the one
  // the catalogue leads with: the capabilities everything else is built on.
  it('opens on the models when the link asks for nothing', () => {
    expect(browseRequestFrom('')).toEqual({
      type: 'model',
      shelf: 'all',
      usesModel: '',
      query: '',
      all: false
    })
  })

  it('reads the tab, the shelf and the search off the link', () => {
    expect(
      browseRequestFrom('?type=model&useCase=edit-images&q=poster')
    ).toEqual({
      type: 'model',
      shelf: 'edit-images',
      usesModel: '',
      query: 'poster',
      all: false
    })
  })

  // An app browses as a workflow, so it is not a tab a link can ask for.
  it.for(['sculpture', 'app', 'all'])('reads %s as no tab at all', (asked) => {
    expect(browseRequestFrom(`?type=${asked}`).type).toBe('model')
  })

  // A saved address for the whole half opens on it rather than on the shelves.
  it('reads a link that asked past the shelves', () => {
    expect(browseRequestFrom('?type=workflow&all=1').all).toBe(true)
  })

  // The two halves shelve by different axes, so the link is read without
  // judging the key: the page that knows its tab decides whether it names one.
  it('carries the shelf key through unjudged', () => {
    expect(browseRequestFrom('?useCase=characters').shelf).toBe('characters')
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
    shelves: [],
    models: [],
    tags: [],
    standing: 0,
    date: undefined,
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

  it('leaves the list it was given alone', () => {
    const entries = [entry({ title: 'B' }), entry({ title: 'A' })]
    sortBrowseEntries(entries, 'name')

    expect(entries.map((entry) => entry.title)).toEqual(['B', 'A'])
  })
})
