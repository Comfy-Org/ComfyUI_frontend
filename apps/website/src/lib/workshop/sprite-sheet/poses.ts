import type { SpriteMotion } from './options'

/**
 * Where the character sits in one frame, as fractions of the frame:
 * `lift` raises it, `shift` moves it sideways, `tilt` turns it (degrees),
 * `squash` widens and flattens it (0 is none), `stride` lifts the left
 * foot (above 0) or the right foot (below 0), and `shadow` scales the
 * ground shadow.
 */
export interface FramePose {
  readonly lift: number
  readonly shift: number
  readonly tilt: number
  readonly squash: number
  readonly stride: number
  readonly shadow: number
}

/** A repeatable number in [0, 1) for a seed, so a seed redraws the same. */
export function seededUnit(seed: number, salt = 0): number {
  let value = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + salt * 0xc2b2ae35) | 0
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

const round = (value: number) => Math.round(value * 1000) / 1000 + 0

function idle(turn: number, energy: number) {
  const breath = Math.sin(turn * Math.PI * 2)
  return {
    lift: 0.02 * energy * (breath + 1),
    shift: 0,
    tilt: 0,
    squash: -0.025 * energy * breath,
    stride: 0,
    shadow: 1 - 0.06 * energy * (breath + 1)
  }
}

function walk(turn: number, energy: number) {
  const step = Math.sin(turn * Math.PI * 2)
  const bounce = Math.abs(Math.sin(turn * Math.PI * 2))
  return {
    lift: 0.035 * energy * bounce,
    shift: 0.015 * energy * step,
    tilt: 4 * energy * step,
    squash: 0.03 * energy * (1 - bounce),
    stride: 0.05 * energy * step,
    shadow: 1 - 0.12 * bounce
  }
}

function jump(turn: number, energy: number) {
  const crouch = turn < 0.15 || turn > 0.85
  const air = crouch ? 0 : Math.sin(((turn - 0.15) / 0.7) * Math.PI)
  return {
    lift: 0.2 * energy * air,
    shift: 0,
    tilt: crouch ? 0 : -3 * energy * Math.cos(((turn - 0.15) / 0.7) * Math.PI),
    squash: crouch ? 0.14 * energy : -0.1 * energy * air,
    stride: 0,
    shadow: 1 - 0.55 * air
  }
}

const MOTIONS = { idle, walk, jump } as const satisfies Record<
  SpriteMotion,
  (turn: number, energy: number) => FramePose
>

/**
 * Frame `index` of `count` in a looping `motion`. The seed nudges how big
 * and where in its cycle the motion starts, so another seed reads as
 * another take of the same motion.
 */
export function framePose(
  motion: SpriteMotion,
  index: number,
  count: number,
  seed: number
): FramePose {
  const energy = 0.85 + 0.3 * seededUnit(seed, 1)
  const offset = motion === 'jump' ? 0 : seededUnit(seed, 2) / count
  const turn = (((index / Math.max(1, count) + offset) % 1) + 1) % 1
  const pose = MOTIONS[motion](turn, energy)
  return {
    lift: round(pose.lift),
    shift: round(pose.shift),
    tilt: round(pose.tilt),
    squash: round(pose.squash),
    stride: round(pose.stride),
    shadow: round(pose.shadow)
  }
}

/** A pose as a CSS transform for a character filling its frame. */
export function poseTransform(pose: FramePose): string {
  const width = 1 + pose.squash
  const height = 1 - pose.squash
  return [
    `translate(${round(pose.shift * 100)}%, ${round(-pose.lift * 100)}%)`,
    `rotate(${pose.tilt}deg)`,
    `scale(${round(width)}, ${round(height)})`
  ].join(' ')
}
