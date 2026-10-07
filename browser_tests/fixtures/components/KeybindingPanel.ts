import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class KeybindingPanel {
  public readonly editDialog: Locator
  public readonly keybindingInput: Locator
  public readonly removeAllDialog: Locator
  public readonly resetAllButton: Locator
  public readonly resetAllDialog: Locator
  public readonly root: Locator
  public readonly searchInput: Locator
  public readonly sortButton: Locator
  public readonly table: Locator

  constructor(
    public readonly page: Page,
    private readonly comfyPage: ComfyPage
  ) {
    this.editDialog = this.page.getByRole('dialog', {
      name: /Modify keybinding/i
    })
    this.keybindingInput = this.editDialog.locator('input[autofocus]')
    this.removeAllDialog = this.page.getByRole('dialog', {
      name: /Remove all keybindings/i
    })
    this.root = this.page.locator('.keybinding-panel')
    this.resetAllButton = this.root.getByRole('button', { name: /Reset All/i })
    this.resetAllDialog = this.page.getByRole('dialog', {
      name: /Reset all keybindings/i
    })
    this.searchInput = this.page.getByPlaceholder('Search Keybindings...')
    this.sortButton = this.page
      .getByRole('columnheader', { name: 'Command' })
      .getByRole('button', { name: 'Command' })
    this.table = this.page.getByTestId('keybinding-table-container')
  }

  commandLabel(commandId: string): Locator {
    return this.root.locator(`[title="${commandId}"]`)
  }

  commandRow(commandId: string): Locator {
    return this.root
      .locator('tr')
      .filter({ has: this.page.locator(`[title="${commandId}"]`) })
  }

  expansionContent(commandId: string): Locator {
    return this.commandRow(commandId)
      .locator('xpath=following-sibling::tr[1]')
      .getByTestId('keybinding-expansion-content')
  }

  async registerCommand(commandId: string) {
    await this.page.evaluate((id) => {
      window.app!.registerExtension({
        name: 'TestExtension.KeybindingPanelE2E',
        commands: [{ id, function: () => {} }]
      })
    }, commandId)
  }

  async search(query: string) {
    await this.searchInput.fill(query)
  }

  async clearSearch() {
    await this.searchInput.clear()
  }

  async openContextMenu(
    commandId: string,
    position?: { x: number; y: number }
  ) {
    await this.commandLabel(commandId).click({ button: 'right', position })
    await expect(
      this.comfyPage.contextMenu.menuItem('Change keybinding')
    ).toBeVisible()
  }

  async pressCombo(combo: string) {
    await expect(this.keybindingInput).toBeFocused()
    await this.keybindingInput.press(combo)
  }

  async saveKeybinding() {
    await this.editDialog.getByRole('button', { name: /Save/i }).click()
    await expect(this.editDialog).toBeHidden()
  }

  async cancelKeybinding() {
    await this.editDialog.getByRole('button', { name: /Cancel/i }).click()
    await expect(this.editDialog).toBeHidden()
  }

  async addKeybindingToRow(row: Locator, combo: string) {
    await row.getByRole('button', { name: /Add new keybinding/i }).click()
    await this.pressCombo(combo)
    await this.saveKeybinding()
  }
}
