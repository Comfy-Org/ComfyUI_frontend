import type { Locator, Page } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { TestIds } from '@e2e/fixtures/selectors'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

export class Topbar {
  private readonly menuLocator: Locator
  private readonly menuTrigger: Locator
  readonly newWorkflowButton: Locator
  readonly workflowTabs: Locator
  readonly integratedTabBarActions: Locator
  readonly menuRootList: Locator
  readonly nodes2ToggleItem: Locator

  constructor(public readonly page: Page) {
    this.menuLocator = page.locator('.comfy-command-menu')
    this.menuTrigger = page.locator('.comfy-menu-button-wrapper')
    this.menuRootList = this.menuLocator.locator('.p-tieredmenu-root-list')
    this.nodes2ToggleItem = page.getByTestId(TestIds.topbar.nodes2ToggleItem)
    this.newWorkflowButton = page.locator('.new-blank-workflow-button')
    this.workflowTabs = page.getByTestId(TestIds.topbar.workflowTabs)
    this.integratedTabBarActions = this.workflowTabs.getByTestId(
      TestIds.topbar.integratedTabBarActions
    )
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

  getTab(index: number): Locator {
    return this.page.locator('.workflow-tabs .p-togglebutton').nth(index)
  }

  getActiveTab(): Locator {
    return this.page.locator(
      '.workflow-tabs .p-togglebutton.p-togglebutton-checked'
    )
  }

  async closeWorkflowTab(tabName: string) {
    const tab = this.getWorkflowTab(tabName)
    await tab.hover()
    await tab.locator('.close-button').click()
  }

  getSaveDialog(): Locator {
    return this.page.getByRole('dialog').getByRole('textbox')
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
      () => !(window.app!.extensionManager as WorkspaceStore).workflow.isBusy,
      undefined,
      { timeout: 3000 }
    )
    // Wait for the dialog to close.
    await this.getSaveDialog().waitFor({ state: 'hidden' })

    // Check if a confirmation dialog appeared (e.g., "Overwrite existing file?")
    // If so, return early to let the test handle the confirmation
    const confirmationDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: 'Overwrite' })
    if (await confirmationDialog.isVisible()) {
      return
    }
  }

  async openTopbarMenu() {
    // If menu is already open, close it first to reset state
    const isAlreadyOpen = await this.menuLocator.isVisible()
    if (isAlreadyOpen) {
      await this.closeTopbarMenu()
    }

    await this.menuTrigger.click()
    await this.menuLocator.waitFor({ state: 'visible' })
    return this.menuLocator
  }

  async closeTopbarMenu() {
    await this.page.keyboard.press('Escape')
    await this.menuLocator.waitFor({ state: 'hidden' })
  }

  /**
   * Set Nodes 2.0 on or off via the Comfy logo menu switch (no-op if already
   * in the requested state).
   */
  async setVueNodesEnabled(enabled: boolean) {
    await this.openTopbarMenu()
    const nodes2Switch = this.page.getByRole('switch', { name: 'Nodes 2.0' })
    await nodes2Switch.waitFor({ state: 'visible' })
    if ((await nodes2Switch.isChecked()) !== enabled) {
      await nodes2Switch.click()
      await this.page.waitForFunction(
        (wantEnabled) =>
          window.app!.ui.settings.getSettingValue('Comfy.VueNodes.Enabled') ===
          wantEnabled,
        enabled,
        { timeout: 5000 }
      )
    }
    await this.closeTopbarMenu()
    await new VueNodeHelpers(this.page).waitForNodes()
  }

  /**
   * Give the open menu keyboard focus, then walk ArrowDown until `itemLabel` is
   * the active descendant. Throws if the item is never reached.
   */
  async focusMenuItem(itemLabel: string): Promise<void> {
    await this.menuRootList.waitFor({ state: 'visible' })
    await this.menuRootList.focus()

    const itemCount = await this.menuRootList
      .locator('> .p-tieredmenu-item')
      .count()

    for (let step = 0; step < itemCount; step++) {
      await this.page.keyboard.press('ArrowDown')
      if ((await this.getFocusedMenuItemLabel()) === itemLabel) return
    }

    throw new Error(
      `Could not reach the "${itemLabel}" menu item with the keyboard`
    )
  }

  /**
   * Click the gap between the Nodes 2.0 label and its switch — the part of the
   * row that was inert before it became a click target. A plain click on the
   * row lands on the label instead and proves nothing.
   */
  async clickNodes2RowBody(): Promise<void> {
    const label = this.nodes2ToggleItem.locator('.p-menubar-item-label')
    const toggle = this.nodes2ToggleItem.getByRole('switch')
    const [labelBox, toggleBox, rowBox] = await Promise.all([
      label.boundingBox(),
      toggle.boundingBox(),
      this.nodes2ToggleItem.boundingBox()
    ])
    if (!labelBox || !toggleBox || !rowBox) {
      throw new Error('The Nodes 2.0 row is not laid out')
    }

    const gapStart = labelBox.x + labelBox.width
    if (toggleBox.x - gapStart < 4) {
      throw new Error('The Nodes 2.0 row has no gap between label and switch')
    }
    await this.page.mouse.click(
      (gapStart + toggleBox.x) / 2,
      rowBox.y + rowBox.height / 2
    )
  }

  async getFocusedMenuItemLabel(): Promise<string | null> {
    const focusedItemId = await this.menuRootList.getAttribute(
      'aria-activedescendant'
    )
    if (!focusedItemId) return null

    const label = this.page.locator(`#${focusedItemId} .p-menubar-item-label`)
    if ((await label.count()) === 0) return null
    return (await label.first().innerText()).trim()
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

    // Hover over top-level menu with retry logic for flaky submenu appearance
    const submenu = this.getVisibleSubmenu()
    try {
      await submenu.waitFor({ state: 'visible', timeout: 1000 })
    } catch {
      // Click outside to reset, then reopen menu
      await this.page.locator('body').click({ position: { x: 500, y: 300 } })
      await this.menuLocator.waitFor({ state: 'hidden', timeout: 1000 })
      await this.menuTrigger.click()
      await this.menuLocator.waitFor({ state: 'visible' })
      // Re-hover on top-level menu to trigger submenu
      await topLevelMenu.hover()
      await submenu.waitFor({ state: 'visible', timeout: 1000 })
    }

    let currentMenu = topLevelMenu
    for (let i = 1; i < path.length; i++) {
      const commandName = path[i]
      const menuItem = submenu
        .locator(`.p-tieredmenu-item:has-text("${commandName}")`)
        .first()
      await menuItem.waitFor({ state: 'visible' })

      // For the last item, click it
      if (i === path.length - 1) {
        await menuItem.click()
        return
      }

      // Otherwise, hover to open nested submenu
      await menuItem.hover()
      currentMenu = menuItem
    }
    await currentMenu.click()
  }
}
