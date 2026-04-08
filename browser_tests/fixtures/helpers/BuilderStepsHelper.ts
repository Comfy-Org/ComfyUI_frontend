import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'

export class BuilderStepsHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  private get page(): Page {
    return this.comfyPage.page
  }

  get toolbar(): Locator {
    return this.page.getByRole('navigation', { name: 'App Builder' })
  }

  async goToInputs() {
    await expect(
      this.toolbar.getByRole('button', { name: 'Inputs' })
    ).toBeVisible()
    await this.toolbar.getByRole('button', { name: 'Inputs' }).click()
    await this.comfyPage.nextFrame()
  }

  async goToOutputs() {
    await expect(
      this.toolbar.getByRole('button', { name: 'Outputs' })
    ).toBeVisible()
    await this.toolbar.getByRole('button', { name: 'Outputs' }).click()
    await this.comfyPage.nextFrame()
  }

  async goToPreview() {
    await expect(
      this.toolbar.getByRole('button', { name: 'Preview' })
    ).toBeVisible()
    await this.toolbar.getByRole('button', { name: 'Preview' }).click()
    await this.comfyPage.nextFrame()
  }
}
