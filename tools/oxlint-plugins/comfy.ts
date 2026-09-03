import { createRequire } from 'node:module'

import type { noComfyPageSetupCall as NoComfyPageSetupCall } from './comfyPageSetup'
import type { noDuplicateIngestType as NoDuplicateIngestType } from './comfyIngestTypes'
import type {
  noModuleScopeVitestMocks as NoModuleScopeVitestMocks,
  noPersistentLiteGraphRegistration as NoPersistentLiteGraphRegistration,
  noRedundantLiteGraphCleanup as NoRedundantLiteGraphCleanup,
  noRedundantVitestCleanup as NoRedundantVitestCleanup
} from './vitestCleanup'
import type { noRenderInWatchEffect as NoRenderInWatchEffect } from './watchEffectRendering'

const requireFrom = createRequire(import.meta.url)
const { noComfyPageSetupCall } = requireFrom('./comfyPageSetup.ts') as {
  noComfyPageSetupCall: typeof NoComfyPageSetupCall
}
const { noDuplicateIngestType } = requireFrom('./comfyIngestTypes.ts') as {
  noDuplicateIngestType: typeof NoDuplicateIngestType
}
const {
  noModuleScopeVitestMocks,
  noPersistentLiteGraphRegistration,
  noRedundantLiteGraphCleanup,
  noRedundantVitestCleanup
} = requireFrom('./vitestCleanup.ts') as {
  noModuleScopeVitestMocks: typeof NoModuleScopeVitestMocks
  noPersistentLiteGraphRegistration: typeof NoPersistentLiteGraphRegistration
  noRedundantLiteGraphCleanup: typeof NoRedundantLiteGraphCleanup
  noRedundantVitestCleanup: typeof NoRedundantVitestCleanup
}
const { noRenderInWatchEffect } = requireFrom('./watchEffectRendering.ts') as {
  noRenderInWatchEffect: typeof NoRenderInWatchEffect
}

export default {
  meta: { name: 'comfy' },
  rules: {
    'no-comfy-page-setup-call': noComfyPageSetupCall,
    'no-duplicate-ingest-type': noDuplicateIngestType,
    'no-module-scope-vitest-mocks': noModuleScopeVitestMocks,
    'no-persistent-litegraph-registration': noPersistentLiteGraphRegistration,
    'no-render-in-watch-effect': noRenderInWatchEffect,
    'no-redundant-litegraph-cleanup': noRedundantLiteGraphCleanup,
    'no-redundant-vitest-cleanup': noRedundantVitestCleanup
  }
}
