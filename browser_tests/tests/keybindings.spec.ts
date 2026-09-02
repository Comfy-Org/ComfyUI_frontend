import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Keybindings', { tag: '@keyboard' }, () => {
  test('Should not trigger non-modifier keybinding when typing in input fields', async ({
    comfyPage
  }) => {
    const commandId = await comfyPage.command.registerKeybinding({ key: 'k' })
    await comfyPage.command.mockCommand(commandId)

    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('k')
    await expect(textBox).toHaveValue('k')
    expect(await comfyPage.command.getExecutionCount(commandId)).toBe(0)
  })

  test('Should not trigger modifier keybinding when typing in input fields', async ({
    comfyPage
  }) => {
    const commandId = await comfyPage.command.registerKeybinding({
      key: 'k',
      ctrl: true
    })
    await comfyPage.command.mockCommand(commandId)

    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('q')
    await textBox.press('Control+k')
    await expect(textBox).toHaveValue('q')
    await expect
      .poll(() => comfyPage.command.getExecutionCount(commandId))
      .toBe(1)
  })

  test('Should not trigger keybinding reserved by text input when typing in input fields', async ({
    comfyPage
  }) => {
    const commandId = await comfyPage.command.registerKeybinding({
      key: 'Ctrl+v'
    })
    await comfyPage.command.mockCommand(commandId)

    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.press('Control+v')
    await expect(textBox).toBeFocused()
    expect(await comfyPage.command.getExecutionCount(commandId)).toBe(0)
  })
})
