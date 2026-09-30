import { getRoutes } from '../config/routes'
import {
  loadAppCatalogue,
  loadWorkflowCatalogue
} from '../lib/workshop/catalogue-components'

const routes = getRoutes('en')
const catalogues: Readonly<Record<string, () => Promise<unknown>>> = {
  [routes.workshop]: () =>
    import('../components/workshop/WorkshopModelsGrid.vue'),
  [routes.hubWorkflows]: loadWorkflowCatalogue,
  [routes.hubApps]: loadAppCatalogue
}

function isHubNavigation(from: URL, to: URL) {
  return (
    from.origin === to.origin &&
    Object.hasOwn(catalogues, from.pathname) &&
    Object.hasOwn(catalogues, to.pathname)
  )
}

document.addEventListener('astro:before-preparation', (event) => {
  if (!isHubNavigation(event.from, event.to)) return
  const prepare = event.loader
  event.loader = async () => {
    await Promise.all([
      prepare(),
      catalogues[event.to.pathname]().catch(() => undefined)
    ])
  }
})

document.addEventListener('astro:before-swap', (event) => {
  if (!isHubNavigation(event.from, event.to)) return
  void event.viewTransition.ready.catch(() => undefined)
  event.viewTransition.skipTransition()
})
