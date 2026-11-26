import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class WidgetSelectDropdownFixture {
  public readonly selection: Locator
  public readonly trigger: Locator
  public readonly menu: Locator
  public readonly popover: Locator

  constructor(
    public readonly root: Locator,
    trigger?: Locator
  ) {
    this.trigger = trigger ?? root.locator('button:has(> span)').first()
    this.selection = this.trigger.locator('span span')
    const page = root.page()
    this.menu = page.getByTestId(TestIds.widgets.formDropdownMenu)
    this.popover = page.getByRole('dialog').filter({ has: this.menu })
  }

  static fromTrigger(trigger: Locator): WidgetSelectDropdownFixture {
    return new WidgetSelectDropdownFixture(trigger, trigger)
  }

  async open(): Promise<void> {
    await this.trigger.click()
  }

  async selectOption(name: string): Promise<void> {
    await this.open()
    await expect(this.menu).toBeVisible()
    await this.menu.getByText(name, { exact: true }).click()
    await expect(this.menu).toBeHidden()
  }

  async popoverScrolls(): Promise<boolean> {
    return this.popover.evaluate(
      (el) =>
        el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth
    )
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
