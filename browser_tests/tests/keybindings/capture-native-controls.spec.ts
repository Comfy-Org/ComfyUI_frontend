import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Capture keyboard shortcuts', { tag: ['@canvas'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.widgetTextBox.fill('')
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('preserves text editing and dropdown activation and dismissal', async ({
    comfyPage
  }) => {
    const nodeCount = await comfyPage.nodeOps.getNodeCount()
    await comfyPage.widgetTextBox.pressSequentially('a normal prompt')
    await expect(comfyPage.widgetTextBox).toHaveValue('a normal prompt')
    await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(false)
    await comfyPage.widgetTextBox.press('ControlOrMeta+a')
    await comfyPage.widgetTextBox.press('Delete')
    await expect(comfyPage.widgetTextBox).toHaveValue('')
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCount)

    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('Keybinding').click()
    const preset = comfyPage.settingDialog.root
      .getByRole('combobox')
      .filter({ hasText: 'Default' })
    const listbox = comfyPage.page.getByRole('listbox')
    await preset.press('Space')
    await expect(listbox).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')
    await expect(listbox).toBeHidden()
    await expect(comfyPage.settingDialog.root).toBeVisible()
    await expect(preset).toBeFocused()

    await preset.press('Enter')
    await expect(listbox).toBeVisible()
    await comfyPage.page.keyboard.press('Home')
    await comfyPage.page.keyboard.press('Enter')
    await expect(listbox).toBeHidden()
    await expect(comfyPage.settingDialog.root).toBeVisible()
    await comfyPage.settingDialog.close()
  })
})
