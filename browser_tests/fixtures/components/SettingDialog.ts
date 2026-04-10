import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

export class SettingDialog extends BaseDialog {
  public readonly searchBox: Locator
  public readonly categories: Locator
  public readonly contentArea: Locator

  constructor(
    page: Page,
    public readonly comfyPage: ComfyPage
  ) {
    super(page, TestIds.dialogs.settings)
    this.searchBox = this.root.getByPlaceholder(/Search/)
    this.categories = this.root.locator('nav').getByRole('button')
    this.contentArea = this.root.getByRole('main')
  }

  async open() {
    await this.comfyPage.command.executeCommand('Comfy.ShowSettingsDialog')
    await this.waitForVisible()
  }

  /**
   * Set the value of a text setting
   * @param id - The id of the setting
   * @param value - The value to set
   */
  async setStringSetting(id: string, value: string) {
    const settingInputDiv = this.root.locator(`div[id="${id}"]`)
    await settingInputDiv.locator('input').fill(value)
  }

  /**
   * Toggle the value of a boolean setting
   * @param id - The id of the setting
   */
  async toggleBooleanSetting(id: string) {
    const settingInputDiv = this.root.locator(`div[id="${id}"]`)
    await settingInputDiv.locator('input').click()
  }

  category(name: string) {
    return this.root.locator('nav').getByRole('button', { name })
  }

  async goToAboutPanel() {
    const aboutButton = this.root.locator('nav').getByRole('button', {
      name: 'About'
    })
    await aboutButton.click()
    await this.page.waitForSelector('.about-container')
  }
}
