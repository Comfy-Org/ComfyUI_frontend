import { dirname } from 'node:path'

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '../e2e/storybook',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../playwright-report/storybook', open: 'never' }]
  ],
  outputDir: '../test-results/storybook',
  use: {
    baseURL: 'http://127.0.0.1:6098',
    reducedMotion: 'reduce',
    colorScheme: 'dark',
    trace: 'retain-on-failure'
  },
  projects: ['chromium', 'webkit'].flatMap((browserName) =>
    [
      { name: 'desktop', width: 1440, height: 1000 },
      { name: 'mobile', width: 390, height: 844 }
    ].map(({ name, width, height }) => ({
      name: `${browserName}-${name}`,
      use: {
        browserName: browserName === 'chromium' ? 'chromium' : 'webkit',
        viewport: { width, height }
      }
    }))
  ),
  webServer: {
    cwd: dirname(import.meta.dirname),
    command:
      'pnpm exec vite preview --outDir dist/storybook --port 6098 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:6098/iframe.html',
    reuseExistingServer: false
  }
})
