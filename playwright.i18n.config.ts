import { defineConfig } from '@playwright/experimental-ct-vue'
import viteConfig from './vite.config.mjs'

export default defineConfig({
  testDir: './scripts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    /** @see https://playwright.dev/docs/ct-vite#using-existing-vite-config */
    ctViteConfig: {
      plugins: viteConfig.plugins,
      resolve: viteConfig.resolve,
      define: viteConfig.define,
      optimizeDeps: viteConfig.optimizeDeps,
      esbuild: viteConfig.esbuild,
      server: viteConfig.server
    } as any // There are conflicting Vite versions (5.4.19 and 6.4.1) being used, so we cast to any to avoid type issues
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
