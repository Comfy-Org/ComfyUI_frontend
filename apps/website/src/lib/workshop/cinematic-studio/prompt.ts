import type { Direction, DirectionPart } from './catalog'
import { directionOption } from './catalog'

export interface CinematicBrief {
  readonly scene: string
  readonly direction: Direction
  readonly enhance: boolean
  readonly cast: boolean
  readonly palette: boolean
}

type PromptSource = 'scene' | 'direction' | 'enhance' | 'reference'

export interface PromptSegment {
  readonly text: string
  readonly source: PromptSource
}

const CAMERA_PARTS: readonly DirectionPart[] = [
  'body',
  'lens',
  'focal',
  'aperture'
]
const LOOK_PARTS: readonly DirectionPart[] = ['light', 'film', 'look', 'grade']

const phrases = (parts: readonly DirectionPart[], direction: Direction) =>
  parts.map((part) => directionOption(part, direction).phrase).filter(Boolean)

const sentence = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}.`

/**
 * The prompt the studio sends, split by where each part came from so the
 * panel can show which words the direction added. A production workflow can
 * replace this without touching the UI: it only needs the same brief.
 */
export function cinematicPromptSegments(
  brief: CinematicBrief
): readonly PromptSegment[] {
  const shot = directionOption('shot', brief.direction).phrase
  const camera = phrases(CAMERA_PARTS, brief.direction)
  const look = phrases(LOOK_PARTS, brief.direction)
  const scene = brief.scene.trim()
  const castIndex = brief.cast ? 1 : 0
  const segments: (PromptSegment | false)[] = [
    !!shot && { text: sentence(shot), source: 'direction' },
    !!scene && { text: scene, source: 'scene' },
    brief.enhance && {
      text: 'Cinematic film still, natural texture.',
      source: 'enhance'
    },
    camera.length > 0 && {
      text: `Shot on ${camera.join(', ')}.`,
      source: 'direction'
    },
    look.length > 0 && { text: sentence(look.join(', ')), source: 'direction' },
    brief.cast && {
      text: 'Keep the character from reference image 1.',
      source: 'reference'
    },
    brief.palette && {
      text: `Match the color palette of reference image ${castIndex + 1}.`,
      source: 'reference'
    }
  ]
  return segments.filter((segment): segment is PromptSegment => !!segment)
}

export function cinematicPrompt(brief: CinematicBrief): string {
  return cinematicPromptSegments(brief)
    .map((segment) => segment.text)
    .join(' ')
}
