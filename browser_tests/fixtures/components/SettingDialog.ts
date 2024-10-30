import { Page } from '@playwright/test'

export class SettingDialog {
  constructor(public readonly page: Page) {}

  async open() {}
}
