import type {
  DirectionGroup,
  LookPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import {
  cameraGroups,
  gradeGroup,
  lookGroups
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

export type PickerKey = 'camera' | LookPart | 'grade'

export type PopoverKey = PickerKey | 'direction' | 'references' | 'format'

export function pickerGroups(key?: PopoverKey): readonly DirectionGroup[] {
  if (key === 'camera') return cameraGroups
  if (key === 'grade') return [gradeGroup]
  if (key === 'direction') return [...lookGroups, gradeGroup]
  return lookGroups.filter((group) => group.part === key)
}

export function popoverTitle(key: PopoverKey, locale: Locale): string {
  if (key === 'camera') return tc('cinematic.section.camera', locale)
  if (key === 'direction') return tc('cinematic.section.direction', locale)
  if (key === 'references') return tc('cinematic.section.references', locale)
  if (key === 'format') return tc('cinematic.composer.format', locale)
  return tc(pickerGroups(key)[0].title, locale)
}
