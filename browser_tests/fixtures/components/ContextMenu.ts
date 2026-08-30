import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export class ContextMenu {
  public readonly applicationMenu: Locator
  public readonly litegraphMenu: Locator
  public readonly litegraphContextMenu: Locator
  public readonly menuItems: Locator
  protected readonly anyMenu: Locator

  constructor(public readonly page: Page) {
    this.applicationMenu = page.locator('[role="menu"]:visible')
    this.litegraphMenu = page.locator('.litemenu')
    this.litegraphContextMenu = page.locator('.litecontextmenu')
    this.menuItems = page
      .getByRole('menuitem')
      .or(page.locator('.litemenu-entry'))
    this.anyMenu = this.applicationMenu
      .or(this.litegraphMenu)
      .or(this.litegraphContextMenu)
  }

  async clickMenuItem(name: string): Promise<void> {
    await this.page.getByRole('menuitem', { name }).click()
  }

  async clickMenuItemExact(name: string): Promise<void> {
    await this.page.getByRole('menuitem', { name, exact: true }).click()
    await this.waitForHidden()
  }

  menuItem(name: string): Locator {
    return this.anyMenu.getByRole('menuitem', { name, exact: true })
  }

  /**
   * Click a litegraph menu entry. Selects the most recently opened matching
   * entry so nested submenu items can be reached without being shadowed by
   * the parent menu still visible behind them.
   */
  async clickLitegraphMenuItem(name: string): Promise<void> {
    await this.page
      .locator('.litemenu-entry:visible', { hasText: name })
      .last()
      .click()
  }

  async isVisible(): Promise<boolean> {
    return await this.anyMenu.isVisible()
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
    await expect(this.anyMenu).toBeVisible()
    return this
  }

  async openForDisabledElement(locator: Locator): Promise<this> {
    await locator.dispatchEvent('contextmenu', { button: 2 })
    await expect(this.anyMenu).toBeVisible()
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
    await this.applicationMenu.waitFor({ state: 'visible' })
    return this
  }

  async waitForHidden(): Promise<void> {
    await Promise.all([
      this.applicationMenu.waitFor({ state: 'hidden' }),
      this.litegraphMenu.waitFor({ state: 'hidden' }),
      this.litegraphContextMenu.waitFor({ state: 'hidden' })
    ])
  }
}
