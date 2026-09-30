import type { AppWorkshopModel } from '../../config/models-catalogue'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/site'
import type { CinematicCopyKey } from './cinematic-studio/copy'

export type WorkshopAppId = AppWorkshopModel['appId']

export function workshopAppHref(app: WorkshopAppId, locale: Locale): string {
  const routes = getRoutes(locale)
  return app === 'reshoot' ? routes.reshoot : routes.cinematicStudio
}

/** The app's open-source repository, once it is published. */
export function workshopAppRepo(app: WorkshopAppId): string | undefined {
  return externalLinks.workshopAppRepos[app]
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

const appCopy = {
  studio: {
    name: 'cinematic.title',
    summary: 'cinematic.hub.studioSummary',
    badge: 'cinematic.hub.beta',
    meta: 'cinematic.hub.studioMeta'
  },
  reshoot: {
    name: 'cinematic.hub.reshoot',
    summary: 'cinematic.hub.reshootSummary',
    badge: 'cinematic.hub.prototype',
    meta: 'cinematic.hub.reshootMeta'
  }
} as const satisfies Record<
  WorkshopAppId,
  {
    readonly name: CinematicCopyKey
    readonly summary: CinematicCopyKey
    readonly badge: CinematicCopyKey
    readonly meta: CinematicCopyKey
  }
>

/** The apps a visitor can open, in the order the Apps list shows them. */
export function workshopApps(
  locale: Locale,
  models: readonly AppWorkshopModel[]
): readonly WorkshopAppCard[] {
  return models.map((app) => ({
    key: app.appId,
    ...appCopy[app.appId],
    image: app.thumbnail?.url ?? app.thumbnailUrl,
    href: workshopAppHref(app.appId, locale)
  }))
}
