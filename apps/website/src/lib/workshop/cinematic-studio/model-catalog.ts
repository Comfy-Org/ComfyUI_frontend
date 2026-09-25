import type { InjectionKey } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type { Modality } from '../../../config/models-catalogue'

export interface CinematicCatalogEntry {
  readonly slug: string
  readonly name: string
  readonly provider: string
  readonly routerId: string
  readonly modality: Modality | 'other'
  readonly href: string
  readonly runnable: boolean
}

export const cinematicCatalogKey: InjectionKey<{
  readonly entries: readonly CinematicCatalogEntry[]
  readonly locale: Locale
}> = Symbol('cinematic-model-catalog')
