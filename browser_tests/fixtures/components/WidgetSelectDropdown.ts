import type { Locator } from '@playwright/test'

export class WidgetSelectDropdownFixture {
  public readonly selection: Locator
  public readonly trigger: Locator

  constructor(public readonly root: Locator) {
    this.trigger = root.locator('button:has(> span)').first()
    this.selection = root.locator('button span span')
  }

  async open(): Promise<void> {
    await this.trigger.click()
  }

  async searchAndSelectTop(popover: Locator, query: string): Promise<void> {
    await this.open()
    const searchInput = popover.getByRole('textbox')
    await searchInput.fill(query)
    await searchInput.press('Enter')
  }

  async selectedItem(): Promise<string> {
    return await this.selection.innerText()
  }
}
