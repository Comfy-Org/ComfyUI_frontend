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
        'tools/oxlint-plugins/serverFacts.ts',
        'tools/oxlint-plugins/vitestCleanup.ts'
      ],
      project: [
        '**/*.{js,ts}',
        'src/**/*.vue!',
        '*.{js,ts,mts}',
        '!.claude/**',
        '!worktrees/**',
        '!src/__ecs_matrix__/**'
      ],
      ignore: ['scripts/registry-census/detection-proof/**']
    },
    'packages/account-core': {
      project: ['src/**/*.{js,ts}']
    },
    'packages/account-ui': {
      project: ['src/**/*.{js,ts,vue}']
    },
    'packages/billing-contract': {
      project: ['src/**/*.ts']
    },
    'packages/api-client': {
      project: ['src/**/*.ts']
    },
    'packages/graph-model': {
      project: ['src/**/*.ts']
    },
    'packages/keybindings': {
      project: ['src/**/*.ts']
    },
    'packages/settings-core': {
      project: ['src/**/*.ts']
    },
    'packages/design-system': {
      entry: ['tests/consumer/vite.config.ts'],
      project: ['src/**/*.{css,js,ts,vue}'],
      ignoreDependencies: ['tailwind-merge']
    },
    'packages/tailwind-utils': {
      project: ['src/**/*.{js,ts}']
    },
    'packages/test-utils': {
      project: ['src/**/*.ts']
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
    'packages/comfyui-api-types': {
      project: ['src/**/*.ts']
    },
    'tools/architecture': {
      project: ['src/**/*.ts']
    },
    'tools/design-system-audits': {
      project: ['src/**/*.ts']
    },
    'tools/expected-failures': {
      project: ['src/**/*.ts']
    },
    'tools/test-recorder': {
      project: ['src/**/*.ts']
    },
    'tools/types-consumer-check': {
      project: ['src/**/*.ts']
    }
  },
  ignoreBinaries: [
    // Optional host tool the recorder probes for and degrades without
    'xcode-select'
  ],
  ignore: [
    // Auto generated API types
    'packages/ingest-types/src/zod.gen.ts',
    // Auto generated from core's pinned OpenAPI spec. The operation filter
    // admits one endpoint, and openapi-ts still emits the request/response
    // wrappers and a barrel for it; src/index.ts re-exports what is consumed.
    'packages/comfyui-api-types/src/generated/**',
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
  tags: ['-knipIgnoreUnusedButUsedByCustomNodes', '-knipIgnoreUsedByStackedPR']
}

export default config
