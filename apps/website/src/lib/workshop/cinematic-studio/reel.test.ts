import { describe, expect, it } from 'vitest'

import type { RunOutput } from '../../../config/workshop-run'
import type { Reel, ReelEvent } from './reel'
import {
  EMPTY_REEL,
  isRendering,
  reduceReel,
  selectedTake,
  takesOfShot
} from './reel'

const output: RunOutput = {
  kind: 'image',
  url: 'blob:take',
  fileName: 'take.png'
}

const started = (ids: string[]): ReelEvent => ({
  type: 'shotStarted',
  ids,
  prompt: 'Wide shot.',
  modelSlug: 'bfl--flux-2-pro--generate-images',
  aspect: '21:9'
})

const play = (events: readonly ReelEvent[], reel: Reel = EMPTY_REEL) =>
  events.reduce(reduceReel, reel)

describe('reduceReel', () => {
  it('starts every take of a shot rendering, lettered and selected from A', () => {
    const reel = play([started(['a', 'b'])])
    expect(
      reel.takes.map((take) => [take.shot, take.letter, take.status])
    ).toEqual([
      [1, 'A', 'rendering'],
      [1, 'B', 'rendering']
    ])
    expect(selectedTake(reel)?.id).toBe('a')
    expect(isRendering(reel)).toBe(true)
  })

  it('numbers the next shot after the last one', () => {
    const reel = play([started(['a']), started(['b', 'c'])])
    expect(takesOfShot(reel, 2).map((take) => take.letter)).toEqual(['A', 'B'])
  })

  it('settles each take on its own', () => {
    const reel = play([
      started(['a', 'b']),
      { type: 'takeSucceeded', id: 'a', output },
      { type: 'takeFailed', id: 'b', reason: 'provider' }
    ])
    expect(reel.takes.map((take) => take.status)).toEqual(['done', 'failed'])
    expect(isRendering(reel)).toBe(false)
  })

  it('ignores a result for a take that already settled', () => {
    const reel = play([
      started(['a']),
      { type: 'rendersCancelled' },
      { type: 'takeSucceeded', id: 'a', output }
    ])
    expect(reel.takes[0].status).toBe('cancelled')
  })

  it.for([
    ['an unknown take', 'zzz', 'a'],
    ['a known take', 'b', 'b']
  ] as const)('selecting %s', ([, id, expected]) => {
    const reel = play([started(['a', 'b']), { type: 'selected', id }])
    expect(selectedTake(reel)?.id).toBe(expected)
  })
})
