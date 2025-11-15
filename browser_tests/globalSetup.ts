import type { FullConfig } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

import { backupPath } from './utils/backupUtils'
import { syncDevtools } from './utils/devtoolsSync'

loadEnv()

export default function globalSetup(_: FullConfig) {
  if (!process.env.CI) {
    if (process.env.TEST_COMFYUI_DIR) {
      backupPath([process.env.TEST_COMFYUI_DIR, 'user'])
      backupPath([process.env.TEST_COMFYUI_DIR, 'models'], {
        renameAndReplaceWithScaffolding: true
      })

      syncDevtools(process.env.TEST_COMFYUI_DIR)
    } else {
      console.warn(
        'Set TEST_COMFYUI_DIR in .env to prevent user data (settings, workflows, etc.) from being overwritten'
      )
    }
  }
}
