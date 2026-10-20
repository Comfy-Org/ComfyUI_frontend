import { describe, expect, it } from 'vitest'

import type { StageView, SwapTake } from './take'
import {
  loopSeek,
  loopWindow,
  stagePanel,
  stageSource,
  stoppedNote,
  takeOverlay
} from './take'

const take = (patch: Partial<SwapTake> = {}): SwapTake => ({
  id: 'take-1',
  n: 1,
  target: 'the man',
  window: { start: 2, seconds: 6 },
  seconds: 6,
  size: '768p',
  seed: 7,
  status: 'done',
  url: 'blob:result',
  ...patch
})

const editing: StageView = {
  current: undefined,
  compare: 'result',
  videoUrl: 'blob:clip',
  range: { start: 1, seconds: 15 },
  partSeconds: 14.375
}

describe('stageSource', () => {
  it('plays the clip while setting up', () => {
    expect(stageSource(editing)).toBe('blob:clip')
  })

  it("plays a finished take's result, or its clip when flipped back", () => {
    const viewing = { ...editing, current: take() }
    expect(stageSource(viewing)).toBe('blob:result')
    expect(stageSource({ ...viewing, compare: 'source' })).toBe('blob:clip')
  })

  it('plays the clip under a take that has no result yet', () => {
    const rendering = take({ status: 'rendering', url: undefined })
    expect(stageSource({ ...editing, current: rendering })).toBe('blob:clip')
  })
})

describe('loopWindow', () => {
  it('loops the part a run will really use while setting up', () => {
    expect(loopWindow(editing)).toEqual({ start: 1, seconds: 14.375 })
  })

  it('has nothing to loop before a clip is trimmed', () => {
    expect(
      loopWindow({ ...editing, range: undefined, partSeconds: undefined })
    ).toBeUndefined()
  })

  it("plays a result whole, and loops a take's own part of the source", () => {
    const viewing = { ...editing, current: take() }
    expect(loopWindow(viewing)).toBeUndefined()
    expect(loopWindow({ ...viewing, compare: 'source' })).toEqual({
      start: 2,
      seconds: 6
    })
  })
})

describe('loopSeek', () => {
  const bounds = { start: 2, seconds: 6 }

  it.for<[number, number | undefined]>([
    [0, 2],
    [1.96, undefined],
    [5, undefined],
    [8, 2],
    [30, 2]
  ])('sends a player at %f s to %s', ([time, to]) => {
    expect(loopSeek(time, bounds)).toBe(to)
  })

  it('leaves a player with no part alone', () => {
    expect(loopSeek(99, undefined)).toBeUndefined()
  })
})

describe('takeOverlay', () => {
  it.for<[SwapTake['status'] | undefined, string | undefined]>([
    [undefined, undefined],
    ['rendering', 'progress'],
    ['failed', 'stopped'],
    ['cancelled', 'stopped'],
    ['done', undefined]
  ])('covers the player for a %s take with %s', ([status, overlay]) => {
    expect(takeOverlay(status && take({ status }))).toBe(overlay)
  })
})

describe('stagePanel', () => {
  const view = { ...editing, clipSeconds: 20 }

  it('shows the part to swap while setting up a trimmed clip', () => {
    expect(stagePanel(view)).toBe('part')
    expect(stagePanel({ ...view, clipSeconds: undefined })).toBeUndefined()
  })

  it('shows the result bar only for a take that has a result', () => {
    expect(stagePanel({ ...view, current: take() })).toBe('result')
    expect(
      stagePanel({
        ...view,
        current: take({ status: 'failed', url: undefined })
      })
    ).toBeUndefined()
  })
})

describe('stoppedNote', () => {
  const stock = { cancelled: 'Cancelled', failed: 'Something went wrong' }

  it("gives a failed take's own reason, and a stock line without one", () => {
    expect(stoppedNote({ status: 'failed', note: 'No credits' }, stock)).toBe(
      'No credits'
    )
    expect(stoppedNote({ status: 'failed' }, stock)).toBe(
      'Something went wrong'
    )
  })

  it('says a cancelled take was cancelled, whatever note it carries', () => {
    expect(stoppedNote({ status: 'cancelled', note: 'ignored' }, stock)).toBe(
      'Cancelled'
    )
  })
})
