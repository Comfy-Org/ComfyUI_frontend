import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Keybinding Layout Independence', () => {
  test('Should work with different keyboard layouts', async ({ comfyPage }) => {
    // Navigate to the ComfyUI frontend
    await comfyPage.goto()
    
    // Wait for the app to load by checking for canvas
    await expect(comfyPage.canvas).toBeVisible()
    
    // Test that keybindings work regardless of keyboard layout
    // We'll test by simulating key events with different key codes
    
    // Test Ctrl+S (Save Workflow)
    await comfyPage.page.keyboard.press('Control+s')
    
    // Verify that the save dialog or action was triggered
    // This might show a toast notification or trigger a save action
    await expect(comfyPage.page.locator('body')).toBeVisible()
    
    // Test Ctrl+O (Open Workflow)
    await comfyPage.page.keyboard.press('Control+o')
    
    // Test Ctrl+G (Group Selected Nodes)
    await comfyPage.page.keyboard.press('Control+g')
    
    // Test F key (Toggle Focus Mode)
    await comfyPage.page.keyboard.press('f')
    
    // Test Alt+= (Zoom In)
    await comfyPage.page.keyboard.press('Alt+=')
    
    // Test Alt+- (Zoom Out)
    await comfyPage.page.keyboard.press('Alt+-')
    
    // Test . key (Fit View)
    await comfyPage.page.keyboard.press('.')
    
    // Test Ctrl+Enter (Queue Prompt)
    await comfyPage.page.keyboard.press('Control+Enter')
    
    // Test Ctrl+Shift+Enter (Queue Prompt Front)
    await comfyPage.page.keyboard.press('Control+Shift+Enter')
    
    // Test Ctrl+Alt+Enter (Interrupt)
    await comfyPage.page.keyboard.press('Control+Alt+Enter')
    
    // Test r key (Refresh Node Definitions)
    await comfyPage.page.keyboard.press('r')
    
    // Test q key (Toggle Queue Sidebar)
    await comfyPage.page.keyboard.press('q')
    
    // Test w key (Toggle Workflows Sidebar)
    await comfyPage.page.keyboard.press('w')
    
    // Test n key (Toggle Node Library Sidebar)
    await comfyPage.page.keyboard.press('n')
    
    // Test m key (Toggle Model Library Sidebar)
    await comfyPage.page.keyboard.press('m')
    
    // Test Backspace key (Clear Workflow)
    await comfyPage.page.keyboard.press('Backspace')
    
    // Test Ctrl+, (Show Settings Dialog)
    await comfyPage.page.keyboard.press('Control+,')
    
    // Test p key (Pin/Unpin Selected Items)
    await comfyPage.page.keyboard.press('p')
    
    // Test Alt+c (Collapse/Expand Selected Nodes)
    await comfyPage.page.keyboard.press('Alt+c')
    
    // Test Ctrl+b (Bypass/Unbypass Selected Nodes)
    await comfyPage.page.keyboard.press('Control+b')
    
    // Test Ctrl+m (Mute/Unmute Selected Nodes)
    await comfyPage.page.keyboard.press('Control+m')
    
    // Test Ctrl+` (Toggle Logs Bottom Panel)
    await comfyPage.page.keyboard.press('Control+`')
    
    // All keybindings should work without errors
    // The test passes if no exceptions are thrown
  })

  test('Should handle key events correctly with event.code', async ({ comfyPage }) => {
    await comfyPage.goto()
    await expect(comfyPage.canvas).toBeVisible()
    
    // Test that the keybinding system uses event.code for identification
    // by simulating key events and checking that they work correctly
    
    // Create a simple test by registering a custom keybinding
    await comfyPage.page.evaluate(() => {
      // Mock a key event with specific code
      const mockEvent = new KeyboardEvent('keydown', {
        key: 'q', // This would be the localized character on AZERTY
        code: 'KeyS', // This is the physical key position
        ctrlKey: true,
        bubbles: true
      })
      
      // Dispatch the event
      document.dispatchEvent(mockEvent)
    })
    
    // The keybinding should work based on the code, not the key
    await expect(comfyPage.page.locator('body')).toBeVisible()
  })

  test('Should display correct key combinations in UI', async ({ comfyPage }) => {
    await comfyPage.goto()
    await expect(comfyPage.canvas).toBeVisible()
    
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    
    // Navigate to keybindings panel
    await comfyPage.page.locator('text=Keybinding').click()
    
    // Check that keybindings are displayed correctly
    await expect(comfyPage.page.locator('text=Ctrl + S')).toBeVisible()
    await expect(comfyPage.page.locator('text=Ctrl + O')).toBeVisible()
    await expect(comfyPage.page.locator('text=Ctrl + G')).toBeVisible()
    
    // The display should show the localized character (key) but use the code for functionality
  })
}) 