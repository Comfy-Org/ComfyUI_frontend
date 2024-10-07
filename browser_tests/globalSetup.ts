import { FullConfig } from '@playwright/test'
import { backupPath } from './utils/backupUtils'
import dotenv from 'dotenv'

dotenv.config()

export default function globalSetup(config: FullConfig) {
  if (!process.env.CI && process.env.DEPLOY_COMFYUI_DIR) {
    backupPath([process.env.DEPLOY_COMFYUI_DIR, '..', 'user'])
  }
}
