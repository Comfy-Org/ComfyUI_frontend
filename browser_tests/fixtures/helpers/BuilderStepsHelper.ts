import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class BuilderStepsHelper {
  public readonly toolbar: Locator

  constructor(private readonly comfyPage: ComfyPage) {
    this.toolbar = this.page.getByRole('navigation', { name: 'App Builder' })
  }

  private get page(): Page {
    return this.comfyPage.page
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
