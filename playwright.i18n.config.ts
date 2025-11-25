import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const config = defineConfig({
  testDir: './scripts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true
  },
  reporter: 'list',
  workers: 1,
  timeout: 60000,
  testMatch: /collect-i18n-.*\.ts/,
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000
  }
})

// Add Babel plugins for handling TypeScript and Vite defines

;(config as any)['@playwright/test'] = {
  babelPlugins: [
    // Module resolver for @ alias
    [
      'babel-plugin-module-resolver',
      {
        root: ['./'],
        alias: { '@': './src' }
      }
    ],

    // TypeScript transformation with declare fields support
    [
      '@babel/plugin-transform-typescript',
      {
        allowDeclareFields: true,
        onlyRemoveTypeImports: true
      }
    ],

    // Custom plugin to replace Vite define constants
    [path.join(__dirname, 'scripts/babel-plugin-vite-define.cjs')],

    // Inject browser globals setup for i18n collection tests
    [
      path.join(__dirname, 'scripts/babel-plugin-inject-globals.cjs'),
      {
        filenamePattern: 'collect-i18n-',
        setupFile: './setup-i18n-globals.mjs'
      }
    ]
  ]
}

export default config
