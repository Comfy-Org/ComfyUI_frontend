import { describe, expect, it } from 'vitest'

import {
  isViewableResultItem,
  toViewRequest,
  viewableResultItems
} from '@/utils/resultItemUtil'

describe(isViewableResultItem, () => {
  it.for([
    { item: null, viewable: false },
    {
      item: { status: 'unavailable', reason: 'upload_failed' },
      viewable: false
    },
    { item: { filename: '' }, viewable: false },
    { item: { filename: 'a.wav', type: 'bogus' }, viewable: false },
    { item: { filename: 'a.wav', subfolder: 42 }, viewable: false },
    { item: { filename: 'a.wav' }, viewable: true },
    {
      item: { filename: 'a.wav', subfolder: 'sub', type: 'temp' },
      viewable: true
    }
  ])('$item → $viewable', ({ item, viewable }) => {
    expect(isViewableResultItem(item)).toBe(viewable)
  })
})

describe(toViewRequest, () => {
  it('defaults an absent subfolder and type the way /view does', () => {
    expect(toViewRequest({ filename: 'a.png' })).toEqual({
      filename: 'a.png',
      subfolder: '',
      type: 'output'
    })
  })
})

describe(viewableResultItems, () => {
  it('returns no items for a non-array payload', () => {
    expect(viewableResultItems(Object('a.png'))).toEqual([])
  })
})
