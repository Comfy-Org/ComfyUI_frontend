import type { Page } from '@playwright/test'

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

  async waitForHidden(): Promise<void> {
    await Promise.all([
      this.primeVueMenu.waitFor({ state: 'hidden' }).catch(() => {}),
      this.litegraphMenu.waitFor({ state: 'hidden' }).catch(() => {})
    ])
  }
}
