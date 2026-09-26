import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface CatalogueApp {
  readonly key: string
  readonly name: string
  readonly summary: string
  readonly badge: string
  readonly href: string
  readonly image?: string
}

export function catalogueApps(locale: Locale = 'en'): CatalogueApp[] {
  const studio = getRoutes(locale).cinematicStudio
  return [
    {
      key: 'cinematic-studio',
      name: t('workshop.apps.studio.name', locale),
      summary: t('workshop.apps.studio.summary', locale),
      badge: t('workshop.apps.beta', locale),
      href: studio,
      image: '/images/cinematic-studio/neon-street.jpg'
    },
    {
      key: 'reshoot',
      name: t('workshop.apps.reshoot.name', locale),
      summary: t('workshop.apps.reshoot.summary', locale),
      badge: t('workshop.apps.prototype', locale),
      href: `${studio}?app=reshoot`
    }
  ]
}
