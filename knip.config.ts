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
    'packages/design-system': {
      project: ['src/**/*.{css,js,ts}']
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
    'src/workbench/extensions/manager/types/generatedManagerTypes.ts',
    'packages/ingest-types/src/zod.gen.ts',
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
