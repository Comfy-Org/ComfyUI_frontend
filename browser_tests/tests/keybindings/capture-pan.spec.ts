import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Capture keyboard shortcuts', { tag: ['@canvas'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.page.keyboard.up('Space')
    await comfyPage.page.keyboard.up('KeyJ')
    await comfyPage.settings.setSetting('Comfy.Keybinding.SettingsV1', null)
    await comfyPage.settings.setSetting('Comfy.Keybinding.NewBindings', [])
    await comfyPage.settings.setSetting('Comfy.Keybinding.UnsetBindings', [])
    await comfyPage.canvasOps.resetView()
  })

  test('releases pan on keyup and blur and persists a replacement shortcut', async ({
    comfyPage
  }) => {
    await comfyPage.canvas.focus()
    await comfyPage.page.keyboard.down('Space')
    await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(true)
    await comfyPage.page.keyboard.up('Space')
    await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(false)

    await comfyPage.page.keyboard.down('Space')
    await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(true)
    await comfyPage.page.evaluate(() =>
      window.dispatchEvent(new FocusEvent('blur'))
    )
    await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(false)
    await comfyPage.page.keyboard.up('Space')

    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('Keybinding').click()
    await comfyPage.page
      .getByPlaceholder('Search Keybindings...')
      .fill('Comfy.Canvas.Pan')
    await comfyPage.page
      .getByTitle('Comfy.Canvas.Pan', { exact: true })
      .dblclick()
    const editDialog = comfyPage.page.getByRole('dialog', {
      name: /Modify keybinding/i
    })
    await editDialog.getByRole('textbox').press('KeyJ')
    await editDialog.getByRole('button', { name: /Save/i }).click()
    await expect(editDialog).toBeHidden()
    await comfyPage.settingDialog.close()

    await comfyPage.workflow.reloadAndWaitForApp()
    await comfyPage.canvas.focus()
    await comfyPage.page.keyboard.down('Space')
    await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(false)
    await comfyPage.page.keyboard.up('Space')
    await comfyPage.page.keyboard.down('KeyJ')
    await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(true)
    await comfyPage.page.keyboard.up('KeyJ')
    await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(false)
  })
})
