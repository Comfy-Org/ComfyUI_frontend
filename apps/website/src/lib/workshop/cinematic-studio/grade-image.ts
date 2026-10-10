import type { Direction, DirectionOption, DirectionPart } from './catalog'
import { directionOption } from './catalog'
import type { CinematicCopyKey } from './copy'

interface ShownOption {
  readonly label: CinematicCopyKey
  readonly option: Pick<DirectionOption, 'preview' | 'palette'>
}

/** A palette of the visitor's own stands in for the preset grade. */
export function shownOption(
  part: DirectionPart,
  direction: Direction,
  colors: readonly string[] = []
): ShownOption {
  if (part === 'grade' && colors.length)
    return {
      label: 'cinematic.grade.yourPalette',
      option: { palette: colors }
    }
  const option = directionOption(part, direction)
  return { label: option.label, option }
}
