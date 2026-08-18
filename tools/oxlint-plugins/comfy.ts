import { createRequire } from 'node:module'

import type * as comfyIngestTypes from './comfyIngestTypes'
import type * as computedDom from './computedDom'
import type * as restrictedSyntax from './restrictedSyntax'
import type * as vitestCleanup from './vitestCleanup'

const requireFrom = createRequire(import.meta.url)
const { noDomInComputed } = requireFrom(
  './computedDom.ts'
) as typeof computedDom
const { noDuplicateIngestType } = requireFrom(
  './comfyIngestTypes.ts'
) as typeof comfyIngestTypes
const { noUnsafeErrorAssertion } = requireFrom(
  './restrictedSyntax.ts'
) as typeof restrictedSyntax
const { noModuleScopeVitestMocks, noRedundantVitestCleanup } = requireFrom(
  './vitestCleanup.ts'
) as typeof vitestCleanup

export default {
  meta: { name: 'comfy' },
  rules: {
    'no-dom-in-computed': noDomInComputed,
    'no-duplicate-ingest-type': noDuplicateIngestType,
    'no-module-scope-vitest-mocks': noModuleScopeVitestMocks,
    'no-redundant-vitest-cleanup': noRedundantVitestCleanup,
    'no-unsafe-error-assertion': noUnsafeErrorAssertion
  }
}
