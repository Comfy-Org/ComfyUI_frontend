/** The part of a video that is kept, in seconds from its start. */
export interface TrimRange {
  readonly start: number
  readonly end: number
}

/** The shortest and longest part an app will take, in seconds. */
export interface TrimLimits {
  readonly min: number
  readonly max: number
}

/** A container rounds its length: a "5 second" file often reads 4.97. */
const LENGTH_TOLERANCE = 0.05

export const trimLength = (range: TrimRange) => range.end - range.start

/** Whether a video of this length has no part long enough to keep. */
export function tooShortToTrim(duration: number, limits: TrimLimits): boolean {
  return duration < limits.min - LENGTH_TOLERANCE
}

/** The limits as this video can meet them: never longer than the video. */
function boundsFor(duration: number, limits: TrimLimits): TrimLimits {
  const max = Math.min(limits.max, duration)
  return { min: Math.min(limits.min, max), max }
}

/**
 * The range a video opens with: `preferred` if it still fits, otherwise as
 * much as the limits allow from the start.
 */
export function initialTrim(
  duration: number,
  limits: TrimLimits,
  preferred?: TrimRange
): TrimRange {
  const bounds = boundsFor(duration, limits)
  if (preferred) {
    const length = trimLength(preferred)
    if (
      preferred.start >= 0 &&
      preferred.end <= duration + LENGTH_TOLERANCE &&
      length >= bounds.min - LENGTH_TOLERANCE &&
      length <= bounds.max + LENGTH_TOLERANCE
    )
      return { start: preferred.start, end: Math.min(preferred.end, duration) }
  }
  return { start: 0, end: bounds.max }
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))

/**
 * Drags the start handle to `time`. It stops a minimum length short of the
 * end; pulled past the maximum, it brings the end along with it.
 */
export function trimStartTo(
  range: TrimRange,
  time: number,
  duration: number,
  limits: TrimLimits
): TrimRange {
  const bounds = boundsFor(duration, limits)
  const start = clamp(time, 0, range.end - bounds.min)
  return { start, end: Math.min(range.end, start + bounds.max) }
}

/** Drags the end handle to `time`, by the same rules as `trimStartTo`. */
export function trimEndTo(
  range: TrimRange,
  time: number,
  duration: number,
  limits: TrimLimits
): TrimRange {
  const bounds = boundsFor(duration, limits)
  const end = clamp(time, range.start + bounds.min, duration)
  return { start: Math.max(range.start, end - bounds.max), end }
}

/** Slides the whole range so it starts at `time`, keeping its length. */
export function trimSlideTo(
  range: TrimRange,
  time: number,
  duration: number
): TrimRange {
  const length = trimLength(range)
  const start = clamp(time, 0, Math.max(0, duration - length))
  return { start, end: start + length }
}
