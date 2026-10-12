import type { RouterWorkshopModel } from '@/config/models-catalogue'
import { translationsFor } from '@/i18n/translations'

const HEADLINE_FAMILIES = ['FLUX', 'Seedance', 'Kling', 'Veo', 'Nano Banana']

export function modelsHubMeta(
  models: readonly Pick<RouterWorkshopModel, 'name'>[]
) {
  const { t } = translationsFor('en')
  const families = HEADLINE_FAMILIES.filter((family) =>
    models.some((model) => model.name.includes(family))
  )
  return {
    title: t('models.hub.meta.title'),
    description: t(
      families.length
        ? 'models.hub.meta.description'
        : 'models.hub.meta.descriptionWithoutNames',
      {
        count: models.length,
        names: new Intl.ListFormat('en', { type: 'conjunction' }).format(
          families
        )
      },
      { plural: models.length }
    )
  }
}
