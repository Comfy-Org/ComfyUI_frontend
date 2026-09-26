import type { RouterWorkshopModel } from '../../config/models-catalogue'
import { t, tPlural } from '../../i18n/translations'

const HEADLINE_FAMILIES = ['FLUX', 'Seedance', 'Kling', 'Veo', 'Nano Banana']

export function modelsHubMeta(
  models: readonly Pick<RouterWorkshopModel, 'name'>[]
) {
  const families = HEADLINE_FAMILIES.filter((family) =>
    models.some((model) => model.name.includes(family))
  )
  return {
    title: t('models.hub.meta.title'),
    description: tPlural(
      families.length
        ? 'models.hub.meta.description'
        : 'models.hub.meta.descriptionWithoutNames',
      models.length
    ).replace(
      '{names}',
      new Intl.ListFormat('en', { type: 'conjunction' }).format(families)
    )
  }
}
