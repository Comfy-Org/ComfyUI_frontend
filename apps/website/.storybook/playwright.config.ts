import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '../e2e/storybook',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/storybook', open: 'never' }]
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
    command:
      'python3 -m http.server 6098 --bind 127.0.0.1 --directory dist/storybook',
    port: 6098,
    reuseExistingServer: !process.env.CI
  }
})
