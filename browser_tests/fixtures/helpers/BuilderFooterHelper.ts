import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

export class BuilderFooterHelper {
  public readonly nav: Locator
  public readonly exitButton: Locator
  public readonly nextButton: Locator
  public readonly backButton: Locator
  public readonly saveButton: Locator
  public readonly saveAsButton: Locator
  public readonly opensAsPopover: Locator

  constructor(private readonly comfyPage: ComfyPage) {
    this.nav = this.page.getByTestId(TestIds.builder.footerNav)
    this.exitButton = this.buttonByName('Exit app builder')
    this.nextButton = this.buttonByName('Next')
    this.backButton = this.buttonByName('Back')
    this.saveButton = this.page.getByTestId(TestIds.builder.saveButton)
    this.saveAsButton = this.page.getByTestId(TestIds.builder.saveAsButton)
    this.opensAsPopover = this.page.getByTestId(TestIds.builder.opensAs)
  }

  private get page(): Page {
    return this.comfyPage.page
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
}
