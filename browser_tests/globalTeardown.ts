import { config as dotenvConfig } from 'dotenv'

import { writePerfReport } from './helpers/perfReporter'
import { restorePath } from './utils/backupUtils'

dotenvConfig()

export default function globalTeardown() {
  writePerfReport()

  if (!process.env.CI && process.env.TEST_COMFYUI_DIR) {
    restorePath([process.env.TEST_COMFYUI_DIR, 'user'])
    restorePath([process.env.TEST_COMFYUI_DIR, 'models'])
  }
}
