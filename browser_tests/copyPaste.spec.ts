import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Copy Paste', () => {
  test('Can copy and paste node', async ({ comfyPage }) => {
    await comfyPage.clickEmptyLatentNode()
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.ctrlC()
    await comfyPage.ctrlV()
    await expect(comfyPage.canvas).toHaveScreenshot('copied-node.png')
  })

  test('Can copy and paste text', async ({ comfyPage }) => {
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    const originalString = await textBox.inputValue()
    await textBox.selectText()
    await comfyPage.ctrlC()
    await comfyPage.ctrlV()
    await comfyPage.ctrlV()
    const resultString = await textBox.inputValue()
    expect(resultString).toBe(originalString + originalString)
  })

  /**
   * https://github.com/Comfy-Org/ComfyUI_frontend/issues/98
   */
  test('Paste in text area with node previously copied', async ({
    comfyPage
  }) => {
    await comfyPage.clickEmptyLatentNode()
    await comfyPage.ctrlC()
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.inputValue()
    await textBox.selectText()
    await comfyPage.ctrlC()
    await comfyPage.ctrlV()
    await comfyPage.ctrlV()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'paste-in-text-area-with-node-previously-copied.png'
    )
  })

  test('Copy text area does not copy node', async ({ comfyPage }) => {
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.inputValue()
    await textBox.selectText()
    await comfyPage.ctrlC()
    // Unfocus textbox.
    await comfyPage.page.mouse.click(10, 10)
    await comfyPage.ctrlV()
    await expect(comfyPage.canvas).toHaveScreenshot('no-node-copied.png')
  })
})
