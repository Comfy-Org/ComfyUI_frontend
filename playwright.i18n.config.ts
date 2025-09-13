import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const config: any = defineConfig({
  testDir: './scripts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true
  },
  reporter: 'list',
  timeout: 60000,
  workers: 1, // Run tests serially to avoid duplicate user creation
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
    [path.join(__dirname, 'babel-plugin-stub-vue-imports.cjs')],
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
