import { chromium } from '@playwright/test'
import type { FullConfig } from '@playwright/test'
import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config()

/**
 * Global setup for cloud tests.
 * Authenticates with Firebase and saves auth state for test reuse.
 */
export default async function globalSetupCloud(config: FullConfig) {
  const CLOUD_TEST_EMAIL = process.env.CLOUD_TEST_EMAIL
  const CLOUD_TEST_PASSWORD = process.env.CLOUD_TEST_PASSWORD

  if (!CLOUD_TEST_EMAIL || !CLOUD_TEST_PASSWORD) {
    throw new Error(
      'CLOUD_TEST_EMAIL and CLOUD_TEST_PASSWORD must be set in environment variables'
    )
  }

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to cloud login page
    await page.goto('https://stagingcloud.comfy.org/cloud/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    // Fill in email and password
    await page.fill('#cloud-sign-in-email', CLOUD_TEST_EMAIL)
    await page.fill('#cloud-sign-in-password', CLOUD_TEST_PASSWORD)

    // Click login button
    await page.click('button[type="submit"]')

    // Wait for redirect to main app
    await page.waitForURL('**/cloud', { timeout: 30000 })

    // Wait a bit for auth tokens to be written to localStorage
    await page.waitForTimeout(2000)

    // Ensure .auth directory exists
    const authDir = path.join(__dirname, '.auth')
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true })
    }

    // Save authentication state (includes localStorage with Firebase tokens)
    await context.storageState({
      path: 'browser_tests/.auth/cloudUser.json'
    })
  } catch (error) {
    console.error('❌ Failed to authenticate:', error)
    throw error
  } finally {
    await browser.close()
  }
}
