import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: [
    'src/main.ts',
    'src/electron-main.ts',
    'src/types.ts',
    'vite.config.mts',
    'vite.electron.config.mts',
    'vite.types.config.mts',
    'eslint.config.js',
    'tailwind.config.js',
    'postcss.config.js',
    'playwright.config.ts',
    'playwright.i18n.config.ts',
    'vitest.config.ts',
    'scripts/**/*.{js,ts}',
    'tests-ui/**/*.test.ts',
    'browser_tests/**/*.spec.ts',
    'src/components/**/*.test.ts',
    'src/composables/**/*.test.ts'
  ],
  project: [
    'src/**/*.{js,ts,vue}',
    'tests-ui/**/*.{js,ts,vue}',
    'browser_tests/**/*.{js,ts}',
    'scripts/**/*.{js,ts}'
  ],
  ignoreDependencies: [
    // Build and development tools that don't have explicit imports
    'husky',
    'lint-staged',
    'chalk', // Used in scripts
    'fs-extra', // Used in scripts
    'zip-dir', // Used in scripts
    'tsx', // TypeScript execution
    'happy-dom', // Test environment
    'identity-obj-proxy', // Test mock utility
    '@executeautomation/playwright-mcp-server' // Playwright MCP integration
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
      entry: ['src/main.ts', 'src/electron-main.ts', 'src/types.ts']
    }
  }
}

export default config
