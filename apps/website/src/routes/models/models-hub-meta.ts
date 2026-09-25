import type { Locale } from '../../config/locales'
import type { RouterWorkshopModel } from '../../config/models-catalogue'
import { t } from '../../i18n/translations'

const HEADLINE_FAMILIES = ['FLUX', 'Seedance', 'Kling', 'Veo', 'Nano Banana']

export function modelsHubMeta(
  models: readonly Pick<RouterWorkshopModel, 'name'>[],
  locale: Locale = 'en'
) {
  const families = HEADLINE_FAMILIES.filter((family) =>
    models.some((model) => model.name.includes(family))
  )
  return {
    title: t('models.hub.meta.title', locale),
    description: t(
      families.length
        ? 'models.hub.meta.description'
        : 'models.hub.meta.descriptionWithoutNames',
      locale
    )
      .replace('{count}', String(models.length))
      .replace(
        '{names}',
        new Intl.ListFormat(locale, { type: 'conjunction' }).format(families)
      )
  }
}
