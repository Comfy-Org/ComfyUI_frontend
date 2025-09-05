import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: ['build/**/*.ts', 'scripts/**/*.{js,ts}', 'src/main.ts'],
  project: [
    'browser_tests/**/*.{js,ts}',
    'build/**/*.{js,ts,vue}',
    'scripts/**/*.{js,ts}',
    'src/**/*.{js,ts,vue}',
    'tests-ui/**/*.{js,ts,vue}',
    '*.{js,ts,mts}'
  ],
  ignoreBinaries: ['only-allow', 'openapi-typescript'],
  ignoreDependencies: [
    '@primeuix/forms',
    '@primeuix/styled',
    '@primeuix/utils',
    '@primevue/icons',
    '@iconify/json',
    'tailwindcss',
    'tailwindcss-primeui', // Need to figure out why tailwind plugin isn't applying
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
    'browser_tests/utils/**',
    // Scripts
    'scripts/**',
    // Auto generated manager types
    'src/types/generatedManagerTypes.ts',
    // Used by a custom node (that should move off of this)
    'src/scripts/ui/components/splitButton.ts',
    // Generated file: openapi
    'src/types/comfyRegistryTypes.ts'
  ],
  // Vue-specific configuration
  vue: true,
  tailwind: true,
  vite: {
    config: [
      'vite.config.{js,mjs,ts,cjs,mts,cts}',
      'vite.*.config.{js,mjs,ts,cjs,mts,cts}'
    ]
  },
  // TODO: Gradually enable other rules - see https://github.com/Comfy-Org/ComfyUI_frontend/issues/4888
  rules: {
    classMembers: 'off'
  },
  tags: [
    '-knipIgnoreUnusedButUsedByCustomNodes',
    '-knipIgnoreUnusedButUsedByVueNodesBranch'
  ],
  // Include dependencies analysis
  includeEntryExports: true
}

export default config
