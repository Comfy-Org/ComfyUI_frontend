import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: [
    'build/**/*.ts',
    'scripts/**/*.{js,ts}',
    'src/main.ts',
    'vite.electron.config.mts',
    'vite.types.config.mts'
  ],
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
    '@executeautomation/playwright-mcp-server',
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
    // Vite config files
    'vite.electron.config.mts',
    'vite.types.config.mts',
    // Auto generated manager types
    'src/types/generatedManagerTypes.ts',
    // Design system components (may not be used immediately)
    'src/components/button/IconGroup.vue',
    'src/components/button/MoreButton.vue',
    'src/components/button/TextButton.vue',
    'src/components/card/CardTitle.vue',
    'src/components/card/CardDescription.vue',
    'src/components/input/SingleSelect.vue'
  ],
  ignoreExportsUsedInFile: true,
  // Vue-specific configuration
  vue: true,
  tailwind: true,
  // Only check for unused files, disable all other rules
  // TODO: Gradually enable other rules - see https://github.com/Comfy-Org/ComfyUI_frontend/issues/4888
  rules: {
    // binaries: 'off',
    classMembers: 'off',
    duplicates: 'off',
    enumMembers: 'off',
    exports: 'off',
    nsExports: 'off',
    nsTypes: 'off',
    types: 'off'
  },
  // Include dependencies analysis
  includeEntryExports: true
}

export default config
