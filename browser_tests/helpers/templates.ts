import { Locator, Page } from '@playwright/test'

export class ComfyTemplates {
  readonly content: Locator

  constructor(readonly page: Page) {
    this.content = page.getByTestId('template-workflows-content')
  }

  async loadTemplate(id: string) {
    await this.content.getByTestId(`template-workflow-${id}`).click()
  }
}
