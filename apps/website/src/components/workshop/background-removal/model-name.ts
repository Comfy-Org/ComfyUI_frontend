import type { Locale } from '../../../i18n/translations'
import type { ReplaceModel } from '../../../lib/workshop/background-removal/contract'
import { REPLACE_MODELS } from '../../../lib/workshop/background-removal/contract'
import { brc } from '../../../lib/workshop/background-removal/copy'

export function modelName(model: ReplaceModel, locale: Locale) {
  const label = REPLACE_MODELS.find(({ id }) => id === model)?.label
  return label ?? brc('cutout.replace.model.auto', locale)
}
