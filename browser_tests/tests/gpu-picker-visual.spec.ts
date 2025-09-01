import { test, expect } from '@playwright/test'

test.describe('GPU Picker Visual Tests', () => {
  test('hardware option selection border', async ({ page }) => {
    // Navigate to install view
    await page.goto('http://localhost:5173/#/install')
    
    // Wait for the GPU picker to be visible
    await page.waitForSelector('.hardware-option-wrapper')
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'gpu-picker-initial.png',
      fullPage: false,
      clip: { x: 0, y: 100, width: 800, height: 400 }
    })
    
    // Click Apple Metal option
    await page.click('.hardware-option-wrapper:first-child button')
    
    // Take screenshot with selection
    await page.screenshot({ 
      path: 'gpu-picker-selected.png',
      fullPage: false,
      clip: { x: 0, y: 100, width: 800, height: 400 }
    })
    
    // Visual regression test (if baseline exists)
    await expect(page).toHaveScreenshot('gpu-picker-selected.png')
  })
})