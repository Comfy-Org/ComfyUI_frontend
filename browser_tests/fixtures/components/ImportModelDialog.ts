import { Page } from '@playwright/test'

export class ImportModelDialog {
  constructor(public readonly page: Page) {}

  get rootEl() {
    return this.page.locator('div[aria-labelledby="global-import-model"]')
  }

  get modelTypeInput() {
    return this.rootEl.locator('#model-type')
  }

  get importButton() {
    return this.rootEl.getByLabel('Import')
  }
}
