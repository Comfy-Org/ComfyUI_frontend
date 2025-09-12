import { defineConfig } from '@playwright/test'

const config: any = defineConfig({
  testDir: './scripts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true
  },
  reporter: 'list',
  timeout: 60000,
  testMatch: /collect-i18n-.*\.ts/,
  // Start dev server before running tests
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60000
  }
})

// Configure babel plugins for TypeScript with declare fields and module resolution
config['@playwright/test'] = {
  babelPlugins: [
    // Stub Vue and CSS imports first to prevent parsing errors
    ['babel-plugin-stub-vue-imports'],
    // Module resolver to handle @ alias
    [
      'babel-plugin-module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './src'
        }
      }
    ],
    // Then TypeScript transformation with declare field support
    [
      '@babel/plugin-transform-typescript',
      {
        allowDeclareFields: true,
        onlyRemoveTypeImports: true
      }
    ]
  ]
}

export default config
