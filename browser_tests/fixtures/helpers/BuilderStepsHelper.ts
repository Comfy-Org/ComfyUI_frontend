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

  get inputsButton(): Locator {
    return this.toolbar.getByRole('button', { name: 'Inputs' })
  }

  get outputsButton(): Locator {
    return this.toolbar.getByRole('button', { name: 'Outputs' })
  }

  get previewButton(): Locator {
    return this.toolbar.getByRole('button', { name: 'Preview' })
  }

  async goToInputs() {
    await this.inputsButton.click()
    await this.comfyPage.nextFrame()
  }

  async goToOutputs() {
    await this.outputsButton.click()
    await this.comfyPage.nextFrame()
  }

  async goToPreview() {
    await this.previewButton.click()
    await this.comfyPage.nextFrame()
  }
}
