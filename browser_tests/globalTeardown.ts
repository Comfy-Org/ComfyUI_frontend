import { FullConfig } from '@playwright/test'
import dotenv from 'dotenv'

import { restorePath } from './utils/backupUtils'

dotenv.config()

export default function globalTeardown(config: FullConfig) {
  if (!process.env.CI && process.env.TEST_COMFYUI_DIR) {
    restorePath([process.env.TEST_COMFYUI_DIR, 'user'])
    restorePath([process.env.TEST_COMFYUI_DIR, 'models'])
  }
}
