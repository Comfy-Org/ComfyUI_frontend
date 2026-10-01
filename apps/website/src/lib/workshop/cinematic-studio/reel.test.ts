import { describe, expect, it } from 'vitest'

import type { RunFailure, RunOutput } from '../../../config/workshop-run'
import type { Reel, ReelEvent } from './reel'
import {
  EMPTY_REEL,
  isRendering,
  reduceReel,
  selectedTake,
  takeKind,
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
  aspect: '21:9',
  startedAt: 0
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

  it.for([
    ['a failed take', { type: 'takeFailed', id: 'b', reason: 'network' }],
    ['a cancelled take', { type: 'rendersCancelled' }]
  ] as const)(
    'renders %s again on its own, leaving its finished sibling done',
    ([, settled]) => {
      const reel = play([
        started(['a', 'b']),
        { type: 'takeSucceeded', id: 'a', output },
        settled,
        { type: 'takeRetried', id: 'b', startedAt: 9 }
      ])
      expect(
        reel.takes.map((take) => [take.letter, take.status, take.startedAt])
      ).toEqual([
        ['A', 'done', 0],
        ['B', 'rendering', 9]
      ])
      expect(selectedTake(reel)?.id).toBe('b')
    }
  )

  it('ignores a retry for a take that finished', () => {
    const reel = play([
      started(['a']),
      { type: 'takeSucceeded', id: 'a', output },
      { type: 'takeRetried', id: 'a', startedAt: 9 }
    ])
    expect(reel.takes[0].status).toBe('done')
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

describe('takeKind', () => {
  const failed = (reason: RunFailure) =>
    play([started(['a']), { type: 'takeFailed', id: 'a', reason }]).takes[0]
  const [rendering] = play([started(['a'])]).takes
  const [done] = play([
    started(['a']),
    { type: 'takeSucceeded', id: 'a', output }
  ]).takes
  const [cancelled] = play([started(['a']), { type: 'rendersCancelled' }]).takes

  it.for([
    ['rendering', rendering],
    ['done', done],
    ['cancelled', cancelled],
    ['unpaid', failed('noCredits')],
    ['blocked', failed('policy')],
    ['blocked', failed('validation')],
    ['failed', failed('provider')]
  ] as const)('reads as %s', ([kind, take]) => {
    expect(takeKind(take)).toBe(kind)
  })
})
