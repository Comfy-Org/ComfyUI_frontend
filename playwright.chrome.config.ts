import { defineConfig } from '@playwright/test'

import base from './playwright.config'

// Run against the system-installed Google Chrome (no bundled-chromium download).
// trace stays off: Playwright's trace recorder crashes pages under the branded
// Chrome channel on this machine (instant browser close, reported as timeout).
export default defineConfig(base, {
  use: { channel: 'chrome', video: 'off', trace: 'off' }
})
