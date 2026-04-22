import { config as dotenvConfig } from 'dotenv'
import MCR from 'monocart-coverage-reports'

import { writePerfReport } from '@e2e/helpers/perfReporter'
import { restorePath } from '@e2e/utils/backupUtils'

dotenvConfig()

export default async function globalTeardown() {
  writePerfReport()

  if (!process.env.CI && process.env.TEST_COMFYUI_DIR) {
    restorePath([process.env.TEST_COMFYUI_DIR, 'user'])
    restorePath([process.env.TEST_COMFYUI_DIR, 'models'])
  }

  if (process.env.COLLECT_COVERAGE === 'true') {
    const mcr = MCR({
      outputDir: './coverage/playwright',
      reports: [['lcovonly', { file: 'coverage.lcov' }], ['text-summary']],
      sourceFilter: {
        '**/node_modules/**': false,
        '**/browser_tests/**': false,
        '**/*': true
      }
    })
    await mcr.generate()
  }
}
