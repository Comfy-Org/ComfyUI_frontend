import { createRequire } from 'node:module'

import type { noDuplicateIngestType as NoDuplicateIngestType } from './comfyIngestTypes'
import type {
  collectNoNewErrorThrow as CollectNoNewErrorThrow,
  noNewErrorThrow as NoNewErrorThrow
} from './noNewErrorThrow'
import type {
  noModuleScopeVitestMocks as NoModuleScopeVitestMocks,
  noRedundantVitestCleanup as NoRedundantVitestCleanup
} from './vitestCleanup'
import type { noRenderInWatchEffect as NoRenderInWatchEffect } from './watchEffectRendering'

const requireFrom = createRequire(import.meta.url)
const { noDuplicateIngestType } = requireFrom('./comfyIngestTypes.ts') as {
  noDuplicateIngestType: typeof NoDuplicateIngestType
}
const { collectNoNewErrorThrow, noNewErrorThrow } = requireFrom(
  './noNewErrorThrow.ts'
) as {
  collectNoNewErrorThrow: typeof CollectNoNewErrorThrow
  noNewErrorThrow: typeof NoNewErrorThrow
}
const { noModuleScopeVitestMocks, noRedundantVitestCleanup } = requireFrom(
  './vitestCleanup.ts'
) as {
  noModuleScopeVitestMocks: typeof NoModuleScopeVitestMocks
  noRedundantVitestCleanup: typeof NoRedundantVitestCleanup
}
const { noRenderInWatchEffect } = requireFrom('./watchEffectRendering.ts') as {
  noRenderInWatchEffect: typeof NoRenderInWatchEffect
}

export default {
  meta: { name: 'comfy' },
  rules: {
    'collect-no-new-error-throw': collectNoNewErrorThrow,
    'no-duplicate-ingest-type': noDuplicateIngestType,
    'no-module-scope-vitest-mocks': noModuleScopeVitestMocks,
    'no-new-error-throw': noNewErrorThrow,
    'no-render-in-watch-effect': noRenderInWatchEffect,
    'no-redundant-vitest-cleanup': noRedundantVitestCleanup
  }
}
