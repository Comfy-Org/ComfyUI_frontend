import type { Plugin } from 'vite'

import { isWorkshopInBuild } from '../config/workshop-release'

const CLIENT_HELPERS = /\/src\/config\/models-catalogue\.ts$/
const SERVER_ONLY_CATALOGUE =
  /\/src\/(?:config\/(?:workshop-browse-content|workshop-model-order)\.ts|(?:content|data)\/workshop-[^/]+\.json)$/

export function workshopClientBoundary(): Plugin {
  return {
    name: 'workshop-client-boundary',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle(_options, bundle) {
      const workshopEnabled = isWorkshopInBuild()
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        for (const [id, module] of Object.entries(chunk.modules)) {
          const path = id.replaceAll('\\', '/').split('?')[0]
          const forbidden =
            SERVER_ONLY_CATALOGUE.test(path) ||
            (!workshopEnabled && CLIENT_HELPERS.test(path))
          if (module.renderedLength > 0 && forbidden) {
            this.error(
              `${chunk.fileName} contains server-only Workshop catalogue data from ${path}. Resolve catalogue data on the server and pass only enabled page props to client islands.`
            )
          }
        }
      }
    }
  }
}
