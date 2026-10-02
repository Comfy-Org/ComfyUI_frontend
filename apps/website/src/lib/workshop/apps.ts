import type { AppWorkshopModel } from '../../config/models-catalogue'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import type { CinematicCopyKey } from './cinematic-studio/copy'

export type WorkshopAppId = AppWorkshopModel['appId']

const appRoutes = {
  studio: 'cinematicStudio',
  reshoot: 'reshoot',
  'move-anything': 'moveAnything',
  relight: 'relight',
  'hand-product-swap': 'handProductSwap'
} as const satisfies Record<WorkshopAppId, keyof ReturnType<typeof getRoutes>>

export function workshopAppHref(app: WorkshopAppId, locale: Locale): string {
  return getRoutes(locale)[appRoutes[app]]
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
  },
  'move-anything': {
    name: 'cinematic.hub.moveAnything',
    summary: 'cinematic.hub.moveAnythingSummary',
    badge: 'cinematic.hub.prototype',
    meta: 'cinematic.hub.moveAnythingMeta'
  },
  relight: {
    name: 'cinematic.hub.relight',
    summary: 'cinematic.hub.relightSummary',
    badge: 'cinematic.hub.prototype',
    meta: 'cinematic.hub.relightMeta'
  },
  'hand-product-swap': {
    name: 'cinematic.hub.handProductSwap',
    summary: 'cinematic.hub.handProductSwapSummary',
    badge: 'cinematic.hub.prototype',
    meta: 'cinematic.hub.handProductSwapMeta'
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
