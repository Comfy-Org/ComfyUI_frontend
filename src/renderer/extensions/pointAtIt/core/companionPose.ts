import type { CompanionFrame } from './companionArt'
import type { Pointing } from './geometry'
import type { PointState } from './pointState'
import type { SlotView } from './slotView'

/** What she is doing, apart from moving and talking. */
export type CompanionPose = 'resting' | 'thinking' | 'pointing'

/** Where she wants to be, and what she does once she is there. */
export interface CompanionLook {
  /** Home at the dock, beside what the answer points at, or where she is. */
  goes: 'dock' | 'target' | 'stay'
  pose: CompanionPose
}

/**
 * Whether the answer's current step points at something:
 * at nothing, at something that is not on screen yet, or at something shown.
 */
export type PointedTarget = 'none' | 'hidden' | 'shown'

/**
 * While a follow-up waits for its reply she keeps to where she is, and thinks
 * there instead of pointing: the follow-up was sent to her, from her answer.
 */
export function companionLook(facts: {
  phase: PointState['phase']
  target: PointedTarget
  followUpWaiting: boolean
}): CompanionLook {
  const { phase, target, followUpWaiting } = facts
  if (phase === 'guiding') {
    if (target === 'hidden') return { goes: 'stay', pose: 'thinking' }
    if (target === 'shown')
      return { goes: 'target', pose: followUpWaiting ? 'thinking' : 'pointing' }
    return { goes: 'dock', pose: followUpWaiting ? 'thinking' : 'resting' }
  }
  if (phase === 'waiting') return { goes: 'dock', pose: 'thinking' }
  return { goes: 'dock', pose: 'resting' }
}

/**
 * The Ask slot's waiting line and its hint are what she says while she is
 * there, so the slot leaves them out, and `says` is which of them she says.
 * Every other slot stays as it is, and she says nothing for it.
 */
export function withCompanion(slot: SlotView): {
  slot: SlotView
  says: 'waiting' | 'hint' | null
} {
  if (slot.kind === 'waiting' || slot.kind === 'hint')
    return { slot: { kind: 'none' }, says: slot.kind }
  return { slot, says: null }
}

/** The mouth frames of a line she says, one after another; from the cutouts' preview. */
const TALK_LOOP: readonly CompanionFrame[] = [
  'talk-open',
  'talk-wide',
  'talk-open',
  'idle',
  'talk-open',
  'idle',
  'idle'
]

export const TALK_FRAME_MS = 125

const TALK_MS_PER_CHARACTER = 45
const TALK_MIN_MS = 1000
const TALK_MAX_MS = 4000

/** How long her mouth moves for a line: about as long as it takes to say it. */
export function talkDuration(line: string): number {
  return Math.min(
    TALK_MAX_MS,
    Math.max(TALK_MIN_MS, line.length * TALK_MS_PER_CHARACTER)
  )
}

/**
 * The frame to show. Moving shows the delighted one; pointing shows the arm
 * toward the target; a line she is saying moves her mouth (one open frame for
 * people who prefer reduced motion); otherwise the pose's own frame, except
 * that at rest she shows the frame her reaction to the pointer is on.
 * `speakingMs` is how long she has been saying the line, or null.
 */
export function companionFrame(facts: {
  pose: CompanionPose
  points: Pointing
  travelling: boolean
  speakingMs: number | null
  reducedMotion: boolean
  /** The frame her reaction to the pointer is on; only a resting pose shows it. */
  reacting?: CompanionFrame | null
}): CompanionFrame {
  const {
    pose,
    points,
    travelling,
    speakingMs,
    reducedMotion,
    reacting = null
  } = facts
  if (travelling) return 'happy'
  if (pose === 'pointing') return `point-${points}`
  if (speakingMs !== null) {
    if (reducedMotion) return 'talk-open'
    return TALK_LOOP[Math.floor(speakingMs / TALK_FRAME_MS) % TALK_LOOP.length]
  }
  if (pose === 'thinking') return 'thinking'
  return reacting ?? 'idle'
}
