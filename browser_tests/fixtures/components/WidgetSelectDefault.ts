import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class WidgetSelectDefaultFixture {
  public readonly trigger: Locator
  public readonly menu: Locator
  public readonly options: Locator

  constructor(
    public readonly root: Locator,
    widgetName?: string
  ) {
    this.trigger = root.getByRole('combobox', { name: widgetName, exact: true })
    this.menu = root.page().getByTestId(TestIds.widgets.selectDefaultViewport)
    this.options = this.menu.getByRole('option')
  }

  async open(): Promise<void> {
    await this.trigger.click()
    await expect(this.menu).toBeVisible()
  }

  async close(): Promise<void> {
    await this.trigger.click()
    await expect(this.menu).toBeHidden()
  }

  async selectOption(name: string): Promise<void> {
    await this.open()
    await this.options.getByText(name, { exact: true }).click()
    await expect(this.menu).toBeHidden()
  }
}
