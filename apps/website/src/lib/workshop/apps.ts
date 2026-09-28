import type { AppWorkshopModel } from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import type { CinematicCopyKey } from './cinematic-studio/copy'

export type WorkshopAppId = AppWorkshopModel['appId']

export function workshopAppHref(app: WorkshopAppId, locale: Locale): string {
  const routes = getRoutes(locale)
  return app === 'reshoot' ? routes.reshoot : routes.cinematicStudio
}

/** The app whose page `pathname` is, if any. */
export function workshopAppAt(
  pathname: string,
  locale: Locale
): WorkshopAppId | undefined {
  const page = pathname.replace(/\/$/, '')
  return (['studio', 'reshoot'] as const).find(
    (app) => workshopAppHref(app, locale) === page
  )
}

export interface WorkshopAppCard {
  readonly key: string
  readonly name: CinematicCopyKey
  readonly summary: CinematicCopyKey
  readonly badge: CinematicCopyKey
  readonly meta?: CinematicCopyKey
  readonly image?: string
  readonly href?: string
}

/** The apps a visitor can open, in the order the Apps list shows them. */
export function workshopApps(locale: Locale): readonly WorkshopAppCard[] {
  return [
    {
      key: 'cinematic-studio',
      name: 'cinematic.title',
      summary: 'cinematic.hub.studioSummary',
      badge: 'cinematic.hub.beta',
      meta: 'cinematic.hub.studioMeta',
      image: '/images/cinematic-studio/neon-street.jpg',
      href: workshopAppHref('studio', locale)
    },
    {
      key: 'reshoot',
      name: 'cinematic.hub.reshoot',
      summary: 'cinematic.hub.reshootSummary',
      badge: 'cinematic.hub.prototype',
      meta: 'cinematic.hub.reshootMeta',
      image: '/images/cinematic-studio/desert.jpg',
      href: workshopAppHref('reshoot', locale)
    }
  ]
}
