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
    'packages/account-core': {
      project: ['src/**/*.{js,ts}']
    },
    'packages/account-ui': {
      project: ['src/**/*.{js,ts,vue}']
    },
    'packages/billing-contract': {
      project: ['src/**/*.ts']
    },
    'packages/comfy-multi-player': {
      entry: ['scripts/*.mjs', 'examples/**/*.mjs', 'test/types/*.negative.ts'],
      project: [
        'src/**/*.ts',
        'test/**/*.ts',
        'scripts/*.mjs',
        'bench/**/*.ts'
      ],
      ignoreDependencies: ['dependency-cruiser'],
      ignoreIssues: { 'src/limits.ts': ['duplicates'] }
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
    'apps/website': {
      // Models pages are registered by the release-gate integration.
      entry: ['src/scripts/**/*.ts', 'src/routes/models/*.{astro,ts}'],
      // Executed by models-snippets.test.ts inside the generated Node examples.
      ignoreDependencies: ['mime-types']
    },
    'tools/architecture': {
      project: ['src/**/*.ts']
    },
    'tools/test-recorder': {
      project: ['src/**/*.ts']
    }
  },
  ignoreBinaries: [
    'ffmpeg',
    // Optional host tool the recorder probes for and degrades without
    'xcode-select'
  ],
  ignore: [
    // Auto generated API types
    'src/workbench/extensions/manager/types/generatedManagerTypes.ts',
    'packages/ingest-types/src/zod.gen.ts',
    // Config for a CLI invoked by file path, not import; generated output
    // includes operation types unused until this fronts a real API client
    'apps/website/openapi-ts.rate-card.config.ts',
    'apps/website/src/types/rate-card/index.ts',
    'apps/website/src/types/rate-card/types.gen.ts',
    'apps/website/src/types/rate-card/zod.gen.ts',
    // Marketing media tooling — adopted by pages in a follow-up PR
    'apps/website/src/components/common/SiteVideo.vue',
    // Animated pill button — retained for reuse after the learning directory
    // switched to ButtonPill; no current consumer
    'apps/website/src/components/ui/button-mask/**',
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
