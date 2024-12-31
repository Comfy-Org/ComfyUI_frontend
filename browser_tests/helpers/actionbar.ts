import type { Locator, Page } from '@playwright/test'

import type { AutoQueueMode } from '../../src/stores/queueStore'

export class ComfyActionbar {
  public readonly root: Locator
  public readonly queueButton: ComfyQueueButton

  constructor(public readonly page: Page) {
    this.root = page.locator('.actionbar')
    this.queueButton = new ComfyQueueButton(this)
  }

  async isDocked() {
    const className = await this.root.getAttribute('class')
    return className?.includes('is-docked') ?? false
  }
}

class ComfyQueueButton {
  public readonly root: Locator
  public readonly primaryButton: Locator
  public readonly dropdownButton: Locator
  constructor(public readonly actionbar: ComfyActionbar) {
    this.root = actionbar.root.getByTestId('queue-button')
    this.primaryButton = this.root.locator('.p-splitbutton-button')
    this.dropdownButton = this.root.locator('.p-splitbutton-dropdown')
  }

  public async toggleOptions() {
    await this.dropdownButton.click()
    return new ComfyQueueButtonOptions(this.actionbar.page)
  }
}

class ComfyQueueButtonOptions {
  constructor(public readonly page: Page) {}

  public async setMode(mode: AutoQueueMode) {
    await this.page.evaluate((mode) => {
      window['app'].extensionManager.queueSettings.mode = mode
    }, mode)
  }

  public async getMode() {
    return await this.page.evaluate(() => {
      return window['app'].extensionManager.queueSettings.mode
    })
  }
}
