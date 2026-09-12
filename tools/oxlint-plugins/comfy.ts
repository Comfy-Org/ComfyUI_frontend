import { createRequire } from 'node:module'

import type {
  noComfyPageSetupCall as NoComfyPageSetupCall,
  preferInitialSettings as PreferInitialSettings
} from './comfyPageSetup'
import type { noDuplicateIngestType as NoDuplicateIngestType } from './comfyIngestTypes'
import type { useGlobalPinia as UseGlobalPinia } from './globalPinia'
import type {
  noDeprecatedApiSchema as NoDeprecatedApiSchema,
  noDomInComputed as NoDomInComputed,
  noMisplacedSpecFiles as NoMisplacedSpecFiles,
  noNewZodForRemoteApiTypes as NoNewZodForRemoteApiTypes,
  noNewZodServerResponseSchema as NoNewZodServerResponseSchema,
  noPlaywrightImportsInFixtureData as NoPlaywrightImportsInFixtureData,
  noUnitTestFilesInBrowserTests as NoUnitTestFilesInBrowserTests,
  noUnsafeErrorAssertion as NoUnsafeErrorAssertion
} from './restrictedSyntax'
import type {
  noModuleScopeVitestMocks as NoModuleScopeVitestMocks,
  noPersistentLiteGraphRegistration as NoPersistentLiteGraphRegistration,
  noRedundantLiteGraphCleanup as NoRedundantLiteGraphCleanup,
  noRedundantVitestCleanup as NoRedundantVitestCleanup
} from './vitestCleanup'
import type { noRenderInWatchEffect as NoRenderInWatchEffect } from './watchEffectRendering'

const requireFrom = createRequire(import.meta.url)
const { noComfyPageSetupCall, preferInitialSettings } = requireFrom(
  './comfyPageSetup.ts'
) as {
  noComfyPageSetupCall: typeof NoComfyPageSetupCall
  preferInitialSettings: typeof PreferInitialSettings
}
const { noDuplicateIngestType } = requireFrom('./comfyIngestTypes.ts') as {
  noDuplicateIngestType: typeof NoDuplicateIngestType
}
const { useGlobalPinia } = requireFrom('./globalPinia.ts') as {
  useGlobalPinia: typeof UseGlobalPinia
}
const {
  noDeprecatedApiSchema,
  noDomInComputed,
  noMisplacedSpecFiles,
  noNewZodForRemoteApiTypes,
  noNewZodServerResponseSchema,
  noPlaywrightImportsInFixtureData,
  noUnitTestFilesInBrowserTests,
  noUnsafeErrorAssertion
} = requireFrom('./restrictedSyntax.ts') as {
  noDeprecatedApiSchema: typeof NoDeprecatedApiSchema
  noDomInComputed: typeof NoDomInComputed
  noMisplacedSpecFiles: typeof NoMisplacedSpecFiles
  noNewZodForRemoteApiTypes: typeof NoNewZodForRemoteApiTypes
  noNewZodServerResponseSchema: typeof NoNewZodServerResponseSchema
  noPlaywrightImportsInFixtureData: typeof NoPlaywrightImportsInFixtureData
  noUnitTestFilesInBrowserTests: typeof NoUnitTestFilesInBrowserTests
  noUnsafeErrorAssertion: typeof NoUnsafeErrorAssertion
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
    'no-deprecated-api-schema': noDeprecatedApiSchema,
    'no-dom-in-computed': noDomInComputed,
    'no-duplicate-ingest-type': noDuplicateIngestType,
    'no-misplaced-spec-files': noMisplacedSpecFiles,
    'no-module-scope-vitest-mocks': noModuleScopeVitestMocks,
    'no-new-zod-for-remote-api-types': noNewZodForRemoteApiTypes,
    'no-new-zod-server-response-schema': noNewZodServerResponseSchema,
    'no-persistent-litegraph-registration': noPersistentLiteGraphRegistration,
    'no-playwright-imports-in-fixture-data': noPlaywrightImportsInFixtureData,
    'no-render-in-watch-effect': noRenderInWatchEffect,
    'no-redundant-litegraph-cleanup': noRedundantLiteGraphCleanup,
    'no-redundant-vitest-cleanup': noRedundantVitestCleanup,
    'no-unit-test-files-in-browser-tests': noUnitTestFilesInBrowserTests,
    'no-unsafe-error-assertion': noUnsafeErrorAssertion,
    'prefer-initial-settings': preferInitialSettings,
    'use-global-pinia': useGlobalPinia
  }
}
