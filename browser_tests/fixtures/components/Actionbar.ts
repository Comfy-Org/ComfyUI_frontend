import type { Locator, Page, Request } from '@playwright/test'
import { errors } from '@playwright/test'

import type { AutoQueueMode } from '@/stores/queueStore'
import { TestIds } from '@e2e/fixtures/selectors'
import type { WorkspaceStore } from '@e2e/types/globals'

function isPromptRequest(request: Request): boolean {
  return (
    request.method() === 'POST' &&
    new URL(request.url()).pathname === '/api/prompt'
  )
}

export class ComfyActionbar {
  public readonly root: Locator
  public readonly queueButton: ComfyQueueButton
  public readonly propertiesButton: Locator
  public readonly dragHandle: Locator

  constructor(public readonly page: Page) {
    this.root = page.locator('.actionbar-container')
    this.queueButton = new ComfyQueueButton(this)
    this.propertiesButton = this.root.getByLabel('Toggle properties panel')
    this.dragHandle = this.root.locator('.drag-handle')
  }

  async isDocked() {
    const className = await this.root
      .locator('.actionbar')
      .getAttribute('class')
    return className?.includes('static') ?? false
  }

  async collectPromptRequestsDuring(
    action: () => Promise<void>,
    timeout = 3000
  ): Promise<Request[]> {
    const requests: Request[] = []
    function onRequest(request: Request) {
      if (isPromptRequest(request)) requests.push(request)
    }

    this.page.on('request', onRequest)
    try {
      await action()
      if (requests.length === 0) {
        await this.page
          .waitForRequest(isPromptRequest, { timeout })
          .catch((error: unknown) => {
            if (!(error instanceof errors.TimeoutError)) throw error
          })
      }
      return requests
    } finally {
      this.page.off('request', onRequest)
    }
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
    await this.dropdownButton.click()
    return new ComfyQueueButtonOptions(this.actionbar.page)
  }

  public async openOptions() {
    const options = new ComfyQueueButtonOptions(this.actionbar.page)
    if (!(await options.menu.isVisible())) {
      await this.dropdownButton.click()
    }
    return options
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
