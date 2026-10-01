/** A repeatable stream of numbers in [0, 1) for one seed (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** A stable number for a piece of text, to seed what it describes. */
export function hashText(text: string): number {
  let hash = 2_166_136_261
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

export interface Snapper {
  /** Centre of the camera, as fractions of the frame. */
  readonly x: number
  readonly y: number
  readonly scale: number
  readonly flashing: boolean
}

/**
 * The photographers along the bottom of the frame for one seed: spread
 * across the width, a few of them firing their flash.
 */
export function snappers(seed: number, count = 7): readonly Snapper[] {
  const random = seededRandom(seed)
  return Array.from({ length: count }, (_, index) => ({
    x: (index + 0.25 + random() * 0.5) / count,
    y: 0.86 + random() * 0.08,
    scale: 0.8 + random() * 0.45,
    flashing: random() < 0.45
  }))
}

/** A press photo's corner date, made from the seed so a run repeats. */
export function dateStamp(seed: number): string {
  const month = String((seed % 12) + 1).padStart(2, '0')
  const day = String((Math.floor(seed / 12) % 28) + 1).padStart(2, '0')
  return `'26 ${month} ${day}`
}
