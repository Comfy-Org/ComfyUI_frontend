import { describe, expect, it } from 'vitest'

import type { TrimTimeline } from './track'
import {
  clock,
  dragOffset,
  loopedTime,
  moveGrip,
  nudgedTime,
  playFrom,
  timeAtPointer
} from './track'

const timeline: TrimTimeline = {
  range: { start: 10, end: 20 },
  playhead: 12,
  duration: 60,
  limits: { min: 5, max: 15 }
}

describe('timeAtPointer', () => {
  // a 632px track with 16px handles leaves 600px for 60 seconds
  const box = { left: 100, width: 632 }

  it.for<[number, number]>([
    [116, 0],
    [416, 30],
    [716, 60],
    [50, 0],
    [9000, 60]
  ])('reads a pointer at %ipx as %f s', ([clientX, seconds]) => {
    expect(timeAtPointer(clientX, box, 16, 60)).toBe(seconds)
  })

  it('reads zero from a track that is not laid out', () => {
    expect(timeAtPointer(300, undefined, 16, 60)).toBe(0)
    expect(timeAtPointer(300, { left: 0, width: 20 }, 16, 60)).toBe(0)
  })
})

describe('moveGrip', () => {
  it('moves the start and shows the new start', () => {
    expect(moveGrip('start', timeline, 12)).toEqual({
      range: { start: 12, end: 20 },
      seek: 12
    })
  })

  it('moves the end and shows the new end', () => {
    expect(moveGrip('end', timeline, 18)).toEqual({
      range: { start: 10, end: 18 },
      seek: 18
    })
  })

  it('holds a handle at the shortest part allowed', () => {
    expect(moveGrip('start', timeline, 19).range).toEqual({
      start: 15,
      end: 20
    })
  })

  it('slides the whole part and shows where it now starts', () => {
    expect(moveGrip('slide', timeline, 40)).toEqual({
      range: { start: 40, end: 50 },
      seek: 40
    })
  })

  it('scrubs the playhead inside the part, leaving the part alone', () => {
    expect(moveGrip('scrub', timeline, 14)).toEqual({ playhead: 14, seek: 14 })
    expect(moveGrip('scrub', timeline, 55)).toEqual({ playhead: 20, seek: 20 })
    expect(moveGrip('scrub', timeline, 1)).toEqual({ playhead: 10, seek: 10 })
  })
})

describe('dragOffset', () => {
  it('keeps the grabbed point under the pointer only when sliding', () => {
    expect(dragOffset('slide', 14, timeline.range)).toBe(4)
    expect(dragOffset('start', 14, timeline.range)).toBe(0)
    expect(dragOffset('scrub', 14, timeline.range)).toBe(0)
  })
})

describe('nudgedTime', () => {
  it.for<['start' | 'end' | 'scrub', string, boolean, number]>([
    ['start', 'ArrowRight', false, 10.1],
    ['start', 'ArrowLeft', false, 9.9],
    ['end', 'ArrowUp', true, 21],
    ['end', 'ArrowDown', true, 19],
    ['scrub', 'ArrowRight', false, 12.1]
  ])('sends %s on %s (large: %s) to %f', ([grip, key, large, to]) => {
    expect(nudgedTime(grip, timeline, key, large)).toBeCloseTo(to)
  })

  it('ignores every other key', () => {
    expect(nudgedTime('start', timeline, 'Enter', false)).toBeUndefined()
    expect(nudgedTime('scrub', timeline, 'a', true)).toBeUndefined()
  })
})

describe('loopedTime', () => {
  const range = { start: 10, end: 20 }

  it('follows the video while it is inside the part', () => {
    expect(loopedTime(14, false, range)).toEqual({
      seekTo: undefined,
      playhead: 14
    })
  })

  it('goes back to the start once the part, or the video, ends', () => {
    expect(loopedTime(20, false, range)).toEqual({ seekTo: 10, playhead: 10 })
    expect(loopedTime(12, true, range)).toEqual({ seekTo: 10, playhead: 10 })
  })

  it('keeps the playhead inside the part if the video is a touch early', () => {
    expect(loopedTime(9.98, false, range).playhead).toBe(10)
  })
})

describe('playFrom', () => {
  it('restarts a preview that sits at the end, and resumes one that does not', () => {
    expect(playFrom(19.97, { start: 10, end: 20 })).toBe(10)
    expect(playFrom(14, { start: 10, end: 20 })).toBeUndefined()
  })
})

describe('clock', () => {
  it.for<[number, string]>([
    [0, '0:00.0'],
    [5.74, '0:05.7'],
    [75.25, '1:15.3'],
    [-3, '0:00.0']
  ])('reads %f seconds as %s', ([seconds, text]) => {
    expect(clock(seconds)).toBe(text)
  })
})
