import type { Plugin } from 'vite'

import { isWorkshopInBuild } from '../config/workshop-release'

const CATALOGUE_MODULE =
  /\/src\/(?:config\/(?:models-catalogue|workshop-browse-content)\.ts|(?:content|data)\/workshop-[^/]+\.json)$/

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
          if (module.renderedLength > 0 && CATALOGUE_MODULE.test(path)) {
            this.error(
              `Workshop is disabled, but ${chunk.fileName} contains ${path}. Resolve catalogue data on the server and pass only enabled page props to client islands.`
            )
          }
        }
      }
    }
  }
}
