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
    'coverage/**'
  ],
  ignoreExportsUsedInFile: true,
  // Vue-specific configuration
  vue: true,
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
