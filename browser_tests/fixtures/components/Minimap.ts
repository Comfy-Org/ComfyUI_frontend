import type { Locator, Page } from '@playwright/test'

export class Minimap {
  constructor(public readonly page: Page) {}

  get mainContainer(): Locator {
    return this.page.locator('.minimap-main-container')
  }

  get container(): Locator {
    return this.page.locator('.litegraph-minimap')
  }

  get canvas(): Locator {
    return this.container.locator('.minimap-canvas')
  }

  get viewport(): Locator {
    return this.container.locator('.minimap-viewport')
  }

  get settingsButton(): Locator {
    return this.container.getByRole('button').first()
  }

  get closeButton(): Locator {
    return this.container.getByTestId('close-minmap-button')
  }

  async clickCanvas(options?: Parameters<Locator['click']>[0]): Promise<void> {
    await this.canvas.click(options)
  }

  async clickSettingsButton(): Promise<void> {
    await this.settingsButton.click()
  }

  async close(): Promise<void> {
    await this.closeButton.click()
  }
}
