/**
 * Combined global setup for i18n collection tests
 * Includes both regular setup and litegraph preprocessing
 */
import globalSetup from './globalSetup'
import { preprocessLitegraph } from './i18nSetup'

export default async function globalSetupWithI18n() {
  // First preprocess litegraph files
  await preprocessLitegraph()
  
  // Then run regular global setup
  await globalSetup()
  
  // Register cleanup handlers
  const cleanup = async () => {
    const { restoreLitegraph } = await import('./i18nSetup')
    await restoreLitegraph()
  }
  
  process.on('exit', cleanup)
  process.on('SIGINT', async () => {
    await cleanup()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    await cleanup()
    process.exit(0)
  })
}