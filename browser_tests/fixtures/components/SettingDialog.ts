import type { Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'

export class SettingDialog {
  constructor(
    public readonly page: Page,
    public readonly comfyPage: ComfyPage
  ) {}

  get root() {
    return this.page.locator('[data-testid="settings-dialog"]')
  }

  async open() {
    await this.comfyPage.executeCommand('Comfy.ShowSettingsDialog')
    await this.page.waitForSelector('[data-testid="settings-dialog"]')
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

  async goToAboutPanel() {
    const aboutButton = this.root.locator('nav [role="button"]', {
      hasText: 'About'
    })
    await aboutButton.click()
    await this.page.waitForSelector('.about-container')
  }
}
