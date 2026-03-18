import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { Page } from '@playwright/test'
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

async function importPreset(page: Page, preset: typeof TEST_PRESET) {
  const menuButton = page.getByTestId('keybinding-preset-menu')
  await menuButton.click()

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: /Import preset/i }).click()
  const fileChooser = await fileChooserPromise

  const presetPath = path.join(os.tmpdir(), 'test-preset.json')
  fs.writeFileSync(presetPath, JSON.stringify(preset))
  await fileChooser.setFiles(presetPath)
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

    await importPreset(page, TEST_PRESET)

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

  test('Can export a preset and re-import it', async ({ comfyPage }) => {
    test.setTimeout(30000)
    const { page } = comfyPage
    const menuButton = page.getByTestId('keybinding-preset-menu')

    // Open keybinding settings panel
    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('Keybinding').click()

    await importPreset(page, TEST_PRESET)

    // Verify active preset switched to test-preset
    const presetTrigger = page
      .locator('#keybinding-panel-actions')
      .locator('button[role="combobox"]')
    await expect(presetTrigger).toContainText('test-preset')

    // Wait for toast to auto-dismiss
    await expect(comfyPage.toast.visibleToasts).toHaveCount(0, {
      timeout: 5000
    })

    // Export via ellipsis menu
    await menuButton.click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: /Export preset/i }).click()
    const download = await downloadPromise

    // Verify filename contains test-preset
    expect(download.suggestedFilename()).toContain('test-preset')

    // Close settings
    await page.keyboard.press('Escape')
    await comfyPage.settingDialog.waitForHidden()

    // Verify the downloaded file is valid JSON with correct structure
    const downloadPath = await download.path()
    expect(downloadPath).toBeTruthy()
    const content = fs.readFileSync(downloadPath!, 'utf-8')
    const parsed = JSON.parse(content) as {
      name: string
      newBindings: unknown[]
      unsetBindings: unknown[]
    }
    expect(parsed).toHaveProperty('name')
    expect(parsed).toHaveProperty('newBindings')
    expect(parsed).toHaveProperty('unsetBindings')
    expect(parsed.name).toBe('test-preset')
  })

  test('Can delete an imported preset', async ({ comfyPage }) => {
    test.setTimeout(30000)
    const { page } = comfyPage
    const menuButton = page.getByTestId('keybinding-preset-menu')

    // Open keybinding settings panel
    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('Keybinding').click()

    await importPreset(page, TEST_PRESET)

    // Verify active preset switched to test-preset
    const presetTrigger = page
      .locator('#keybinding-panel-actions')
      .locator('button[role="combobox"]')
    await expect(presetTrigger).toContainText('test-preset')

    // Wait for toast to auto-dismiss
    await expect(comfyPage.toast.visibleToasts).toHaveCount(0, {
      timeout: 5000
    })

    // Delete via ellipsis menu
    await menuButton.click()
    await page.getByRole('menuitem', { name: /Delete preset/i }).click()

    // Confirm deletion in the dialog
    const confirmDialog = page.getByRole('dialog', {
      name: /Delete the current preset/i
    })
    await confirmDialog.getByRole('button', { name: /Delete/i }).click()

    // Verify preset trigger now shows Default Preset
    await expect(presetTrigger).toContainText('Default Preset')

    // Close settings
    await page.keyboard.press('Escape')
    await comfyPage.settingDialog.waitForHidden()
  })

  test('Can save modifications as a new preset', async ({ comfyPage }) => {
    test.setTimeout(30000)
    const { page } = comfyPage
    const menuButton = page.getByTestId('keybinding-preset-menu')

    // Open keybinding settings panel
    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('Keybinding').click()

    await importPreset(page, TEST_PRESET)

    // Verify active preset switched to test-preset
    const presetTrigger = page
      .locator('#keybinding-panel-actions')
      .locator('button[role="combobox"]')
    await expect(presetTrigger).toContainText('test-preset')

    // Wait for toast to auto-dismiss
    await expect(comfyPage.toast.visibleToasts).toHaveCount(0, {
      timeout: 5000
    })

    // Save as new preset via ellipsis menu
    await menuButton.click()
    await page.getByRole('menuitem', { name: /Save as new preset/i }).click()

    // Fill in the preset name in the prompt dialog
    const promptInput = page.locator('.prompt-dialog-content input')
    await promptInput.fill('my-custom-preset')
    await promptInput.press('Enter')

    // Wait for toast to auto-dismiss
    await expect(comfyPage.toast.visibleToasts).toHaveCount(0, {
      timeout: 5000
    })

    // Verify preset trigger shows my-custom-preset
    await expect(presetTrigger).toContainText('my-custom-preset')

    // Close settings
    await page.keyboard.press('Escape')
    await comfyPage.settingDialog.waitForHidden()

    // Cleanup: delete the my-custom-preset file
    await comfyPage.request.fetch(
      `${comfyPage.url}/api/userdata/keybindings%2Fmy-custom-preset.json`,
      { method: 'DELETE' }
    )
  })
})
