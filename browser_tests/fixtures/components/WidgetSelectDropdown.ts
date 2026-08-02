import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class WidgetSelectDropdownFixture {
  public readonly selection: Locator
  public readonly trigger: Locator

  constructor(
    public readonly root: Locator,
    trigger?: Locator
  ) {
    this.trigger = trigger ?? root.locator('button:has(> span)').first()
    this.selection = this.trigger.locator('span span')
  }

  static fromTrigger(trigger: Locator): WidgetSelectDropdownFixture {
    return new WidgetSelectDropdownFixture(trigger, trigger)
  }

  async open(): Promise<void> {
    await this.trigger.click()
  }

  async selectOption(name: string): Promise<void> {
    await this.open()
    const menu = this.root.page().getByTestId(TestIds.widgets.formDropdownMenu)
    await expect(menu).toBeVisible()
    await menu.getByText(name, { exact: true }).click()
    await expect(menu).toBeHidden()
    await expect(this.selection).toHaveText(name)
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
