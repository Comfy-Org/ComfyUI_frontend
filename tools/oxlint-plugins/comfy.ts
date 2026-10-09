import { createRequire } from 'node:module'

import type {
  noComfyPageSetupCall as NoComfyPageSetupCall,
  preferInitialSettings as PreferInitialSettings
} from './comfyPageSetup'
import type { noDuplicateIngestType as NoDuplicateIngestType } from './comfyIngestTypes'
import type { useGlobalPinia as UseGlobalPinia } from './globalPinia'
import type {
  noRelativePackages as NoRelativePackages,
  noRelativeParentPaths as NoRelativeParentPaths,
  noRestrictedPaths as NoRestrictedPaths,
  noUselessPathSegments as NoUselessPathSegments
} from './importPaths'
import type { noNewErrorThrow as NoNewErrorThrow } from './noNewErrorThrow'
import type {
  noDeprecatedApiSchema as NoDeprecatedApiSchema,
  noDirectSelectionWrite as NoDirectSelectionWrite,
  noDomInComputed as NoDomInComputed,
  noEs2023ArrayCopyMethod as NoEs2023ArrayCopyMethod,
  noJsPrivateClassMembers as NoJsPrivateClassMembers,
  noMisplacedSpecFiles as NoMisplacedSpecFiles,
  noNewZodForRemoteApiTypes as NoNewZodForRemoteApiTypes,
  noNewZodServerResponseSchema as NoNewZodServerResponseSchema,
  noPlaywrightImportsInFixtureData as NoPlaywrightImportsInFixtureData,
  noPrimeVueImports as NoPrimeVueImports,
  noStaticallyDisabledTest as NoStaticallyDisabledTest,
  noUnitTestFilesInBrowserTests as NoUnitTestFilesInBrowserTests,
  noUnsafeErrorAssertion as NoUnsafeErrorAssertion,
  noVitestMockMethodNames as NoVitestMockMethodNames
} from './restrictedSyntax'
import type {
  noImportActual as NoImportActual,
  noModuleScopeVitestMocks as NoModuleScopeVitestMocks,
  noPersistentLiteGraphRegistration as NoPersistentLiteGraphRegistration,
  noRedundantConsoleSpy as NoRedundantConsoleSpy,
  noRedundantFetchStub as NoRedundantFetchStub,
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
  noRelativePackages,
  noRelativeParentPaths,
  noRestrictedPaths,
  noUselessPathSegments
} = requireFrom('./importPaths.ts') as {
  noRelativePackages: typeof NoRelativePackages
  noRelativeParentPaths: typeof NoRelativeParentPaths
  noRestrictedPaths: typeof NoRestrictedPaths
  noUselessPathSegments: typeof NoUselessPathSegments
}
const { noNewErrorThrow } = requireFrom('./noNewErrorThrow.ts') as {
  noNewErrorThrow: typeof NoNewErrorThrow
}
const {
  noDeprecatedApiSchema,
  noDirectSelectionWrite,
  noDomInComputed,
  noEs2023ArrayCopyMethod,
  noJsPrivateClassMembers,
  noMisplacedSpecFiles,
  noNewZodForRemoteApiTypes,
  noNewZodServerResponseSchema,
  noPlaywrightImportsInFixtureData,
  noPrimeVueImports,
  noStaticallyDisabledTest,
  noUnitTestFilesInBrowserTests,
  noUnsafeErrorAssertion,
  noVitestMockMethodNames
} = requireFrom('./restrictedSyntax.ts') as {
  noDeprecatedApiSchema: typeof NoDeprecatedApiSchema
  noDirectSelectionWrite: typeof NoDirectSelectionWrite
  noDomInComputed: typeof NoDomInComputed
  noEs2023ArrayCopyMethod: typeof NoEs2023ArrayCopyMethod
  noJsPrivateClassMembers: typeof NoJsPrivateClassMembers
  noMisplacedSpecFiles: typeof NoMisplacedSpecFiles
  noNewZodForRemoteApiTypes: typeof NoNewZodForRemoteApiTypes
  noNewZodServerResponseSchema: typeof NoNewZodServerResponseSchema
  noPlaywrightImportsInFixtureData: typeof NoPlaywrightImportsInFixtureData
  noPrimeVueImports: typeof NoPrimeVueImports
  noStaticallyDisabledTest: typeof NoStaticallyDisabledTest
  noUnitTestFilesInBrowserTests: typeof NoUnitTestFilesInBrowserTests
  noUnsafeErrorAssertion: typeof NoUnsafeErrorAssertion
  noVitestMockMethodNames: typeof NoVitestMockMethodNames
}
const {
  noImportActual,
  noModuleScopeVitestMocks,
  noPersistentLiteGraphRegistration,
  noRedundantConsoleSpy,
  noRedundantFetchStub,
  noRedundantLiteGraphCleanup,
  noRedundantVitestCleanup
} = requireFrom('./vitestCleanup.ts') as {
  noImportActual: typeof NoImportActual
  noModuleScopeVitestMocks: typeof NoModuleScopeVitestMocks
  noPersistentLiteGraphRegistration: typeof NoPersistentLiteGraphRegistration
  noRedundantConsoleSpy: typeof NoRedundantConsoleSpy
  noRedundantFetchStub: typeof NoRedundantFetchStub
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
    'no-direct-selection-write': noDirectSelectionWrite,
    'no-dom-in-computed': noDomInComputed,
    'no-js-private-class-members': noJsPrivateClassMembers,
    'no-duplicate-ingest-type': noDuplicateIngestType,
    'no-es2023-array-copy-method': noEs2023ArrayCopyMethod,
    'no-import-actual': noImportActual,
    'no-misplaced-spec-files': noMisplacedSpecFiles,
    'no-module-scope-vitest-mocks': noModuleScopeVitestMocks,
    'no-new-error-throw': noNewErrorThrow,
    'no-new-zod-for-remote-api-types': noNewZodForRemoteApiTypes,
    'no-new-zod-server-response-schema': noNewZodServerResponseSchema,
    'no-persistent-litegraph-registration': noPersistentLiteGraphRegistration,
    'no-playwright-imports-in-fixture-data': noPlaywrightImportsInFixtureData,
    'no-primevue-imports': noPrimeVueImports,
    'no-render-in-watch-effect': noRenderInWatchEffect,
    'no-statically-disabled-test': noStaticallyDisabledTest,
    'no-redundant-console-spy': noRedundantConsoleSpy,
    'no-redundant-fetch-stub': noRedundantFetchStub,
    'no-redundant-litegraph-cleanup': noRedundantLiteGraphCleanup,
    'no-redundant-vitest-cleanup': noRedundantVitestCleanup,
    'no-relative-packages': noRelativePackages,
    'no-relative-parent-paths': noRelativeParentPaths,
    'no-restricted-paths': noRestrictedPaths,
    'no-unit-test-files-in-browser-tests': noUnitTestFilesInBrowserTests,
    'no-unsafe-error-assertion': noUnsafeErrorAssertion,
    'no-useless-path-segments': noUselessPathSegments,
    'no-vitest-mock-method-names': noVitestMockMethodNames,
    'prefer-initial-settings': preferInitialSettings,
    'use-global-pinia': useGlobalPinia
  }
}
