import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: [
        '{build,scripts}/**/*.{js,ts}',
        'src/assets/css/style.css',
        'src/main.ts',
        'src/scripts/ui/menu/index.ts',
        'src/types/index.ts',
        'src/storybook/mocks/**/*.ts'
      ],
      project: ['**/*.{js,ts,vue}', '*.{js,ts,mts}', '!.claude/**']
    },
    'apps/desktop-ui': {
      entry: ['src/main.ts', 'src/i18n.ts'],
      project: ['src/**/*.{js,ts,vue}']
    },
    'packages/tailwind-utils': {
      project: ['src/**/*.{js,ts}']
    },
    'packages/shared-frontend-utils': {
      project: ['src/**/*.{js,ts}'],
      entry: ['src/formatUtil.ts', 'src/networkUtil.ts']
    },
    'packages/registry-types': {
      project: ['src/**/*.{js,ts}']
    },
    'packages/ingest-types': {
      project: ['src/**/*.{js,ts}'],
      entry: ['src/index.ts']
    }
  },
  ignoreBinaries: ['python3', 'gh'],
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
    'packages/registry-types/src/comfyRegistryTypes.ts',
    'packages/ingest-types/src/types.gen.ts',
    'packages/ingest-types/src/zod.gen.ts',
    'packages/ingest-types/openapi-ts.config.ts',
    // Used by a custom node (that should move off of this)
    'src/scripts/ui/components/splitButton.ts',
    // Used by stacked PR (feat/glsl-live-preview)
    'src/renderer/glsl/useGLSLRenderer.ts',
    // Workflow files contain license names that knip misinterprets as binaries
    '.github/workflows/ci-oss-assets-validation.yaml',
    // Pending integration in stacked PR
    'src/components/sidebar/tabs/nodeLibrary/CustomNodesPanel.vue',
    // Agent review check config, not part of the build
    '.agents/checks/eslint.strict.config.js',
    // Loaded via @plugin directive in CSS, not detected by knip
    'packages/design-system/src/css/lucideStrokePlugin.js'
  ],
  compilers: {
    // https://github.com/webpro-nl/knip/issues/1008#issuecomment-3207756199
    css: (text: string) =>
      [...text.replaceAll('plugin', 'import').matchAll(/(?<=@)import[^;]+/g)]
        .map((match) => match[0].replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1'))
        .join('\n')
  },
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
