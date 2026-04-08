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
    await expect(this.page.getByRole('menuitem', { name })).toBeVisible()
    await this.page.getByRole('menuitem', { name }).click()
  }

  async clickMenuItemExact(name: string): Promise<void> {
    await expect(
      this.page.getByRole('menuitem', { name, exact: true })
    ).toBeVisible()
    await this.page.getByRole('menuitem', { name, exact: true }).click()
  }

  async clickLitegraphMenuItem(name: string): Promise<void> {
    await expect(
      this.page.locator(`.litemenu-entry:has-text("${name}")`)
    ).toBeVisible()
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
    await expect(locator).toBeVisible()
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
    await expect(header).toBeVisible()
    await header.click()
    await header.click({ button: 'right' })
    await this.primeVueMenu.waitFor({ state: 'visible' })
    return this
  }

  async waitForHidden(): Promise<void> {
    const waitIfExists = async (locator: Locator, menuName: string) => {
      const count = await locator.count()
      if (count > 0) {
        await locator.waitFor({ state: 'hidden' }).catch((error: Error) => {
          console.warn(
            `[waitForHidden] ${menuName} waitFor failed:`,
            error.message
          )
        })
      }
    }

    await Promise.all([
      waitIfExists(this.primeVueMenu, 'primeVueMenu'),
      waitIfExists(this.litegraphMenu, 'litegraphMenu')
    ])
  }
}
