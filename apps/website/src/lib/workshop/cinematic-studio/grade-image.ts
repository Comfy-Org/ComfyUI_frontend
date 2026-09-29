import type { Direction, DirectionOption, DirectionPart } from './catalog'
import { directionOption } from './catalog'
import type { CinematicCopyKey } from './copy'

interface ShownOption {
  readonly label: CinematicCopyKey
  readonly option: Pick<DirectionOption, 'preview' | 'palette'>
}

/** A grade matched from an uploaded image stands in for the preset grade. */
export function shownOption(
  part: DirectionPart,
  direction: Direction,
  palettePreview?: string
): ShownOption {
  if (part === 'grade' && palettePreview)
    return {
      label: 'cinematic.grade.yourImage',
      option: { preview: palettePreview }
    }
  const option = directionOption(part, direction)
  return { label: option.label, option }
}
