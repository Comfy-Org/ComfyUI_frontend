import type { CompanionFrame } from './companionArt'

/**
 * The small movement that goes with a reaction, and lasts as long as it does.
 * Each has its keyframes in `Companion.vue`.
 */
export type ReactionMotion = 'hop' | 'lean' | 'wiggle' | 'tilt'

export interface CompanionReaction {
  id: string
  /** Her frames in turn, each for its own time; after the last she is back at rest. */
  beats: readonly { frame: CompanionFrame; ms: number }[]
  motion: ReactionMotion
}

/**
 * What she may do when the pointer comes onto her at the dock: a few
 * expression frames and a small movement, about a second in all. Only
 * expression frames: a pointing arm would say something. To add one, add it
 * here, and its keyframes in `Companion.vue` if its motion is new.
 */
export const REACTIONS: readonly CompanionReaction[] = [
  {
    id: 'delighted',
    motion: 'hop',
    beats: [{ frame: 'happy', ms: 1000 }]
  },
  {
    id: 'oh',
    motion: 'lean',
    beats: [{ frame: 'talk-open', ms: 900 }]
  },
  {
    id: 'giggle',
    motion: 'wiggle',
    beats: [
      { frame: 'talk-wide', ms: 150 },
      { frame: 'talk-open', ms: 120 },
      { frame: 'talk-wide', ms: 150 },
      { frame: 'talk-open', ms: 120 },
      { frame: 'talk-wide', ms: 150 },
      { frame: 'talk-open', ms: 120 },
      { frame: 'talk-wide', ms: 150 },
      { frame: 'talk-open', ms: 120 }
    ]
  },
  {
    id: 'curious',
    motion: 'tilt',
    beats: [{ frame: 'thinking', ms: 1300 }]
  }
]

/** How long after a reaction she waits before the next one, so waggling the mouse does not spam. */
export const REACTION_COOLDOWN_MS = 1000

/**
 * The reaction a roll picks: a number from 0 up to, not including, 1, such as
 * `Math.random()` gives. It is one of the reactions other than `last`, so she
 * never does the same one twice in a row.
 */
export function pickReaction(facts: {
  roll: number
  last: string | null
}): CompanionReaction {
  const choices = REACTIONS.filter((reaction) => reaction.id !== facts.last)
  const index = Math.floor(facts.roll * choices.length)
  return choices[Math.min(Math.max(index, 0), choices.length - 1)]
}

export function reactionDuration(reaction: CompanionReaction): number {
  return reaction.beats.reduce((total, beat) => total + beat.ms, 0)
}

/**
 * The frame a reaction is on `elapsedMs` after it began. With reduced motion
 * it is the first frame, held, and no other.
 */
export function reactionFrame(facts: {
  reaction: CompanionReaction
  elapsedMs: number
  reducedMotion: boolean
}): CompanionFrame {
  const { reaction, elapsedMs, reducedMotion } = facts
  if (reducedMotion) return reaction.beats[0].frame
  let beatEnd = 0
  for (const beat of reaction.beats) {
    beatEnd += beat.ms
    if (elapsedMs < beatEnd) return beat.frame
  }
  return reaction.beats[reaction.beats.length - 1].frame
}
