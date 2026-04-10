import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class BuilderStepsHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  private get page(): Page {
    return this.comfyPage.page
  }

  get toolbar(): Locator {
    return this.page.getByRole('navigation', { name: 'App Builder' })
  }

  async goToInputs() {
    await this.toolbar.getByRole('button', { name: 'Inputs' }).click()
    await this.comfyPage.nextFrame()
  }

  async goToOutputs() {
    await this.toolbar.getByRole('button', { name: 'Outputs' }).click()
    await this.comfyPage.nextFrame()
  }

  async goToPreview() {
    await this.toolbar.getByRole('button', { name: 'Preview' }).click()
    await this.comfyPage.nextFrame()
  }
}
