import type { Locator, Page } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { TestIds } from '@e2e/fixtures/selectors'
import { comfyExpect as expect } from '@e2e/fixtures/utils/customMatchers'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

export class Topbar {
  private readonly menuLocator: Locator
  private readonly menuTrigger: Locator
  readonly newWorkflowButton: Locator
  readonly workflowTabs: Locator
  readonly tabs: Locator
  readonly integratedTabBarActions: Locator
  readonly menuRootList: Locator

  constructor(public readonly page: Page) {
    this.menuLocator = page.locator('.comfy-command-menu')
    this.menuTrigger = page.getByTestId('comfy-menu-button')
    this.menuRootList = this.menuLocator
    this.newWorkflowButton = page.locator('.new-blank-workflow-button')
    this.workflowTabs = page.getByTestId(TestIds.topbar.workflowTabs)
    this.tabs = this.workflowTabs.getByTestId(TestIds.topbar.workflowTab)
    this.integratedTabBarActions = this.workflowTabs.getByTestId(
      TestIds.topbar.integratedTabBarActions
    )
  }

  async getTabNames(): Promise<string[]> {
    return await this.tabs.locator('.workflow-label').allInnerTexts()
  }

  async getActiveTabName(): Promise<string> {
    return this.getActiveTab().innerText()
  }

  /**
   * Get a menu item by its label, optionally within a specific parent container
   */
  getMenuItem(itemLabel: string, parent?: Locator): Locator {
    return (parent ?? this.menuLocator).getByRole('menuitem', {
      name: itemLabel,
      exact: true
    })
  }

  /**
   * Get the visible submenu (last visible submenu in case of nested menus)
   */
  getVisibleSubmenu(): Locator {
    return this.page.locator('[role="menu"]:visible').last()
  }

  /**
   * Check if a menu item has an active checkmark
   */
  async isMenuItemActive(menuItem: Locator): Promise<boolean> {
    const checkmark = menuItem.locator('.pi-check')
    const classes = await checkmark.getAttribute('class')
    return classes ? !classes.includes('invisible') : false
  }

  getWorkflowTabLabel(tabName: string): Locator {
    return this.getWorkflowTab(tabName).locator('.workflow-label')
  }

  getWorkflowTab(tabName: string): Locator {
    return this.tabs.filter({
      has: this.page.getByText(tabName, { exact: true })
    })
  }

  getTab(index: number): Locator {
    return this.tabs.nth(index)
  }

  /**
   * Opens a second, blank workflow tab and returns to the first one — the
   * lever agent tab-switch specs use to force the agent CRDT follower to
   * unbind and rebind against the original workflow.
   */
  async openBlankTabAndReturn(): Promise<void> {
    await expect(this.tabs).toHaveCount(1)
    await this.newWorkflowButton.click()
    await expect(this.tabs).toHaveCount(2)
    await expect(this.getTab(1).and(this.getActiveTab())).toBeVisible()
    await expect(this.page.getByTestId('node-title')).toHaveCount(0)
    await this.getTab(0).click()
    await expect(this.getTab(0).and(this.getActiveTab())).toBeVisible()
    await expect(this.getTab(1).and(this.getActiveTab())).toHaveCount(0)
  }

  getActiveTab(): Locator {
    return this.tabs.filter({
      has: this.page.getByRole('tab', { selected: true })
    })
  }

  async closeWorkflowTab(tabName: string) {
    const tab = this.getWorkflowTab(tabName)
    await tab.hover()
    await tab.getByTestId(TestIds.topbar.closeWorkflowButton).click()
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

  async dismissWorkflowPopover() {
    await this.page.mouse.move(0, 0)
    await expect(
      this.page.locator('.workflow-popover-fade').filter({ visible: true })
    ).toHaveCount(0)
  }

  async openTopbarMenu() {
    await this.dismissWorkflowPopover()
    if (await this.menuLocator.isVisible()) return this.menuLocator

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
    const nodes2Toggle = this.page.getByRole('menuitemcheckbox', {
      name: 'Nodes 2.0'
    })
    await nodes2Toggle.waitFor({ state: 'visible' })
    if ((await nodes2Toggle.isChecked()) !== enabled) {
      await nodes2Toggle.click()
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

  async focusMenuItem(itemLabel: string): Promise<void> {
    const items = this.menuRootList.locator('[role^="menuitem"]')
    const itemCount = await items.count()

    for (let step = 0; step < itemCount; step++) {
      if ((await this.getFocusedMenuItemLabel()) === itemLabel) return
      await this.page.keyboard.press('ArrowDown')
    }

    throw new Error(
      `Could not reach the "${itemLabel}" menu item with the keyboard`
    )
  }

  private async getFocusedMenuItemLabel(): Promise<string | null> {
    const focusedItem = this.menuRootList.locator('[role^="menuitem"]:focus')
    if ((await focusedItem.count()) === 0) return null
    return (
      (await focusedItem.getAttribute('aria-label')) ??
      (await focusedItem.innerText()).trim()
    )
  }

  /**
   * Navigate to a submenu by hovering over a menu item
   */
  async openSubmenu(menuItemLabel: string): Promise<Locator> {
    const menuItem = this.getMenuItem(menuItemLabel)
    await menuItem.hover()
    const submenuId = await menuItem.getAttribute('aria-controls')
    if (!submenuId) {
      throw new Error(`Menu item "${menuItemLabel}" has no submenu`)
    }
    const submenu = this.page.locator(`#${submenuId}`)
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
    await themeItem.click()
  }

  async triggerTopbarCommand(path: string[]) {
    if (path.length < 1) {
      throw new Error('Path cannot be empty')
    }

    const menu = await this.openTopbarMenu()
    const tabName = path[0]
    const topLevelMenuItem = this.getMenuItem(tabName, menu)
    await topLevelMenuItem.waitFor({ state: 'visible' })

    // Handle top-level commands (like "New")
    if (path.length === 1) {
      await topLevelMenuItem.click()
      return
    }

    let submenu: Locator
    try {
      submenu = await this.openSubmenu(tabName)
    } catch {
      await this.page.locator('body').click({ position: { x: 500, y: 300 } })
      await this.menuLocator.waitFor({ state: 'hidden', timeout: 1000 })
      await this.menuLocator.waitFor({ state: 'detached', timeout: 1000 })
      await this.menuTrigger.click()
      await this.menuLocator.waitFor({ state: 'visible' })
      submenu = await this.openSubmenu(tabName)
    }

    for (let i = 1; i < path.length; i++) {
      const commandName = path[i]
      const menuItem = submenu.getByRole('menuitem', {
        name: commandName,
        exact: true
      })
      await menuItem.waitFor({ state: 'visible' })

      // For the last item, click it
      if (i === path.length - 1) {
        await menuItem.click()
        return
      }

      await menuItem.hover()
      const submenuId = await menuItem.getAttribute('aria-controls')
      if (!submenuId) {
        throw new Error(`Menu item "${commandName}" has no submenu`)
      }
      submenu = this.page.locator(`#${submenuId}`)
      await submenu.waitFor({ state: 'visible' })
    }
  }
}
