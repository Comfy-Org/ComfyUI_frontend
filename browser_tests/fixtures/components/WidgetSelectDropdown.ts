import type { Locator } from '@playwright/test'

export class WidgetSelectDropdownFixture {
  public readonly selection: Locator

  constructor(public readonly root: Locator) {
    this.selection = root.locator('button span span')
  }
  async selectedItem(): Promise<string> {
    return await this.selection.innerText()
  }
}
