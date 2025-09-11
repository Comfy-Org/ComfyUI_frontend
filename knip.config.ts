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
    '@trivago/prettier-plugin-sort-imports'
  ],
  ignore: [
    // Generated files
    'dist/**',
    'types/**',
    'node_modules/**',
    // Config files that might not show direct usage
    '.husky/**',
    // Temporary or cache files
    '.vite/**',
    'coverage/**',
    // i18n config
    '.i18nrc.cjs',
    // Vitest litegraph config
    'vitest.litegraph.config.ts',
    // Test setup files
    'browser_tests/globalSetup.ts',
    'browser_tests/globalTeardown.ts',
    'browser_tests/globalSetupWithI18n.ts',
    'browser_tests/globalTeardownWithI18n.ts',
    'browser_tests/i18nSetup.ts',
    'browser_tests/utils/**',
    // Scripts
    'scripts/**',
    // Vite config files
    'vite.electron.config.mts',
    'vite.types.config.mts',
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
