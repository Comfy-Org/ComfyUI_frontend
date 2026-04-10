import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export class ContextMenu {
  constructor(public readonly page: Page) {}

  get primeVueMenu() {
    return this.page.locator('.p-contextmenu, .p-menu')
  }

  get litegraphMenu() {
    return this.page.locator('.litemenu')
  }

  get menuItems() {
    return this.page.locator('.p-menuitem, .litemenu-entry')
  }

  async clickMenuItem(name: string): Promise<void> {
    await this.page.getByRole('menuitem', { name }).click()
  }

  async clickMenuItemExact(name: string): Promise<void> {
    await this.page.getByRole('menuitem', { name, exact: true }).click()
  }

  async clickLitegraphMenuItem(name: string): Promise<void> {
    await this.page.locator(`.litemenu-entry:has-text("${name}")`).click()
  }

  async isVisible(): Promise<boolean> {
    const primeVueVisible = await this.primeVueMenu
      .isVisible()
      .catch(() => false)
    const litegraphVisible = await this.litegraphMenu
      .isVisible()
      .catch(() => false)
    return primeVueVisible || litegraphVisible
  }

  async assertHasItems(items: string[]): Promise<void> {
    for (const item of items) {
      await expect
        .soft(this.page.getByRole('menuitem', { name: item }))
        .toBeVisible()
    }
  }

  async openFor(locator: Locator): Promise<this> {
    await locator.click({ button: 'right' })
    await expect.poll(() => this.isVisible()).toBe(true)
    return this
  }

  /**
   * Select a Vue node by clicking its header, then right-click to open
   * the context menu. Vue nodes require a selection click before the
   * right-click so the correct per-node menu items appear.
   */
  async openForVueNode(header: Locator): Promise<this> {
    await header.click()
    await header.click({ button: 'right' })
    await this.primeVueMenu.waitFor({ state: 'visible' })
    return this
  }

  async waitForHidden(): Promise<void> {
    await Promise.all([
      this.primeVueMenu.waitFor({ state: 'hidden' }),
      this.litegraphMenu.waitFor({ state: 'hidden' })
    ])
  }
}
