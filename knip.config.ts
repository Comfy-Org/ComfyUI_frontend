import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: [
    '{build,scripts}/**/*.{js,ts}',
    'src/assets/css/style.css',
    'src/main.ts',
    'src/scripts/ui/menu/index.ts',
    'src/types/index.ts'
  ],
  project: ['**/*.{js,ts,vue}', '*.{js,ts,mts}'],
  ignoreBinaries: ['only-allow', 'openapi-typescript'],
  ignoreDependencies: [
    // Weird importmap things
    '@iconify/json',
    '@primeuix/forms',
    '@primeuix/styled',
    '@primeuix/utils',
    '@primevue/icons',
    // Dev
    '@trivago/prettier-plugin-sort-imports',
    'tailwindcss',
    'tailwindcss-primeui'
  ],
  ignore: [
    // Auto generated manager types
    'src/types/generatedManagerTypes.ts',
    'src/types/comfyRegistryTypes.ts',
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
