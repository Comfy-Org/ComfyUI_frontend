import { describe, expect, it } from 'vitest'

import { splitTextAtWordBoundary } from '@/utils/textTickerUtils'

describe('splitTextAtWordBoundary', () => {
  it('returns full text when ratio >= 1 (fits in one line)', () => {
    expect(splitTextAtWordBoundary('Load Checkpoint', 1)).toEqual([
      'Load Checkpoint',
      ''
    ])
    expect(splitTextAtWordBoundary('Load Checkpoint', 1.5)).toEqual([
      'Load Checkpoint',
      ''
    ])
  })

  it('splits at last word boundary before estimated break', () => {
    // "Load Checkpoint Loader" = 22 chars, ratio 0.5 → estimate at char 11
    // lastIndexOf(' ', 11) → 15? No: "Load Checkpoint Loader"
    //                                  0123456789...
    // ' ' at index 4 and 15
    // lastIndexOf(' ', 11) → 4
    expect(splitTextAtWordBoundary('Load Checkpoint Loader', 0.5)).toEqual([
      'Load',
      'Checkpoint Loader'
    ])
  })

  it('splits longer text proportionally', () => {
    expect(splitTextAtWordBoundary('Load Checkpoint Loader', 0.7)).toEqual([
      'Load Checkpoint',
      'Loader'
    ])
  })

  it('returns full text when no word boundary found', () => {
    expect(splitTextAtWordBoundary('Superlongwordwithoutspaces', 0.5)).toEqual([
      'Superlongwordwithoutspaces',
      ''
    ])
  })

  it('handles single word text', () => {
    expect(splitTextAtWordBoundary('Checkpoint', 0.5)).toEqual([
      'Checkpoint',
      ''
    ])
  })

  it('falls back to first space when estimate is before any whitespace', () => {
    // ratio 0.1 → estimate at char 2; no space at/before index 2.
    // Falls back to text.indexOf(' ') = 4 → split after "Load".
    expect(splitTextAtWordBoundary('Load Checkpoint Loader', 0.1)).toEqual([
      'Load',
      'Checkpoint Loader'
    ])
  })
})
