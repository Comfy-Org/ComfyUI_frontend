import type { Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'
import { TestIds } from '../selectors'

export class SettingDialog {
  constructor(
    public readonly page: Page,
    public readonly comfyPage: ComfyPage
  ) {}

  get root() {
    return this.page.getByTestId(TestIds.dialogs.settings)
  }

  async open() {
    await this.comfyPage.executeCommand('Comfy.ShowSettingsDialog')
    await this.root.waitFor({ state: 'visible' })
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
    await this.page.getByTestId('settings-tab-about').click()
    await this.page
      .getByTestId(TestIds.dialogs.about)
      .waitFor({ state: 'visible' })
  }
}
