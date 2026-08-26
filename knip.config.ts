import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  treatConfigHintsAsErrors: true,
  treatTagHintsAsErrors: true,
  workspaces: {
    '.': {
      entry: [
        '{build,scripts}/**/*.{js,mjs,ts}',
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
    // Served to custom nodes at runtime as /comfy/api/v2.js. Nothing in the
    // build imports it — that is the point; it is the published entry point
    // packs import from, so knip cannot see a consumer.
    'public/comfy/api/v2.js',
    // Mount point for the separately-licensed secure-nodes overlay: a tracked
    // symlink a developer points at their overlay checkout. Its files are
    // loaded by runtime URL from secureNodesBootstrap, never imported by the
    // build, and the link dangles on checkouts without the overlay.
    'public/secure-nodes/**',
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
    // The extension API contract, taken verbatim from PR #11251 so the two
    // efforts converge on one shape. It is the reference our handles conform
    // to, not a module anything imports yet.
    'src/types/extensionV2.ts',
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
