import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class Topbar {
  private readonly menuLocator: Locator
  private readonly menuTrigger: Locator

  constructor(public readonly page: Page) {
    this.menuLocator = page.locator('.comfy-command-menu')
    this.menuTrigger = page.locator('.comfy-menu-button-wrapper')
  }

  async getTabNames(): Promise<string[]> {
    return await this.page
      .locator('.workflow-tabs .workflow-label')
      .allInnerTexts()
  }

  async getActiveTabName(): Promise<string> {
    return this.page
      .locator('.workflow-tabs .p-togglebutton-checked')
      .innerText()
  }

  /**
   * Get a menu item by its label, optionally within a specific parent container
   */
  getMenuItem(itemLabel: string, parent?: Locator): Locator {
    if (parent) {
      return parent.locator(`.p-tieredmenu-item:has-text("${itemLabel}")`)
    }

    return this.page.locator(`.p-menubar-item-label:text-is("${itemLabel}")`)
  }

  /**
   * Get the visible submenu (last visible submenu in case of nested menus)
   */
  getVisibleSubmenu(): Locator {
    return this.page.locator('.p-tieredmenu-submenu:visible').last()
  }

  /**
   * Check if a menu item has an active checkmark
   */
  async isMenuItemActive(menuItem: Locator): Promise<boolean> {
    const checkmark = menuItem.locator('.pi-check')
    const classes = await checkmark.getAttribute('class')
    return classes ? !classes.includes('invisible') : false
  }

  getWorkflowTab(tabName: string): Locator {
    return this.page
      .locator(`.workflow-tabs .workflow-label:has-text("${tabName}")`)
      .locator('..')
  }

  async closeWorkflowTab(tabName: string) {
    const tab = this.getWorkflowTab(tabName)
    await tab.locator('.close-button').click({ force: true })
  }

  getSaveDialog(): Locator {
    return this.page.locator('.p-dialog-content input')
  }

  saveWorkflow(workflowName: string): Promise<void> {
    return this._saveWorkflow(workflowName, 'Save')
  }

  saveWorkflowAs(workflowName: string): Promise<void> {
    return this._saveWorkflow(workflowName, 'Save As')
  }

  exportWorkflow(workflowName: string): Promise<void> {
    return this._saveWorkflow(workflowName, 'Export')
  }

  async _saveWorkflow(
    workflowName: string,
    command: 'Save' | 'Save As' | 'Export'
  ) {
    await this.triggerTopbarCommand(['File', command])
    await this.getSaveDialog().fill(workflowName)
    await this.page.keyboard.press('Enter')

    // Wait for workflow service to finish saving
    await this.page.waitForFunction(
      () => !window['app'].extensionManager.workflow.isBusy,
      undefined,
      { timeout: 3000 }
    )
    // Wait for the dialog to close.
    await this.getSaveDialog().waitFor({ state: 'hidden', timeout: 500 })
  }

  async openTopbarMenu() {
    await this.page.waitForTimeout(1000)
    await this.menuTrigger.click()
    await this.menuLocator.waitFor({ state: 'visible' })
    return this.menuLocator
  }

  /**
   * Close the topbar menu by clicking outside
   */
  async closeTopbarMenu() {
    await this.page.locator('body').click({ position: { x: 300, y: 10 } })
    await expect(this.menuLocator).not.toBeVisible()
  }

  /**
   * Navigate to a submenu by hovering over a menu item
   */
  async openSubmenu(menuItemLabel: string): Promise<Locator> {
    const menuItem = this.getMenuItem(menuItemLabel)
    await menuItem.hover()
    const submenu = this.getVisibleSubmenu()
    await submenu.waitFor({ state: 'visible' })
    return submenu
  }

  /**
   * Get theme menu items and interact with theme switching
   */
  async getThemeMenuItems() {
    const themeSubmenu = await this.openSubmenu('Theme')
    return {
      submenu: themeSubmenu,
      darkTheme: this.getMenuItem('Dark (Default)', themeSubmenu),
      lightTheme: this.getMenuItem('Light', themeSubmenu)
    }
  }

  /**
   * Switch to a specific theme
   */
  async switchTheme(theme: 'dark' | 'light') {
    const { darkTheme, lightTheme } = await this.getThemeMenuItems()
    const themeItem = theme === 'dark' ? darkTheme : lightTheme
    const themeLabel = themeItem.locator('.p-menubar-item-label')
    await themeLabel.click()
  }

  async triggerTopbarCommand(path: string[]) {
    if (path.length < 1) {
      throw new Error('Path cannot be empty')
    }

    const menu = await this.openTopbarMenu()
    const tabName = path[0]
    const topLevelMenuItem = this.getMenuItem(tabName)
    const topLevelMenu = menu
      .locator('.p-tieredmenu-item')
      .filter({ has: topLevelMenuItem })
    await topLevelMenu.waitFor({ state: 'visible' })

    // Handle top-level commands (like "New")
    if (path.length === 1) {
      await topLevelMenuItem.click()
      return
    }

    await topLevelMenu.hover()

    let currentMenu = topLevelMenu
    for (let i = 1; i < path.length; i++) {
      const commandName = path[i]
      const menuItem = currentMenu
        .locator(
          `.p-tieredmenu-submenu .p-tieredmenu-item:has-text("${commandName}")`
        )
        .first()
      await menuItem.waitFor({ state: 'visible' })
      await menuItem.hover()
      currentMenu = menuItem
    }
    await currentMenu.click()
  }
}
