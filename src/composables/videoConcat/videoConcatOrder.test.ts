import { describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'

import {
  arrangeClips,
  dropIndex,
  moveItem,
  translateOrder
} from './videoConcatOrder'
import type { ConcatClipSlot } from './videoConcatOrder'

function slots(...entries: [string, number][]): ConcatClipSlot[] {
  return entries.map(([name, linkId]) => ({ name, linkId: toLinkId(linkId) }))
}

describe('arrangeClips', () => {
  const clips = slots(['video0', 1], ['video1', 2], ['video2', 3])

  it.for([
    { order: [], expected: ['video0', 'video1', 'video2'] },
    { order: ['video2', 'video0'], expected: ['video2', 'video0', 'video1'] },
    { order: ['gone', 'video1'], expected: ['video1', 'video0', 'video2'] },
    { order: ['video1', 'video1'], expected: ['video1', 'video0', 'video2'] }
  ])('arranges $order as $expected', ({ order, expected }) => {
    expect(arrangeClips(order, clips).map((clip) => clip.name)).toEqual(
      expected
    )
  })
})

describe('translateOrder', () => {
  it('follows links to the slots autogrow compacted them into', () => {
    const previous = slots(['video0', 1], ['video1', 2], ['video2', 3])
    const current = slots(['video0', 2], ['video1', 3])

    expect(
      translateOrder(['video2', 'video0', 'video1'], previous, current)
    ).toEqual(['video1', 'video0'])
  })

  it('keeps names it has no previous link for', () => {
    expect(
      translateOrder(['video1', 'video0'], [], slots(['video0', 5]))
    ).toEqual(['video1', 'video0'])
  })

  it('drops a name whose slot was given a different link', () => {
    expect(
      translateOrder(
        ['video1', 'video0'],
        slots(['video0', 1], ['video1', 2]),
        slots(['video0', 1], ['video1', 9])
      )
    ).toEqual(['video0'])
  })
})

describe('dropIndex', () => {
  const centers = [50, 150, 250, 350]

  it.for([
    { pointerX: 10, dragged: 2, expected: 0 },
    { pointerX: 160, dragged: 0, expected: 1 },
    { pointerX: 300, dragged: 0, expected: 2 },
    { pointerX: 400, dragged: 1, expected: 3 },
    { pointerX: 260, dragged: 2, expected: 2 }
  ])(
    'drops tile $dragged at $expected when the pointer is at $pointerX',
    ({ pointerX, dragged, expected }) => {
      expect(dropIndex(pointerX, centers, dragged)).toBe(expected)
    }
  )
})

describe('moveItem', () => {
  it('moves an item without mutating the input', () => {
    const items = ['a', 'b', 'c']

    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a'])
    expect(items).toEqual(['a', 'b', 'c'])
  })
})
