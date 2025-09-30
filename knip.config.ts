import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: [
        '{build,scripts}/**/*.{js,ts}',
        'src/assets/css/style.css',
        'src/main.ts',
        'src/scripts/ui/menu/index.ts',
        'src/types/index.ts'
      ],
      project: ['**/*.{js,ts,vue}', '*.{js,ts,mts}']
    },
    'packages/tailwind-utils': {
      project: ['src/**/*.{js,ts}']
    },
    'packages/design-system': {
      entry: ['src/**/*.ts'],
      project: ['src/**/*.{js,ts}', '*.{js,ts,mts}']
    },
    'packages/registry-types': {
      entry: ['src/comfyRegistryTypes.ts'],
      project: ['src/**/*.{js,ts}']
    }
  },
  ignoreBinaries: ['python3'],
  ignoreDependencies: [
    // Weird importmap things
    '@iconify/json',
    '@primeuix/forms',
    '@primeuix/styled',
    '@primeuix/utils',
    '@primevue/icons',
    // Dev
    '@trivago/prettier-plugin-sort-imports'
  ],
  ignore: [
    // Auto generated manager types
    'src/workbench/extensions/manager/types/generatedManagerTypes.ts',
    'packages/registry-types/src/comfyRegistryTypes.ts',
    // Used by a custom node (that should move off of this)
    'src/scripts/ui/components/splitButton.ts'
  ],
  compilers: {
    // https://github.com/webpro-nl/knip/issues/1008#issuecomment-3207756199
    css: (text: string) =>
      [
        ...text.replaceAll('plugin', 'import').matchAll(/(?<=@)import[^;]+/g)
      ].join('\n')
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
    '-knipIgnoreUnusedButUsedByVueNodesBranch'
  ]
}

export default config
