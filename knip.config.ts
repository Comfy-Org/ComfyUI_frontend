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
    // TRANSITIONAL (agent-v1 chain): dev-only debug panel with no mount site
    // until slices 07+ import the crdt tree; removable then. See docs/adr/0024.
    'src/workbench/extensions/agent/crdt/CrdtDevPanel.vue',
    // TRANSITIONAL (agent-v1 chain): control-plane part/client/schema types
    // consumed by the session (08/09), renderer (10/11), and panel (14)
    // slices; slice 17's chain-closing sweep removes these entries.
    'src/workbench/extensions/agent/services/agent/agentMessageParts.ts',
    'src/workbench/extensions/agent/services/agent/agentRestClient.ts',
    'src/workbench/extensions/agent/schemas/agentApiSchema.ts',
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
    // Animated pill button — retained for reuse after the learning directory
    // switched to ButtonPill; no current consumer
    'apps/website/src/components/ui/button-mask/**',
    // Pending integration: consumed by the useWorkspaceInvoices seam once
    // #13591 (Plan & Credits tabs) lands — FE-1245
    'src/composables/billing/useNextInvoice.ts',
    // Agent review check config, not part of the build
    '.agents/checks/eslint.strict.config.js',
    // Devtools extensions, included dynamically
    'tools/devtools/web/**'
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
