import { preferArrayContaining } from './arrayContaining.ts'
import { noDuplicateIngestType } from './comfyIngestTypes.ts'
import {
  noComfyPageSetupCall,
  preferInitialSettings
} from './comfyPageSetup.ts'
import { useGlobalPinia } from './globalPinia.ts'
import {
  noJsExtensionImports,
  noRelativePackages,
  noRelativeParentPaths,
  noRestrictedPaths,
  noUselessPathSegments
} from './importPaths.ts'
import { noNewErrorThrow } from './noNewErrorThrow.ts'
import { noReexports } from './noReexports.ts'
import { noThrowInExpectPoll } from './playwrightPoll.ts'
import { noPositionalBooleanParams } from './positionalBoolean.ts'
import {
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
} from './restrictedSyntax.ts'
import {
  noImportActual,
  noMockedInExpect,
  noModuleScopeVitestMocks,
  noPersistentLiteGraphRegistration,
  noRedundantConsoleSpy,
  noRedundantFetchStub,
  noRedundantLiteGraphCleanup,
  noRedundantVitestCleanup
} from './vitestCleanup.ts'
import { noUnreadHoistedMockState } from './vitestHoisted.ts'
import { noRenderInWatchEffect } from './watchEffectRendering.ts'

export default {
  meta: { name: 'comfy' },
  rules: {
    'no-comfy-page-setup-call': noComfyPageSetupCall,
    'no-deprecated-api-schema': noDeprecatedApiSchema,
    'no-direct-selection-write': noDirectSelectionWrite,
    'no-dom-in-computed': noDomInComputed,
    'no-js-extension-imports': noJsExtensionImports,
    'no-js-private-class-members': noJsPrivateClassMembers,
    'no-duplicate-ingest-type': noDuplicateIngestType,
    'no-es2023-array-copy-method': noEs2023ArrayCopyMethod,
    'no-import-actual': noImportActual,
    'no-misplaced-spec-files': noMisplacedSpecFiles,
    'no-mocked-in-expect': noMockedInExpect,
    'no-module-scope-vitest-mocks': noModuleScopeVitestMocks,
    'no-new-error-throw': noNewErrorThrow,
    'no-new-zod-for-remote-api-types': noNewZodForRemoteApiTypes,
    'no-new-zod-server-response-schema': noNewZodServerResponseSchema,
    'no-persistent-litegraph-registration': noPersistentLiteGraphRegistration,
    'no-playwright-imports-in-fixture-data': noPlaywrightImportsInFixtureData,
    'no-positional-boolean-params': noPositionalBooleanParams,
    'no-primevue-imports': noPrimeVueImports,
    'no-render-in-watch-effect': noRenderInWatchEffect,
    'no-statically-disabled-test': noStaticallyDisabledTest,
    'no-redundant-console-spy': noRedundantConsoleSpy,
    'no-redundant-fetch-stub': noRedundantFetchStub,
    'no-redundant-litegraph-cleanup': noRedundantLiteGraphCleanup,
    'no-redundant-vitest-cleanup': noRedundantVitestCleanup,
    'no-reexports': noReexports,
    'no-relative-packages': noRelativePackages,
    'no-relative-parent-paths': noRelativeParentPaths,
    'no-restricted-paths': noRestrictedPaths,
    'no-throw-in-expect-poll': noThrowInExpectPoll,
    'no-unit-test-files-in-browser-tests': noUnitTestFilesInBrowserTests,
    'no-unread-hoisted-mock-state': noUnreadHoistedMockState,
    'no-unsafe-error-assertion': noUnsafeErrorAssertion,
    'no-useless-path-segments': noUselessPathSegments,
    'no-vitest-mock-method-names': noVitestMockMethodNames,
    'prefer-array-containing': preferArrayContaining,
    'prefer-initial-settings': preferInitialSettings,
    'use-global-pinia': useGlobalPinia
  }
}
