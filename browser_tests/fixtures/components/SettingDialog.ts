import { Page } from '@playwright/test'

import { ComfyPage } from '../ComfyPage'

export class SettingDialog {
  constructor(
    public readonly page: Page,
    public readonly comfyPage: ComfyPage
  ) {}

  get root() {
    return this.page.locator('div.settings-container')
  }

  async open() {
    await this.comfyPage.executeCommand('Comfy.ShowSettingsDialog')
    await this.page.waitForSelector('div.settings-container')
  }

  /**
   * Set the value of a text setting
   * @param id - The id of the setting
   * @param value - The value to set
   */
  async setStringSetting(id: string, value: string) {
    const settingInputDiv = this.page.locator(
      `div.settings-container div[id="${id}"]`
    )
    await settingInputDiv.locator('input').fill(value)
  }

  /**
   * Toggle the value of a boolean setting
   * @param id - The id of the setting
   */
  async toggleBooleanSetting(id: string) {
    const settingInputDiv = this.page.locator(
      `div.settings-container div[id="${id}"]`
    )
    await settingInputDiv.locator('input').click()
  }

  async goToAboutPanel() {
    const aboutButton = this.page.locator('li[aria-label="About"]')
    await aboutButton.click()
    await this.page.waitForSelector('div.about-container')
  }
}
