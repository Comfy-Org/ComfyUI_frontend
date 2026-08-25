import { defineConfig } from '@playwright/test'

import base from './playwright.config'

// Local runs against the system-installed Google Chrome (no bundled-chromium
// download). trace is kept on failure so a failed local run leaves a viewable
// Playwright trace (the primary reason to reach for this config); video stays
// off since the trace already carries screenshots + DOM snapshots and video is
// the heavier artifact.
export default defineConfig(base, {
  use: { channel: 'chrome', video: 'off', trace: 'retain-on-failure' }
})
