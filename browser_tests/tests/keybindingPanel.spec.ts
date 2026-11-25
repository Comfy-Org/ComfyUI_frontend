import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const MULTI_BINDING_COMMAND = 'Comfy.Canvas.DeleteSelectedItems'
const SINGLE_BINDING_COMMAND = 'Comfy.SaveWorkflow'
const NO_BINDING_COMMAND = 'TestCommand.KeybindingPanelE2E.NoBinding'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settingDialog.keybindingPanel.registerCommand(
    NO_BINDING_COMMAND
  )
  await comfyPage.settingDialog.open()
  await comfyPage.settingDialog.category('Keybinding').click()
})

test.describe('Keybinding Panel', { tag: '@keyboard' }, () => {
  test.describe('Row Expansion', () => {
    test('Keyboard activates rows and opens the context menu', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(MULTI_BINDING_COMMAND)
      const row = panel.commandRow(MULTI_BINDING_COMMAND)

      await test.step('Enter expands the focused row', async () => {
        await row.focus()
        await row.press('Enter')
        await expect(
          panel.expansionContent(MULTI_BINDING_COMMAND)
        ).toBeVisible()
      })

      await test.step('Space collapses it', async () => {
        await row.press('Space')
        await expect(panel.expansionContent(MULTI_BINDING_COMMAND)).toBeHidden()
      })

      await test.step('Shift+F10 opens the row menu', async () => {
        await row.press('Shift+F10')
        await expect(
          comfyPage.contextMenu.menuItem('Change keybinding')
        ).toBeVisible()
      })

      await test.step('Escape closes the menu and refocuses the row', async () => {
        await panel.page.keyboard.press('Escape')
        await expect(
          comfyPage.contextMenu.menuItem('Change keybinding')
        ).toBeHidden()
        await expect(row).toBeFocused()
      })
    })

    test('Click on row with 2+ keybindings toggles expansion', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(MULTI_BINDING_COMMAND)
      const row = panel.commandRow(MULTI_BINDING_COMMAND)
      await expect(row).toBeVisible()

      await panel.commandLabel(MULTI_BINDING_COMMAND).click()

      const expansionContent = panel.expansionContent(MULTI_BINDING_COMMAND)
      await expect(expansionContent).toBeVisible()

      await panel.commandLabel(MULTI_BINDING_COMMAND).click()
      await expect(expansionContent).toBeHidden()
    })

    test('Click on row with 1 keybinding does not expand', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      const row = panel.commandRow(SINGLE_BINDING_COMMAND)
      await expect(row).toBeVisible()

      await panel.commandLabel(SINGLE_BINDING_COMMAND).click()

      const expansionContent = panel.expansionContent(SINGLE_BINDING_COMMAND)
      await expect(expansionContent).toBeHidden()
    })
  })

  test.describe('Double-Click', () => {
    test('Double-click row with 0 keybindings opens Add dialog', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(NO_BINDING_COMMAND)
      const row = panel.commandRow(NO_BINDING_COMMAND)
      await expect(row).toBeVisible()

      await panel.commandLabel(NO_BINDING_COMMAND).dblclick()

      const input = panel.keybindingInput
      await expect(input).toBeVisible()

      await panel.cancelKeybinding()
    })

    test('Double-click row with 1 keybinding opens Edit dialog', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      const row = panel.commandRow(SINGLE_BINDING_COMMAND)
      await expect(row).toBeVisible()

      await panel.commandLabel(SINGLE_BINDING_COMMAND).dblclick()

      const input = panel.keybindingInput
      await expect(input).toBeVisible()

      await panel.cancelKeybinding()
    })
  })

  test.describe('Context Menu', () => {
    test('Right-click row shows context menu with correct items', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      await panel.openContextMenu(SINGLE_BINDING_COMMAND)

      const changeItem = comfyPage.contextMenu.menuItem('Change keybinding')
      const addItem = comfyPage.contextMenu.menuItem('Add new keybinding')
      const resetItem = comfyPage.contextMenu.menuItem('Reset to default')
      const removeItem = comfyPage.contextMenu.menuItem('Remove keybinding')

      await expect(changeItem).toBeVisible()
      await expect(addItem).toBeVisible()
      await expect(resetItem).toBeVisible()
      await expect(removeItem).toBeVisible()

      await panel.page.keyboard.press('Escape')
    })

    test('Context menu opens at the pointer inside the settings dialog', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      const offset = { x: 10, y: 5 }
      const labelBox = await panel
        .commandLabel(SINGLE_BINDING_COMMAND)
        .boundingBox()
      if (!labelBox) throw new Error('Command label has no bounding box')
      const pointer = { x: labelBox.x + offset.x, y: labelBox.y + offset.y }
      await panel.openContextMenu(SINGLE_BINDING_COMMAND, offset)

      await expect
        .poll(() => comfyPage.contextMenu.distanceFrom(pointer))
        .toBeLessThan(16)
    })

    test("Context menu 'Add new keybinding' opens add dialog", async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      await panel.openContextMenu(SINGLE_BINDING_COMMAND)

      await comfyPage.contextMenu.menuItem('Add new keybinding').click()

      const input = panel.keybindingInput
      await expect(input).toBeVisible()

      await panel.cancelKeybinding()
    })

    test("Context menu 'Change keybinding' on single-binding command opens edit dialog", async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      await panel.openContextMenu(SINGLE_BINDING_COMMAND)

      await comfyPage.contextMenu.menuItem('Change keybinding').click()

      const input = panel.keybindingInput
      await expect(input).toBeVisible()

      await panel.cancelKeybinding()
    })

    test("Context menu 'Change keybinding' on multi-binding command expands row", async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(MULTI_BINDING_COMMAND)

      const expansionContent = panel.expansionContent(MULTI_BINDING_COMMAND)
      await expect(expansionContent).toBeHidden()

      await panel.openContextMenu(MULTI_BINDING_COMMAND)

      await comfyPage.contextMenu.menuItem('Change keybinding').click()

      await expect(expansionContent).toBeVisible()
    })

    test("Context menu 'Remove keybinding' after adding second binding shows confirm dialog", async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      const row = panel.commandRow(SINGLE_BINDING_COMMAND)

      await panel.addKeybindingToRow(row, 'Control+Shift+F9')

      await panel.openContextMenu(SINGLE_BINDING_COMMAND)
      await comfyPage.contextMenu.menuItem('Remove keybinding').click()

      const confirmDialog = panel.removeAllDialog
      await expect(confirmDialog).toBeVisible()
      await confirmDialog.getByRole('button', { name: /Remove all/i }).click()

      await expect(row.locator('td').nth(1)).toContainText('-')
    })

    test("Context menu 'Reset to default' resets modified command", async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      const row = panel.commandRow(SINGLE_BINDING_COMMAND)

      await panel.addKeybindingToRow(row, 'Control+Shift+F10')

      await panel.openContextMenu(SINGLE_BINDING_COMMAND)
      await comfyPage.contextMenu.menuItem('Reset to default').click()

      await expect(row.getByRole('button', { name: /Reset/i })).toBeDisabled()
    })

    test('Context menu items disabled when no keybindings', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(NO_BINDING_COMMAND)
      await panel.openContextMenu(NO_BINDING_COMMAND)

      const changeItem = comfyPage.contextMenu.menuItem('Change keybinding')
      const removeItem = comfyPage.contextMenu.menuItem('Remove keybinding')

      await expect(changeItem).toHaveAttribute('data-disabled', '')
      await expect(removeItem).toHaveAttribute('data-disabled', '')

      await panel.page.keyboard.press('Escape')
    })
  })

  test.describe('Action Buttons', () => {
    test('Edit button opens edit dialog for single-binding command', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      const row = panel.commandRow(SINGLE_BINDING_COMMAND)

      const editButton = row.getByRole('button', { name: /^Edit$/i })
      await expect(editButton).toBeVisible()
      await editButton.click()

      const input = panel.keybindingInput
      await expect(input).toBeVisible()

      await panel.cancelKeybinding()
    })

    test('Add button opens add dialog', async ({ comfyPage }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      const row = panel.commandRow(SINGLE_BINDING_COMMAND)

      await row.getByRole('button', { name: /Add new keybinding/i }).click()

      const input = panel.keybindingInput
      await expect(input).toBeVisible()

      await panel.cancelKeybinding()
    })

    test('Reset button is disabled for unmodified commands', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      const row = panel.commandRow(SINGLE_BINDING_COMMAND)

      const resetButton = row.getByRole('button', { name: /Reset/i })
      await expect(resetButton).toBeDisabled()
    })

    test('Reset button resets modified keybinding', async ({ comfyPage }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      const row = panel.commandRow(SINGLE_BINDING_COMMAND)

      await panel.addKeybindingToRow(row, 'Control+Shift+F11')

      const resetButton = row.getByRole('button', { name: /Reset/i })
      await expect(resetButton).toBeEnabled()

      await resetButton.click()

      await expect(resetButton).toBeDisabled()
    })

    test('Delete button is disabled for commands with 0 keybindings', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(NO_BINDING_COMMAND)
      const row = panel.commandRow(NO_BINDING_COMMAND)

      const deleteButton = row.getByRole('button', { name: /Delete/i })
      await expect(deleteButton).toBeDisabled()
    })

    test('Delete button removes single keybinding directly', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(NO_BINDING_COMMAND)
      const row = panel.commandRow(NO_BINDING_COMMAND)

      await panel.addKeybindingToRow(row, 'Control+Shift+F12')

      const deleteButton = row.getByRole('button', { name: /Delete/i })
      await expect(deleteButton).toBeEnabled()
      await deleteButton.click()

      await expect(row.locator('td').nth(1)).toContainText('-')
    })

    test('Delete button on command with 2+ keybindings shows confirm dialog', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(MULTI_BINDING_COMMAND)
      const row = panel.commandRow(MULTI_BINDING_COMMAND)

      const deleteButton = row.getByRole('button', { name: /Delete/i })
      await deleteButton.click()

      const confirmDialog = panel.removeAllDialog
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
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(MULTI_BINDING_COMMAND)

      await panel.commandLabel(MULTI_BINDING_COMMAND).click()
      const expansionContent = panel.expansionContent(MULTI_BINDING_COMMAND)
      await expect(expansionContent).toBeVisible()

      const firstBindingRow = expansionContent
        .getByTestId('keybinding-expansion-binding')
        .first()
      await firstBindingRow.getByRole('button', { name: /^Edit$/i }).click()

      const input = panel.keybindingInput
      await expect(input).toBeVisible()

      await panel.cancelKeybinding()
    })

    test('Delete button in expanded row removes that binding and collapses', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(MULTI_BINDING_COMMAND)

      await panel.commandLabel(MULTI_BINDING_COMMAND).click()
      const expansionContent = panel.expansionContent(MULTI_BINDING_COMMAND)
      await expect(expansionContent).toBeVisible()

      const bindingRows = expansionContent.getByTestId(
        'keybinding-expansion-binding'
      )
      await expect
        .poll(() => bindingRows.count(), {
          message: 'Expected at least 2 bindings'
        })
        .toBeGreaterThanOrEqual(2)
      const initialBindingCount = await bindingRows.count()

      await bindingRows
        .first()
        .getByRole('button', { name: /Remove keybinding/i })
        .click()

      if (initialBindingCount === 2) {
        // Expansion auto-collapses when bindings drop below 2
        await expect(expansionContent).toBeHidden()
      } else {
        await expect(bindingRows).toHaveCount(initialBindingCount - 1)
      }
    })
  })

  test.describe('Reset All', () => {
    test('Reset All button shows confirmation and resets on confirm', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(SINGLE_BINDING_COMMAND)
      const row = panel.commandRow(SINGLE_BINDING_COMMAND)
      await panel.addKeybindingToRow(row, 'Control+Shift+F8')

      await expect(row.getByRole('button', { name: /Reset/i })).toBeEnabled()

      await panel.clearSearch()

      await panel.resetAllButton.click()

      const confirmDialog = panel.resetAllDialog
      await expect(confirmDialog).toBeVisible()
      await expect(confirmDialog).toContainText(/Reset all keybindings/i)

      await confirmDialog.getByRole('button', { name: /Reset All/i }).click()

      await expect(comfyPage.toast.visibleToasts).toHaveCount(1)

      await panel.search(SINGLE_BINDING_COMMAND)
      const rowAfterReset = panel.commandRow(SINGLE_BINDING_COMMAND)
      await expect(
        rowAfterReset.getByRole('button', { name: /Reset/i })
      ).toBeDisabled()
    })

    test('Reset All confirmation can be cancelled', async ({ comfyPage }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.resetAllButton.click()

      const confirmDialog = panel.resetAllDialog
      await expect(confirmDialog).toBeVisible()
      await confirmDialog.getByRole('button', { name: /Cancel/i }).click()

      await expect(confirmDialog).toBeHidden()
    })

    test('Reset All confirmation traps focus and dismisses alone over Settings', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel
      const confirmDialog = panel.resetAllDialog
      const cancel = confirmDialog.getByRole('button', { name: /Cancel/i })
      const confirm = confirmDialog.getByRole('button', { name: /Reset All/i })
      const close = confirmDialog.getByRole('button', { name: 'Close' })

      await test.step('Tab cycles inside the confirmation', async () => {
        await panel.resetAllButton.click()
        await expect(cancel).toBeFocused()
        await panel.page.keyboard.press('Tab')
        await expect(confirm).toBeFocused()
        await panel.page.keyboard.press('Tab')
        await expect(close).toBeFocused()
        await panel.page.keyboard.press('Shift+Tab')
        await expect(confirm).toBeFocused()
      })

      await test.step('Escape closes only the confirmation', async () => {
        await panel.page.keyboard.press('Escape')
        await expect(confirmDialog).toBeHidden()
        await expect(comfyPage.settingDialog.root).toBeVisible()
        await expect(panel.resetAllButton).toBeFocused()
      })

      await test.step('An outside click closes only the confirmation', async () => {
        await panel.resetAllButton.click()
        await expect(confirmDialog).toBeVisible()
        await panel.page.mouse.click(5, 5)
        await expect(confirmDialog).toBeHidden()
        await expect(comfyPage.settingDialog.root).toBeVisible()
        await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
      })
    })
  })

  test.describe('Search Filter', () => {
    test('Typing in search clears expanded rows', async ({ comfyPage }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(MULTI_BINDING_COMMAND)

      await panel.commandLabel(MULTI_BINDING_COMMAND).click()
      const expansionContent = panel.expansionContent(MULTI_BINDING_COMMAND)
      await expect(expansionContent).toBeVisible()

      // Changing the filter triggers watch(filters, ...) which clears expansion
      await panel.search(MULTI_BINDING_COMMAND + ' ')
      await expect(expansionContent).toBeHidden()
    })
  })

  test('Command sort header has no browser button chrome', async ({
    comfyPage
  }) => {
    const { sortButton } = comfyPage.settingDialog.keybindingPanel

    await expect(sortButton).not.toHaveCSS('border-top-style', 'outset')
    await expect(sortButton).not.toHaveCSS(
      'background-color',
      'rgb(107, 107, 107)'
    )
  })

  test.describe('Responsive Layout', () => {
    test('Action buttons stay on screen without horizontal scroll at narrow widths', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(MULTI_BINDING_COMMAND)
      const row = panel.commandRow(MULTI_BINDING_COMMAND)
      await expect(row).toBeVisible()

      await panel.page.setViewportSize({ width: 480, height: 800 })

      await expect(
        row.getByRole('button', { name: /Delete/i })
      ).toBeInViewport()
      await expect(
        row.getByRole('button', { name: /Add new keybinding/i })
      ).toBeInViewport()

      const hasHorizontalScroll = await panel.table.evaluate(
        (el) => el.scrollWidth > el.clientWidth + 1
      )
      expect(hasHorizontalScroll).toBe(false)
    })

    test('Keybinding column compresses with width while actions stay reachable', async ({
      comfyPage
    }) => {
      const panel = comfyPage.settingDialog.keybindingPanel

      await panel.search(MULTI_BINDING_COMMAND)
      const row = panel.commandRow(MULTI_BINDING_COMMAND)
      const keybindingList = row.getByTestId('keybinding-list')
      await expect(keybindingList).toBeVisible()

      const listWidthAt = async (viewportWidth: number) => {
        await panel.page.setViewportSize({ width: viewportWidth, height: 800 })
        return keybindingList.evaluate((el) => el.getBoundingClientRect().width)
      }

      const wideWidth = await listWidthAt(1280)
      const narrowWidth = await listWidthAt(560)

      expect(narrowWidth).toBeLessThan(wideWidth)
      await expect(
        row.getByRole('button', { name: /Delete/i })
      ).toBeInViewport()
    })
  })
})
