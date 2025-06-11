import { FullConfig } from '@playwright/test'
import dotenv from 'dotenv'

import { PerformanceMonitor } from './helpers/performanceMonitor'
import { restorePath } from './utils/backupUtils'

dotenv.config()

export default async function globalTeardown(config: FullConfig) {
  console.log('🧹 Global teardown starting...')

  // Always try to save performance metrics (handles temp files from workers)
  try {
    const filePath = await PerformanceMonitor.saveMetricsToFile()
    console.log(`✅ Performance metrics saved successfully to: ${filePath}`)
  } catch (error) {
    console.error(
      '❌ Failed to save performance metrics in global teardown:',
      error
    )
  }

  // Existing teardown logic
  if (!process.env.CI && process.env.TEST_COMFYUI_DIR) {
    restorePath([process.env.TEST_COMFYUI_DIR, 'user'])
    restorePath([process.env.TEST_COMFYUI_DIR, 'models'])
  }

  console.log('🧹 Global teardown completed')
}
