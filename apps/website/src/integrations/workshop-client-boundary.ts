import type { Plugin } from 'vite'

const CATALOGUE_MODULE =
  /\/src\/(?:config\/(?:workshop-browse-content|workshop-router-content|workshop-contract-catalog|workshop-model-order|workshop-page-content|workshop-workflow-content|workshop-workflow-catalog)\.ts|(?:content|data)\/workshop-[^/]+\.jsonl?)$/

export function workshopClientBoundary(): Plugin {
  return {
    name: 'workshop-client-boundary',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        for (const [id, module] of Object.entries(chunk.modules)) {
          const path = id.replaceAll('\\', '/').split('?')[0]
          if (module.renderedLength > 0 && CATALOGUE_MODULE.test(path)) {
            this.error(
              `${chunk.fileName} contains server catalogue data from ${path}. Resolve data on the server and load only the enabled page's payload in the client.`
            )
          }
        }
      }
    }
  }
}
