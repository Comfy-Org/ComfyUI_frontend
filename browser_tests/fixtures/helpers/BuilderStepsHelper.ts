import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'

export class BuilderStepsHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  private get page(): Page {
    return this.comfyPage.page
  }

  /** The builder step toolbar (navigation bar). */
  get toolbar(): Locator {
    return this.page.getByRole('navigation', { name: 'App Builder' })
  }

  /** Click the "Inputs" step in the builder toolbar. */
  async goToInputs() {
    await this.toolbar.getByRole('button', { name: 'Inputs' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Click the "Outputs" step in the builder toolbar. */
  async goToOutputs() {
    await this.toolbar.getByRole('button', { name: 'Outputs' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Click the "Preview" step in the builder toolbar. */
  async goToPreview() {
    await this.toolbar.getByRole('button', { name: 'Preview' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Click the "Next" button in the builder footer. */
  async next() {
    await this.page.getByRole('button', { name: 'Next' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Click the "Back" button in the builder footer. */
  async back() {
    await this.page.getByRole('button', { name: 'Back' }).click()
    await this.comfyPage.nextFrame()
  }
}
