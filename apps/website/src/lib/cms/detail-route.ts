import type { InjectionKey } from 'vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import { workshopRunInFlight } from '@/config/workshop-run-state'
import { withoutCatalogLocalePrefix } from '@/config/catalog-locales'

export const catalogDetailNavigation: InjectionKey<
  (event: MouseEvent, model: WorkshopModel) => void
> = Symbol('catalog-detail-navigation')

export const catalogBrowseNavigation: InjectionKey<
  (event: MouseEvent) => void
> = Symbol('catalog-browse-navigation')

export function catalogDetailPath(path: string) {
  return /^\/hub\/(?:models|workflows)\/[^/]+\/?$/.test(
    withoutCatalogLocalePrefix(path)
  )
}

export function listenCatalogHistory(
  restore: (event: PopStateEvent) => boolean
) {
  const listener = (event: Event) => {
    if (
      !(event instanceof CustomEvent) ||
      !(event.detail instanceof PopStateEvent)
    )
      return
    // An active render's existing leave/traversal guards own navigation. Never
    // unmount its page through the fast idle-browsing history path.
    if (workshopRunInFlight.value) return
    if (restore(event.detail)) event.preventDefault()
  }
  document.addEventListener('ccc:history', listener)
  return () => document.removeEventListener('ccc:history', listener)
}
