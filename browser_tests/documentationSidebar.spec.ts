import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Documentation Sidebar', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Floating')
    await comfyPage.loadWorkflow('default')
  })

  test.afterEach(async ({ comfyPage }) => {
    const currentThemeId = await comfyPage.menu.getThemeId()
    if (currentThemeId !== 'dark') {
      await comfyPage.menu.toggleTheme()
    }
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('Sidebar registered', async ({ comfyPage }) => {
    await expect(
      comfyPage.page.locator('.documentation-tab-button')
    ).toBeVisible()
  })
  test('Parses help for basic node', async ({ comfyPage }) => {
    await comfyPage.page.locator('.documentation-tab-button').click()
    const docPane = comfyPage.page.locator('.sidebar-content-container')
    //Check that each independently parsed element exists
    await expect(docPane).toContainText('Load Checkpoint')
    await expect(docPane).toContainText('Loads a diffusion model')
    await expect(docPane).toContainText('The name of the checkpoint')
    await expect(docPane).toContainText('The VAE model used')
  })
  test('Responds to hovering over node', async ({ comfyPage }) => {
    await comfyPage.page.locator('.documentation-tab-button').click()
    const docPane = comfyPage.page.locator('.sidebar-content-container')
    await comfyPage.page.mouse.move(321, 593)
    const tooltipTimeout = 500
    await comfyPage.page.waitForTimeout(tooltipTimeout + 16)
    await expect(comfyPage.page.locator('.node-tooltip')).not.toBeVisible()
    await expect(
      comfyPage.page.locator('.sidebar-content-container>div>div:nth-child(4)')
    ).toBeFocused()
  })
  test('Updates when a new node is selected', async ({ comfyPage }) => {
    await comfyPage.page.locator('.documentation-tab-button').click()
    const docPane = comfyPage.page.locator('.sidebar-content-container')
    await comfyPage.page.mouse.click(557, 440)
    await expect(docPane).not.toContainText('Load Checkpoint')
    await expect(docPane).toContainText('CLIP Text Encode (Prompt)')
    await expect(docPane).toContainText('The text to be encoded')
    await expect(docPane).toContainText(
      'A conditioning containing the embedded text'
    )
  })
  test('Responds to a change in theme', async ({ comfyPage }) => {
    await comfyPage.page.locator('.documentation-tab-button').click()
    const docPane = comfyPage.page.locator('.sidebar-content-container')
    comfyPage.menu.toggleTheme()
    await expect(docPane).toHaveScreenshot(
      'documentation-sidebar-light-theme.png'
    )
  })
})
