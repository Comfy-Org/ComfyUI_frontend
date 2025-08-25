import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: [
    'src/main.ts',
    'vite.config.mts',
    'vite.electron.config.mts',
    'vite.types.config.mts',
    'eslint.config.js',
    'tailwind.config.js',
    'postcss.config.js',
    'playwright.config.ts',
    'playwright.i18n.config.ts',
    'vitest.config.ts',
    'scripts/**/*.{js,ts}'
  ],
  project: [
    'src/**/*.{js,ts,vue}',
    'tests-ui/**/*.{js,ts,vue}',
    'browser_tests/**/*.{js,ts}',
    'scripts/**/*.{js,ts}'
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
  // Only check for unused files, disable all other rules
  // TODO: Gradually enable other rules - see https://github.com/Comfy-Org/ComfyUI_frontend/issues/4888
  rules: {
    binaries: 'off',
    classMembers: 'off',
    dependencies: 'off',
    devDependencies: 'off',
    duplicates: 'off',
    enumMembers: 'off',
    exports: 'off',
    nsExports: 'off',
    nsTypes: 'off',
    types: 'off',
    unlisted: 'off'
  },
  // Include dependencies analysis
  includeEntryExports: true,
  // Workspace configuration for monorepo-like structure
  workspaces: {
    '.': {
      entry: ['src/main.ts']
    }
  }
}

export default config
