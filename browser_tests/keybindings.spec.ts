import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Keybindings', () => {
  test('Should not trigger non-modifier keybinding when typing in input fields', async ({
    comfyPage
  }) => {
    await comfyPage.registerKeybinding({ key: 'k' }, () => {
      window['TestCommand'] = true
    })

    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('k')
    await expect(textBox).toHaveValue('k')
    expect(await comfyPage.page.evaluate(() => window['TestCommand'])).toBe(
      undefined
    )
  })

  test('Should not trigger modifier keybinding when typing in input fields', async ({
    comfyPage
  }) => {
    await comfyPage.registerKeybinding({ key: 'k', ctrl: true }, () => {
      window['TestCommand'] = true
    })

    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('q')
    await textBox.press('Control+k')
    await expect(textBox).toHaveValue('q')
    expect(await comfyPage.page.evaluate(() => window['TestCommand'])).toBe(
      true
    )
  })
})
