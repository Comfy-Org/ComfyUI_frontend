import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  treatConfigHintsAsErrors: true,
  treatTagHintsAsErrors: true,
  workspaces: {
    '.': {
      entry: [
        '{build,scripts}/**/*.{js,ts}',
        'vitest.matrix.config.mts',
        'src/assets/css/style.css',
        'src/scripts/ui/menu/index.ts',
        'src/types/index.ts',
        'src/storybook/mocks/**/*.ts',
        'tools/oxlint-plugins/comfyIngestTypes.ts',
        'tools/oxlint-plugins/vitestCleanup.ts'
      ],
      project: [
        '**/*.{js,ts,vue}',
        '*.{js,ts,mts}',
        '!.claude/**',
        '!worktrees/**',
        '!src/__ecs_matrix__/**'
      ],
      ignore: ['scripts/registry-census/detection-proof/**']
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
    },
    'tools/test-recorder': {
      project: ['src/**/*.ts']
    }
  },
  ignoreBinaries: [
    // Optional host tool the recorder probes for and degrades without
    'xcode-select'
  ],
  ignoreDependencies: [
    // Weird importmap things
    '@iconify/json'
  ],
  ignore: [
    // Auto generated API types
    'src/workbench/extensions/manager/types/generatedManagerTypes.ts',
    'packages/ingest-types/src/zod.gen.ts',
    // Pending integration in stacked PR
    'src/components/sidebar/tabs/nodeLibrary/CustomNodesPanel.vue',
    // Marketing media tooling — adopted by pages in a follow-up PR
    'apps/website/src/components/common/SiteVideo.vue',
    'apps/website/src/utils/marketingImage.ts',
    // Animated pill button — retained for reuse after the learning directory
    // switched to ButtonPill; no current consumer
    'apps/website/src/components/ui/button-mask/**',
    // Pending integration: consumed by the useWorkspaceInvoices seam once
    // #13591 (Plan & Credits tabs) lands — FE-1245
    'src/composables/billing/useNextInvoice.ts',
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
    'src/extension-api/brand.ts',
    // Strangler-pattern v2 conversions of core extensions. Not yet wired
    // into the bootstrap (registration lands in a follow-up PR alongside
    // the v1→v2 cut-over). Tracked by I-EXT (#12144).
    'src/extensions/core/noteNode.v2.ts',
    'src/extensions/core/rerouteNode.v2.ts',
    'src/extensions/core/slotDefaults.v2.ts',
    // W6.P3.D — defineWidget+mount showcase port (D-widget-converge / A12).
    'src/extensions/core/webcamCapture.v2.ts',
    // W6.P4.D — canvas-units canary + escape-hatch annotation example
    // (D-coord-space / A13).
    'src/extensions/core/coordSpaceDemo.v2.ts'
  ],
  vite: {
    config: ['vite?(.*).config.mts']
  },
  vitest: {
    config: ['vitest?(.*).config.ts'],
    entry: [
      '**/*.{bench,test,test-d,spec}.?(c|m)[jt]s?(x)',
      '**/__mocks__/**/*.{js,ts,vue}'
    ]
  },
  playwright: {
    config: ['playwright?(.*).config.ts'],
    entry: ['browser_tests/**/*.@(spec|test).?(c|m)[jt]s?(x)']
  },
  tags: [
    '-knipIgnoreUnusedButUsedByCustomNodes',
    '-knipIgnoreUnusedButUsedByVueNodesBranch',
    '-knipIgnoreUsedByStackedPR'
  ]
}

export default config
