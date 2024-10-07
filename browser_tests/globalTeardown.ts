import { FullConfig } from '@playwright/test'
import { restorePath } from './utils/backupUtils'
import dotenv from 'dotenv'

dotenv.config()

export default function globalTeardown(config: FullConfig) {
  if (!process.env.CI && process.env.DEPLOY_COMFYUI_DIR) {
    restorePath([process.env.DEPLOY_COMFYUI_DIR, '..', 'user'])
    restorePath([process.env.DEPLOY_COMFYUI_DIR, '..', 'models'])
  }
}
