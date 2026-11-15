import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class WidgetSelectDefaultFixture {
  public readonly trigger: Locator
  public readonly menu: Locator
  public readonly options: Locator
  public readonly searchInput: Locator
  public readonly folderLock: Locator
  public readonly previous: Locator
  public readonly next: Locator

  constructor(
    public readonly root: Locator,
    widgetName?: string
  ) {
    this.trigger = root.getByRole('combobox', { name: widgetName, exact: true })
    this.menu = root.page().getByTestId(TestIds.widgets.selectDefaultViewport)
    this.options = this.menu.getByRole('option')
    this.searchInput = root
      .page()
      .getByTestId(TestIds.widgets.selectDefaultSearchInput)
    this.folderLock = root
      .page()
      .getByRole('button', { name: /^(Lock|Unlock) folder:/ })
    this.previous = root.getByRole('button', {
      name: `${widgetName}: Previous`,
      exact: true
    })
    this.next = root.getByRole('button', {
      name: `${widgetName}: Next`,
      exact: true
    })
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
    if (await this.searchInput.isVisible()) await this.searchInput.fill(name)
    await this.options.getByText(name, { exact: true }).click()
    await expect(this.menu).toBeHidden()
  }
}
