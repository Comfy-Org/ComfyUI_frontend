import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  treatConfigHintsAsErrors: true,
  workspaces: {
    '.': {
      entry: [
        '{build,scripts}/**/*.{js,ts}',
        'src/assets/css/style.css',
        'src/scripts/ui/menu/index.ts',
        'src/types/index.ts',
        // Public extension API surface — published package entry point.
        // Per AGENTS.md, this barrel is the explicit exception to the
        // no-barrel-files-in-src rule because it IS the package entry.
        'src/extension-api/index.ts',
        'src/storybook/mocks/**/*.ts'
      ],
      project: ['**/*.{js,ts,vue}', '*.{js,ts,mts}', '!.claude/**']
    },
    'apps/desktop-ui': {
      entry: ['src/i18n.ts'],
      project: ['src/**/*.{js,ts,vue}']
    },
    'packages/design-system': {
      project: ['src/**/*.{css,js,ts}']
    },
    'packages/tailwind-utils': {
      project: ['src/**/*.{js,ts}']
    },
    'packages/shared-frontend-utils': {
      project: ['src/**/*.{js,ts}']
    },
    'packages/registry-types': {
      project: ['src/**/*.{js,ts}']
    },
    'packages/ingest-types': {
      project: ['src/**/*.{js,ts}']
    },
    'apps/website': {
      entry: ['src/scripts/**/*.ts']
    }
  },
  ignoreBinaries: ['python3'],
  ignoreDependencies: [
    // Weird importmap things
    '@iconify-json/lucide',
    '@iconify/json',
    '@primeuix/forms',
    '@primeuix/styled',
    '@primeuix/utils',
    '@primevue/icons'
  ],
  ignore: [
    // Auto generated API types
    'src/workbench/extensions/manager/types/generatedManagerTypes.ts',
    'packages/ingest-types/src/zod.gen.ts',
    // Workflow files contain license names that knip misinterprets as binaries
    '.github/workflows/ci-oss-assets-validation.yaml',
    // Pending integration in stacked PR
    'src/components/sidebar/tabs/nodeLibrary/CustomNodesPanel.vue',
    // Marketing media tooling — adopted by pages in a follow-up PR
    'apps/website/src/components/common/SiteVideo.vue',
    'apps/website/src/utils/marketingImage.ts',
    // Agent review check config, not part of the build
    '.agents/checks/eslint.strict.config.js',
    // Devtools extensions, included dynamically
    'tools/devtools/web/**',
    // Deprecated stub re-exporting from `@/extension-api`. Will be removed
    // once PKG2 (`@comfyorg/extension-api`) ships and downstream imports
    // migrate to the package path.
    'src/types/extensionV2.ts',
    // D18 Phase 1 scaffolding — empty registries the loader will populate
    // in Phase 2 once side-effect registration moves out of
    // extension-api-service. See decisions/D18-pure-functions-loader-registration.md.
    'src/services/registries/**',
    // D18 Phase 1 — brand symbol + isBrandedExtension guard. Currently
    // consumed only by the define* call sites inside extension-api-service;
    // the type-guard and getBrandKind are exported for the Phase 2 loader.
    'src/extension-api/brand.ts'
  ],
  vite: {
    config: ['vite?(.*).config.mts']
  },
  vitest: {
    config: ['vitest?(.*).config.ts'],
    entry: [
      '**/*.{bench,test,test-d,spec}.?(c|m)[jt]s?(x)',
      '**/__mocks__/**/*.[jt]s?(x)'
    ]
  },
  playwright: {
    config: ['playwright?(.*).config.ts'],
    entry: ['**/*.@(spec|test).?(c|m)[jt]s?(x)', 'browser_tests/**/*.ts']
  },
  tags: [
    '-knipIgnoreUnusedButUsedByCustomNodes',
    '-knipIgnoreUnusedButUsedByVueNodesBranch',
    '-knipIgnoreUsedByStackedPR',
    // Public API surface consumed externally by extension authors and the
    // TypeDoc docgen pipeline (PKG2). Mark exports with @publicAPI when they
    // are part of `@comfyorg/extension-api` but not internally referenced.
    '-publicAPI'
  ]
}

export default config
