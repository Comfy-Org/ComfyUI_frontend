import type { CatalogueTab } from '@/components/workshop/CatalogueTabs.vue'
import type { t as siteT } from '@/i18n/translations'

export function hubSectionCopy(
  section: Exclude<CatalogueTab, 'models'>,
  t: typeof siteT
) {
  return {
    title: t(`workshop.hubSection.${section}.title`),
    description: t(`workshop.hubSection.${section}.description`),
    heading: t(`workshop.hubSection.${section}.name`)
  }
}
