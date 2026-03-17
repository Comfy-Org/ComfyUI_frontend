import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

const TEST_PRESET = {
  name: 'test-preset',
  newBindings: [
    {
      commandId: 'Comfy.Canvas.SelectAll',
      combo: { key: 'a', ctrl: true, shift: true },
      targetElementId: 'graph-canvas-container'
    }
  ],
  unsetBindings: [
    {
      commandId: 'Comfy.Canvas.SelectAll',
      combo: { key: 'a', ctrl: true },
      targetElementId: 'graph-canvas-container'
    }
  ]
}

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.afterEach(async ({ comfyPage }) => {
  await comfyPage.request.fetch(
    `${comfyPage.url}/api/userdata/keybindings%2Ftest-preset.json`,
    { method: 'DELETE' }
  )
  await comfyPage.settings.setSetting(
    'Comfy.Keybinding.CurrentPreset',
    'default'
  )
})

test.describe('Keybinding Presets', { tag: '@keyboard' }, () => {
  test('Can import a preset, use remapped keybinding, and switch back to default', async ({
    comfyPage
  }) => {
    test.setTimeout(30000)
    const { page } = comfyPage

    // Verify default Ctrl+A select-all works
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.canvas.press('Control+a')
    await comfyPage.canvas.press('Delete')
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    // Open keybinding settings panel
    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('Keybinding').click()

    // Import preset via ellipsis menu
    const ellipsisButton = page
      .locator('.icon-\\[lucide--ellipsis\\]')
      .locator('..')
    await ellipsisButton.click()

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('menuitem', { name: /Import preset/i }).click()
    const fileChooser = await fileChooserPromise

    const presetPath = path.join(os.tmpdir(), 'test-preset.json')
    fs.writeFileSync(presetPath, JSON.stringify(TEST_PRESET))
    await fileChooser.setFiles(presetPath)

    // Verify active preset switched to test-preset
    const presetTrigger = page
      .locator('#keybinding-panel-actions')
      .locator('button[role="combobox"]')
    await expect(presetTrigger).toContainText('test-preset')

    // Wait for toast to auto-dismiss, then close settings via Escape
    await expect(comfyPage.toast.visibleToasts).toHaveCount(0, {
      timeout: 5000
    })
    await page.keyboard.press('Escape')
    await comfyPage.settingDialog.waitForHidden()

    // Load workflow again, use new keybind Ctrl+Shift+A
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.canvas.press('Control+Shift+a')
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
      .toBeGreaterThan(0)
    await comfyPage.canvas.press('Delete')
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    // Switch back to default preset
    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('Keybinding').click()

    await presetTrigger.click()
    await page.getByRole('option', { name: /Default Preset/i }).click()

    // Handle unsaved changes dialog if the preset was marked as modified
    const discardButton = page.getByRole('button', {
      name: /Discard and Switch/i
    })
    if (await discardButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await discardButton.click()
    }

    await expect(presetTrigger).toContainText('Default Preset')

    await page.keyboard.press('Escape')
    await comfyPage.settingDialog.waitForHidden()
  })
})
