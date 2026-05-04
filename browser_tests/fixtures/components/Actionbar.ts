import type { Locator, Page } from '@playwright/test'

import type { AutoQueueMode } from '@/stores/queueStore'
import { TestIds } from '@e2e/fixtures/selectors'
import type { WorkspaceStore } from '@e2e/types/globals'

export class ComfyActionbar {
  public readonly root: Locator
  public readonly queueButton: ComfyQueueButton
  public readonly propertiesButton: Locator

  constructor(public readonly page: Page) {
    this.root = page.locator('.actionbar-container')
    this.queueButton = new ComfyQueueButton(this)
    this.propertiesButton = this.root.getByLabel('Toggle properties panel')
  }

  async isDocked() {
    const className = await this.root
      .locator('.actionbar')
      .getAttribute('class')
    return className?.includes('static') ?? false
  }
}

class ComfyQueueButton {
  public readonly root: Locator
  public readonly primaryButton: Locator
  public readonly dropdownButton: Locator
  constructor(public readonly actionbar: ComfyActionbar) {
    this.root = actionbar.root.getByTestId(TestIds.topbar.queueButton)
    this.primaryButton = this.root
    this.dropdownButton = actionbar.root.getByTestId(
      TestIds.topbar.queueModeMenuTrigger
    )
  }

  public async toggleOptions() {
    return await this.openOptions()
  }

  public async openOptions() {
    await this.dropdownButton.click()
    return new ComfyQueueButtonOptions(this.actionbar.page)
  }
}

class ComfyQueueButtonOptions {
  public readonly menu: Locator
  public readonly modeItems: Locator

  constructor(public readonly page: Page) {
    this.menu = page.getByRole('menu')
    this.modeItems = this.menu.getByRole('menuitem')
  }

  public modeItem(name: string) {
    return this.menu.getByRole('menuitem', { name, exact: true })
  }

  public async selectMode(name: string) {
    await this.modeItem(name).click()
  }

  public async setMode(mode: AutoQueueMode) {
    await this.page.evaluate((mode) => {
      ;(window.app!.extensionManager as WorkspaceStore).queueSettings.mode =
        mode
    }, mode)
  }

  public async getMode() {
    return await this.page.evaluate(() => {
      return (window.app!.extensionManager as WorkspaceStore).queueSettings.mode
    })
  }
}
