import { describe, expect, it, vi } from 'vitest'

import { loadSplitterSizes, saveSplitterSizes } from './splitterPersistence'

describe('splitter persistence', () => {
  it('round-trips persisted panel sizes', () => {
    saveSplitterSizes('linear-view-splitter', [25, 75])

    expect(loadSplitterSizes('linear-view-splitter', 2)).toEqual([25, 75])
  })

  it('continues when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)

    expect(() =>
      saveSplitterSizes('linear-view-splitter', [25, 75])
    ).not.toThrow()
    expect(loadSplitterSizes('linear-view-splitter', 2)).toBeUndefined()
  })

  it.for([
    { name: 'malformed JSON', stored: '[' },
    { name: 'wrong panel count', stored: '[25,50,25]' },
    { name: 'non-number entry', stored: '[25,"75"]' },
    { name: 'negative entry', stored: '[-10,110]' },
    { name: 'non-positive total', stored: '[0,0]' }
  ])('rejects $name', ({ stored }) => {
    localStorage.setItem('splitter', stored)

    expect(loadSplitterSizes('splitter', 2)).toBeUndefined()
  })
})
