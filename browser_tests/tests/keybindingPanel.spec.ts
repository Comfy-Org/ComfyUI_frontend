import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const MULTI_BINDING_COMMAND = 'Comfy.Canvas.DeleteSelectedItems'
const SINGLE_BINDING_COMMAND = 'Comfy.SaveWorkflow'
const NO_BINDING_COMMAND = 'TestCommand.KeybindingPanelE2E.NoBinding'

async function searchKeybindings(page: Page, query: string) {
  const searchInput = page.locator('.keybinding-panel').getByRole('searchbox')
  await searchInput.fill(query)
}

async function clearSearch(page: Page) {
  const searchInput = page.locator('.keybinding-panel').getByRole('searchbox')
  await searchInput.clear()
}

function getCommandRow(page: Page, commandId: string): Locator {
  return page
    .locator('.keybinding-panel tr')
    .filter({ has: page.locator(`[title="${commandId}"]`) })
}

async function openContextMenu(page: Page, commandId: string) {
  const row = getCommandRow(page, commandId)
  await row.locator(`[title="${commandId}"]`).click({ button: 'right' })
  await expect(
    page.getByRole('menuitem', { name: /Change keybinding/i })
  ).toBeVisible()
}

function getKeybindingInput(page: Page): Locator {
  return page.getByRole('dialog').locator('input[autofocus]')
}

async function pressComboOnInput(page: Page, combo: string) {
  const input = getKeybindingInput(page)
  await expect(input).toBeFocused()
  await input.press(combo)
}

async function saveAndCloseKeybindingDialog(page: Page) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /Save/i }).click()
  await expect(dialog).toBeHidden()
}

async function cancelAndCloseDialog(page: Page) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /Cancel/i }).click()
  await expect(dialog).toBeHidden()
}

async function addKeybindingToRow(page: Page, row: Locator, combo: string) {
  await row.getByRole('button', { name: /Add new keybinding/i }).click()
  await pressComboOnInput(page, combo)
  await saveAndCloseKeybindingDialog(page)
}

test.beforeEach(async ({ comfyPage }) => {
  await registerNoBindingCommand(comfyPage)
  await comfyPage.settingDialog.open()
  await comfyPage.settingDialog.category('Keybinding').click()
})

test.afterEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.Keybinding.NewBindings', [])
  await comfyPage.settings.setSetting('Comfy.Keybinding.UnsetBindings', [])
})

async function registerNoBindingCommand(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate((commandId) => {
    const app = window.app!
    app.registerExtension({
      name: 'TestExtension.KeybindingPanelE2E',
      commands: [{ id: commandId, function: () => {} }]
    })
  }, NO_BINDING_COMMAND)
}

