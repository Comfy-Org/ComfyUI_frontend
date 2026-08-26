import { createRequire } from 'node:module'

const requireFrom = createRequire(import.meta.url)
const { noDuplicateIngestType } = requireFrom(
  './comfyIngestTypes.ts'
) as typeof import('./comfyIngestTypes')
const { noModuleScopeVitestMocks, noRedundantVitestCleanup } = requireFrom(
  './vitestCleanup.ts'
) as typeof import('./vitestCleanup')

export default {
  meta: { name: 'comfy' },
  rules: {
    'no-duplicate-ingest-type': noDuplicateIngestType,
    'no-module-scope-vitest-mocks': noModuleScopeVitestMocks,
    'no-redundant-vitest-cleanup': noRedundantVitestCleanup
  }
}
