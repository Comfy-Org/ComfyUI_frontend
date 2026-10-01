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
import { translationsFor } from '../../../i18n/translations'

export type PickerKey = 'camera' | LookPart | 'grade'

export function pickerGroups(key?: PickerKey): readonly DirectionGroup[] {
  if (key === 'camera') return cameraGroups
  if (key === 'grade') return [gradeGroup]
  return lookGroups.filter((group) => group.part === key)
}

export function popoverTitle(key: PickerKey, locale: Locale): string {
  const { t } = translationsFor(locale)
  if (key === 'camera') return t('cinematic.section.camera')
  return t(pickerGroups(key)[0].title)
}
