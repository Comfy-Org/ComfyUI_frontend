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
        'src/storybook/mocks/**/*.ts'
      ],
      project: ['**/*.{js,ts,vue}', '*.{js,ts,mts}', '!.claude/**']
    },
    'apps/desktop-ui': {
      entry: ['src/i18n.ts'],
      project: ['src/**/*.{js,ts,vue}']
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
      entry: [
        'src/pages/**/*.astro',
        'src/layouts/**/*.astro',
        'src/components/**/*.vue',
        'src/styles/global.css'
      ],
      project: ['src/**/*.{astro,vue,ts}', '*.{js,ts,mjs}']
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
    '@primevue/icons',
    // QA pipeline deps — installed inline in CI workflow
    '@anthropic-ai/claude-agent-sdk',
    '@google/generative-ai',
    'demowright'
  ],
  ignore: [
    // Auto generated API types
    'src/workbench/extensions/manager/types/generatedManagerTypes.ts',
    'packages/ingest-types/src/zod.gen.ts',
    // Workflow files contain license names that knip misinterprets as binaries
    '.github/workflows/ci-oss-assets-validation.yaml',
    // Pending integration in stacked PR
    'src/components/sidebar/tabs/nodeLibrary/CustomNodesPanel.vue',
    // Agent review check config, not part of the build
    '.agents/checks/eslint.strict.config.js'
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
    '-knipIgnoreUsedByStackedPR'
  ]
}

export default config
