import { FullConfig } from '@playwright/test'
import { backupPath } from './utils/backupUtils'
import dotenv from 'dotenv'

dotenv.config()

export default function globalSetup(config: FullConfig) {
  if (!process.env.CI) {
    if (process.env.DEPLOY_COMFYUI_DIR) {
      backupPath([process.env.DEPLOY_COMFYUI_DIR, '..', 'user'])
      backupPath([process.env.DEPLOY_COMFYUI_DIR, '..', 'models'], {
        renameAndReplaceWithScaffolding: true
      })
    } else {
      console.warn(
        'Set DEPLOY_COMFYUI_DIR in .env to prevent user data (settings, workflows, etc.) from being overwritten'
      )
    }
  }
}
