import { t, tPlural } from '../../i18n/translations'
import type { CatalogueTab } from '../../lib/workshop/catalogue-tabs'

const HEADLINE_FAMILIES = ['FLUX', 'Seedance', 'Kling', 'Veo', 'Nano Banana']

export function modelsHubMeta(models: readonly { readonly name: string }[]) {
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

const CATALOGUE_META_KEYS = {
  workflows: {
    title: 'workshop.hub.workflows',
    description: 'workshop.catalogue.workflowsSubtitle'
  },
  apps: {
    title: 'workshop.catalogue.apps',
    description: 'workshop.catalogue.appsSubtitle'
  }
} as const

export function catalogueHubMeta(
  tab: CatalogueTab,
  models: readonly { readonly name: string }[]
) {
  if (tab === 'models') return modelsHubMeta(models)
  const keys = CATALOGUE_META_KEYS[tab]
  return {
    title: `ComfyUI ${t(keys.title)} - Comfy`,
    description: t(keys.description)
  }
}
