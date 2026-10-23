import type { TrimLimits, TrimRange } from './range'
import { trimEndTo, trimSlideTo, trimStartTo } from './range'

/** What on the timeline is being moved. */
export type TrimGrip = 'start' | 'end' | 'slide' | 'scrub'

/** The timeline as a move needs it: where things are, and what is allowed. */
export interface TrimTimeline {
  readonly range: TrimRange
  readonly playhead: number
  readonly duration: number
  readonly limits: TrimLimits
}

/** What a move leaves behind: a new range or playhead, and the moment to show. */
export interface TrimMove {
  readonly range?: TrimRange
  readonly playhead?: number
  readonly seek: number
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))

/**
 * The time under a pointer. The track keeps a handle's width clear at each
 * end, so the timeline itself is the box less both handles.
 */
export function timeAtPointer(
  clientX: number,
  box: { readonly left: number; readonly width: number } | undefined,
  handlePx: number,
  duration: number
): number {
  const width = (box?.width ?? 0) - handlePx * 2
  if (!box || width <= 0) return 0
  return clamp((clientX - box.left - handlePx) / width, 0, 1) * duration
}

/** A slide keeps the point that was grabbed under the pointer; other grips follow it exactly. */
export const dragOffset = (grip: TrimGrip, at: number, range: TrimRange) =>
  grip === 'slide' ? at - range.start : 0

const MOVES: Readonly<
  Record<TrimGrip, (timeline: TrimTimeline, time: number) => TrimMove>
> = {
  start({ range, duration, limits }, time) {
    const next = trimStartTo(range, time, duration, limits)
    return { range: next, seek: next.start }
  },
  end({ range, duration, limits }, time) {
    const next = trimEndTo(range, time, duration, limits)
    return { range: next, seek: next.end }
  },
  slide({ range, duration }, time) {
    const next = trimSlideTo(range, time, duration)
    return { range: next, seek: next.start }
  },
  scrub({ range }, time) {
    const at = clamp(time, range.start, range.end)
    return { playhead: at, seek: at }
  }
}

/** Moves a grip to `time`, within the rules for that grip. */
export const moveGrip = (
  grip: TrimGrip,
  timeline: TrimTimeline,
  time: number
): TrimMove => MOVES[grip](timeline, time)

const KEY_STEP = 0.1
const KEY_STEP_LARGE = 1
const DIRECTIONS: Readonly<Partial<Record<string, number>>> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1
}

const POSITIONS: Readonly<
  Record<Exclude<TrimGrip, 'slide'>, (timeline: TrimTimeline) => number>
> = {
  start: ({ range }) => range.start,
  end: ({ range }) => range.end,
  scrub: ({ playhead }) => playhead
}

/**
 * Where an arrow key sends a grip: a tenth of a second, or a whole second
 * with Shift. Undefined for any other key.
 */
export function nudgedTime(
  grip: Exclude<TrimGrip, 'slide'>,
  timeline: TrimTimeline,
  key: string,
  large: boolean
): number | undefined {
  const direction = DIRECTIONS[key]
  if (direction === undefined) return undefined
  const step = large ? KEY_STEP_LARGE : KEY_STEP
  return POSITIONS[grip](timeline) + direction * step
}

/** Where a looping preview should be: back at the start once it leaves the range. */
export function loopedTime(
  current: number,
  ended: boolean,
  range: TrimRange
): { readonly seekTo: number | undefined; readonly playhead: number } {
  const left = ended || current >= range.end
  return {
    seekTo: left ? range.start : undefined,
    playhead: left ? range.start : clamp(current, range.start, range.end)
  }
}

/** Where Play starts from: the playhead, or the start if it sits at the end. */
export const playFrom = (playhead: number, range: TrimRange) =>
  playhead >= range.end - 0.05 ? range.start : undefined

/** A time as the dialog reads it out: minutes, seconds and tenths. */
export function clock(seconds: number): string {
  const whole = Math.max(0, seconds)
  const minutes = Math.floor(whole / 60)
  return `${minutes}:${(whole - minutes * 60).toFixed(1).padStart(4, '0')}`
}
