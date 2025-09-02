import { test as base } from '@playwright/test'
import { ComfyPage } from './ComfyPage'

/**
 * Simplified fixture for i18n collection that doesn't require user setup
 */
export const comfyPageNoUserFixture = base.extend<{
  comfyPage: ComfyPage
}>({
  comfyPage: async ({ page, request }, use) => {
    const comfyPage = new ComfyPage(page, request)
    
    // Navigate directly to the app without user setup
    await comfyPage.goto()
    
    // Wait for the app to be fully initialized
    await page.waitForFunction(
      () => window['app']?.extensionManager !== undefined,
      { timeout: 30000 }
    )
    
    // Use the page
    await use(comfyPage)
  }
})

export const test = comfyPageNoUserFixture