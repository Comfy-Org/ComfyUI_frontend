import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

export class BuilderFooterHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  private get page(): Page {
    return this.comfyPage.page
  }

  get nav(): Locator {
    return this.page.getByTestId(TestIds.builder.footerNav)
  }

  get exitButton(): Locator {
    return this.buttonByName('Exit app builder')
  }

  get nextButton(): Locator {
    return this.buttonByName('Next')
  }

  get backButton(): Locator {
    return this.buttonByName('Back')
  }

  get saveButton(): Locator {
    return this.page.getByTestId(TestIds.builder.saveButton)
  }

  get saveGroup(): Locator {
    return this.page.getByTestId(TestIds.builder.saveGroup)
  }

  get saveAsButton(): Locator {
    return this.page.getByTestId(TestIds.builder.saveAsButton)
  }

  get saveAsChevron(): Locator {
    return this.page.getByTestId(TestIds.builder.saveAsChevron)
  }

  get opensAsPopover(): Locator {
    return this.page.getByTestId(TestIds.builder.opensAs)
  }

  private buttonByName(name: string): Locator {
    return this.nav.getByRole('button', { name })
  }

  async next() {
    await this.nextButton.click()
    await this.comfyPage.nextFrame()
  }

  async back() {
    await this.backButton.click()
    await this.comfyPage.nextFrame()
  }

  async exitBuilder() {
    await this.exitButton.click()
    await this.comfyPage.nextFrame()
  }

  async openSaveAsFromChevron() {
    await this.saveAsChevron.click()
    await this.page.getByRole('menuitem', { name: 'Save as' }).click()
    await this.comfyPage.nextFrame()
  }
}