test.describe('Keybinding Panel', { tag: '@keyboard' }, () => {
  test.describe('Row Expansion', () => {
    test('Click on row with 2+ keybindings toggles expansion', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, MULTI_BINDING_COMMAND)
      const row = getCommandRow(page, MULTI_BINDING_COMMAND)
      await expect(row).toBeVisible()

      const chevron = row.locator('.icon-\\[lucide--chevron-right\\]')
      await expect(chevron).toBeVisible()

      await row.locator(`[title="${MULTI_BINDING_COMMAND}"]`).click()

      const expansionContent = page.locator('.keybinding-panel .pl-4')
      await expect(expansionContent).toBeVisible()
      await expect(chevron).toHaveClass(/rotate-90/)

      await row.locator(`[title="${MULTI_BINDING_COMMAND}"]`).click()
      await expect(expansionContent).toBeHidden()
    })

    test('Click on row with 1 keybinding does not expand', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      const row = getCommandRow(page, SINGLE_BINDING_COMMAND)
      await expect(row).toBeVisible()

      const chevron = row.locator('.icon-\\[lucide--chevron-right\\]')
      await expect(chevron).toBeHidden()

      await row.locator(`[title="${SINGLE_BINDING_COMMAND}"]`).click()

      const expansionContent = page.locator('.keybinding-panel .pl-4')
      await expect(expansionContent).toBeHidden()
    })
  })

  test.describe('Double-Click', () => {
    test('Double-click row with 0 keybindings opens Add dialog', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, NO_BINDING_COMMAND)
      const row = getCommandRow(page, NO_BINDING_COMMAND)
      await expect(row).toBeVisible()

      await row.locator(`[title="${NO_BINDING_COMMAND}"]`).dblclick()

      const input = getKeybindingInput(page)
      await expect(input).toBeVisible()

      await cancelAndCloseDialog(page)
    })

    test('Double-click row with 1 keybinding opens Edit dialog', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      const row = getCommandRow(page, SINGLE_BINDING_COMMAND)
      await expect(row).toBeVisible()

      await row.locator(`[title="${SINGLE_BINDING_COMMAND}"]`).dblclick()

      const input = getKeybindingInput(page)
      await expect(input).toBeVisible()

      await cancelAndCloseDialog(page)
    })
  })

  test.describe('Context Menu', () => {
    test('Right-click row shows context menu with correct items', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      await openContextMenu(page, SINGLE_BINDING_COMMAND)

      const changeItem = page.getByRole('menuitem', {
        name: /Change keybinding/i
      })
      const addItem = page.getByRole('menuitem', {
        name: /Add new keybinding/i
      })
      const resetItem = page.getByRole('menuitem', {
        name: /Reset to default/i
      })
      const removeItem = page.getByRole('menuitem', {
        name: /Remove keybinding/i
      })

      await expect(changeItem).toBeVisible()
      await expect(addItem).toBeVisible()
      await expect(resetItem).toBeVisible()
      await expect(removeItem).toBeVisible()

      await page.keyboard.press('Escape')
    })

    test("Context menu 'Add new keybinding' opens add dialog", async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      await openContextMenu(page, SINGLE_BINDING_COMMAND)

      await page.getByRole('menuitem', { name: /Add new keybinding/i }).click()

      const input = getKeybindingInput(page)
      await expect(input).toBeVisible()

      await cancelAndCloseDialog(page)
    })

    test("Context menu 'Change keybinding' on single-binding command opens edit dialog", async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      await openContextMenu(page, SINGLE_BINDING_COMMAND)

      await page.getByRole('menuitem', { name: /Change keybinding/i }).click()

      const input = getKeybindingInput(page)
      await expect(input).toBeVisible()

      await cancelAndCloseDialog(page)
    })

    test("Context menu 'Change keybinding' on multi-binding command expands row", async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, MULTI_BINDING_COMMAND)

      const expansionContent = page.locator('.keybinding-panel .pl-4')
      await expect(expansionContent).toBeHidden()

      await openContextMenu(page, MULTI_BINDING_COMMAND)

      await page.getByRole('menuitem', { name: /Change keybinding/i }).click()

      await expect(expansionContent).toBeVisible()
    })

    test("Context menu 'Remove keybinding' after adding second binding shows confirm dialog", async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      const row = getCommandRow(page, SINGLE_BINDING_COMMAND)

      await addKeybindingToRow(page, row, 'Control+Shift+F9')

      await openContextMenu(page, SINGLE_BINDING_COMMAND)
      await page.getByRole('menuitem', { name: /Remove keybinding/i }).click()

      const confirmDialog = page.getByRole('dialog')
      await expect(confirmDialog).toBeVisible()
      await confirmDialog.getByRole('button', { name: /Remove all/i }).click()

      await expect(row.locator('td').nth(1)).toContainText('-')
    })

    test("Context menu 'Reset to default' resets modified command", async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      const row = getCommandRow(page, SINGLE_BINDING_COMMAND)

      await addKeybindingToRow(page, row, 'Control+Shift+F10')

      await openContextMenu(page, SINGLE_BINDING_COMMAND)
      await page.getByRole('menuitem', { name: /Reset to default/i }).click()

      await expect(row.getByRole('button', { name: /Reset/i })).toBeDisabled()
    })

    test('Context menu items disabled when no keybindings', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, NO_BINDING_COMMAND)
      await openContextMenu(page, NO_BINDING_COMMAND)

      const changeItem = page.getByRole('menuitem', {
        name: /Change keybinding/i
      })
      const removeItem = page.getByRole('menuitem', {
        name: /Remove keybinding/i
      })

      await expect(changeItem).toHaveAttribute('data-disabled', '')
      await expect(removeItem).toHaveAttribute('data-disabled', '')

      await page.keyboard.press('Escape')
    })
  })

  test.describe('Action Buttons', () => {
    test('Edit button opens edit dialog for single-binding command', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      const row = getCommandRow(page, SINGLE_BINDING_COMMAND)

      const editButton = row.getByRole('button', { name: /^Edit$/i })
      await expect(editButton).toBeVisible()
      await editButton.click()

      const input = getKeybindingInput(page)
      await expect(input).toBeVisible()

      await cancelAndCloseDialog(page)
    })

    test('Add button opens add dialog', async ({ comfyPage }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      const row = getCommandRow(page, SINGLE_BINDING_COMMAND)

      await row.getByRole('button', { name: /Add new keybinding/i }).click()

      const input = getKeybindingInput(page)
      await expect(input).toBeVisible()

      await cancelAndCloseDialog(page)
    })

    test('Reset button is disabled for unmodified commands', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      const row = getCommandRow(page, SINGLE_BINDING_COMMAND)

      const resetButton = row.getByRole('button', { name: /Reset/i })
      await expect(resetButton).toBeDisabled()
    })

    test('Reset button resets modified keybinding', async ({ comfyPage }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      const row = getCommandRow(page, SINGLE_BINDING_COMMAND)

      await addKeybindingToRow(page, row, 'Control+Shift+F11')

      const resetButton = row.getByRole('button', { name: /Reset/i })
      await expect(resetButton).toBeEnabled()

      await resetButton.click()

      await expect(resetButton).toBeDisabled()
    })

    test('Delete button is disabled for commands with 0 keybindings', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, NO_BINDING_COMMAND)
      const row = getCommandRow(page, NO_BINDING_COMMAND)

      const deleteButton = row.getByRole('button', { name: /Delete/i })
      await expect(deleteButton).toBeDisabled()
    })

    test('Delete button removes single keybinding directly', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, NO_BINDING_COMMAND)
      const row = getCommandRow(page, NO_BINDING_COMMAND)

      await addKeybindingToRow(page, row, 'Control+Shift+F12')

      const deleteButton = row.getByRole('button', { name: /Delete/i })
      await expect(deleteButton).toBeEnabled()
      await deleteButton.click()

      await expect(row.locator('td').nth(1)).toContainText('-')
    })

    test('Delete button on command with 2+ keybindings shows confirm dialog', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, MULTI_BINDING_COMMAND)
      const row = getCommandRow(page, MULTI_BINDING_COMMAND)

      const deleteButton = row.getByRole('button', { name: /Delete/i })
      await deleteButton.click()

      const confirmDialog = page.getByRole('dialog')
      await expect(confirmDialog).toBeVisible()

      await confirmDialog.getByRole('button', { name: /Cancel/i }).click()
      await expect(confirmDialog).toBeHidden()
      await expect(row.locator('td').nth(1)).not.toContainText('-')
    })
  })

  test.describe('Expanded Row Actions', () => {
    test('Edit button in expanded row opens edit dialog for that binding', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, MULTI_BINDING_COMMAND)

      await page.locator(`[title="${MULTI_BINDING_COMMAND}"]`).click()
      const expansionContent = page.locator('.keybinding-panel .pl-4')
      await expect(expansionContent).toBeVisible()

      const firstBindingRow = expansionContent
        .locator('.flex.items-center.justify-between')
        .first()
      await firstBindingRow.getByRole('button', { name: /^Edit$/i }).click()

      const input = getKeybindingInput(page)
      await expect(input).toBeVisible()

      await cancelAndCloseDialog(page)
    })

    test('Delete button in expanded row removes that binding and collapses', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, MULTI_BINDING_COMMAND)

      await page.locator(`[title="${MULTI_BINDING_COMMAND}"]`).click()
      const expansionContent = page.locator('.keybinding-panel .pl-4')
      await expect(expansionContent).toBeVisible()

      const bindingRows = expansionContent.locator(
        '.flex.items-center.justify-between'
      )
      await expect
        .poll(() => bindingRows.count(), {
          message: 'Expected at least 2 bindings'
        })
        .toBeGreaterThanOrEqual(2)

      await bindingRows
        .first()
        .getByRole('button', { name: /Remove keybinding/i })
        .click()

      // Expansion auto-collapses when bindings drop below 2
      await expect(expansionContent).toBeHidden()
    })
  })

  test.describe('Reset All', () => {
    test('Reset All button shows confirmation and resets on confirm', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      const row = getCommandRow(page, SINGLE_BINDING_COMMAND)
      await addKeybindingToRow(page, row, 'Control+Shift+F8')

      await expect(row.getByRole('button', { name: /Reset/i })).toBeEnabled()

      await clearSearch(page)

      const resetAllButton = page
        .locator('.keybinding-panel')
        .getByRole('button', { name: /Reset All/i })
      await resetAllButton.click()

      const confirmDialog = page.getByRole('dialog')
      await expect(confirmDialog).toBeVisible()
      await expect(confirmDialog).toContainText(/Reset all keybindings/i)

      await confirmDialog.getByRole('button', { name: /Reset All/i }).click()

      await expect(comfyPage.toast.visibleToasts).toHaveCount(1)

      await searchKeybindings(page, SINGLE_BINDING_COMMAND)
      const rowAfterReset = getCommandRow(page, SINGLE_BINDING_COMMAND)
      await expect(
        rowAfterReset.getByRole('button', { name: /Reset/i })
      ).toBeDisabled()
    })

    test('Reset All confirmation can be cancelled', async ({ comfyPage }) => {
      const { page } = comfyPage

      const resetAllButton = page
        .locator('.keybinding-panel')
        .getByRole('button', { name: /Reset All/i })
      await resetAllButton.click()

      const confirmDialog = page.getByRole('dialog')
      await expect(confirmDialog).toBeVisible()
      await confirmDialog.getByRole('button', { name: /Cancel/i }).click()

      await expect(confirmDialog).toBeHidden()
    })
  })

  test.describe('Search Filter', () => {
    test('Typing in search clears expanded rows', async ({ comfyPage }) => {
      const { page } = comfyPage

      await searchKeybindings(page, MULTI_BINDING_COMMAND)

      await page.locator(`[title="${MULTI_BINDING_COMMAND}"]`).click()
      const expansionContent = page.locator('.keybinding-panel .pl-4')
      await expect(expansionContent).toBeVisible()

      // Changing the filter triggers watch(filters, ...) which clears expansion
      await searchKeybindings(page, MULTI_BINDING_COMMAND + ' ')
      await expect(expansionContent).toBeHidden()
    })
  })
})
