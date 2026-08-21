import { createRequire } from 'node:module'

import type * as ComfyIngestTypesModule from './comfyIngestTypes'
import type * as VitestCleanupModule from './vitestCleanup'

const requireFrom = createRequire(import.meta.url)
const { noDuplicateIngestType } = requireFrom(
  './comfyIngestTypes.ts'
) as typeof ComfyIngestTypesModule
const { noModuleScopeVitestMocks, noRedundantVitestCleanup } = requireFrom(
  './vitestCleanup.ts'
) as typeof VitestCleanupModule

export default {
  meta: { name: 'comfy' },
  rules: {
    'no-duplicate-ingest-type': noDuplicateIngestType,
    'no-module-scope-vitest-mocks': noModuleScopeVitestMocks,
    'no-redundant-vitest-cleanup': noRedundantVitestCleanup
  }
}
