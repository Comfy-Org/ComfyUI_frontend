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
import { studioT as tc } from '../../../lib/workshop/cinematic-studio/copy'

export type PickerKey = 'camera' | LookPart | 'grade'

export function pickerGroups(key?: PickerKey): readonly DirectionGroup[] {
  if (key === 'camera') return cameraGroups
  if (key === 'grade') return [gradeGroup]
  return lookGroups.filter((group) => group.part === key)
}

export function popoverTitle(key: PickerKey, locale: Locale): string {
  if (key === 'camera')
    return tc('cinematic.section.camera', {}, { locale: locale })
  return tc(pickerGroups(key)[0].title, {}, { locale: locale })
}
