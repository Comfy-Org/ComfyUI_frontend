import type { Plugin } from 'vite'

import { isWorkshopInBuild } from '../config/workshop-release'

const CATALOGUE_MODULES = [
  '/src/config/models-catalogue.ts',
  '/src/config/workshop-browse-content.ts',
  '/src/content/workshop-models.json',
  '/src/content/workshop-display.json',
  '/src/content/workshop-router-index.json',
  '/src/content/workshop-router-contracts.json'
]

export function workshopClientBoundary(): Plugin {
  return {
    name: 'workshop-client-boundary',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle(_options, bundle) {
      if (isWorkshopInBuild()) return
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        for (const [id, module] of Object.entries(chunk.modules)) {
          const path = id.replaceAll('\\', '/').split('?')[0]
          if (
            module.renderedLength > 0 &&
            CATALOGUE_MODULES.some((suffix) => path.endsWith(suffix))
          ) {
            this.error(
              `Workshop is disabled, but ${chunk.fileName} contains ${path}. Resolve catalogue data on the server and pass only enabled page props to client islands.`
            )
          }
        }
      }
    }
  }
}
