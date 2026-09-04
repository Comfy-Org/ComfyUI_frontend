import type { Locator, Page, Request } from '@playwright/test'
import { errors, expect } from '@playwright/test'

import type { AutoQueueMode } from '@/stores/queueSettingsStore'
import { TestIds } from '@e2e/fixtures/selectors'
import type { WorkspaceStore } from '@e2e/types/globals'

/** Only the card's 1px border may sit below the run progress bar. */
const FLUSH_TOLERANCE_PX = 2

async function boundingBox(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected element to be measurable')
  return box
}

function isPromptRequest(request: Request): boolean {
  return (
    request.method() === 'POST' &&
    new URL(request.url()).pathname.endsWith('/api/prompt')
  )
}

export class ComfyActionbar {
  public readonly root: Locator
  public readonly card: Locator
  public readonly queueButton: ComfyQueueButton
  public readonly propertiesButton: Locator
  public readonly dragHandle: Locator
  public readonly inlineProgress: Locator
  public readonly inlineProgressNodeFill: Locator

  constructor(public readonly page: Page) {
    this.root = page.locator('.actionbar-container')
    this.card = page.getByTestId(TestIds.topbar.actionBarCard)
    this.queueButton = new ComfyQueueButton(this)
    this.propertiesButton = this.root.getByLabel('Toggle properties panel')
    this.dragHandle = this.root.locator('.drag-handle')
    this.inlineProgress = page.getByTestId(TestIds.topbar.queueInlineProgress)
    this.inlineProgressNodeFill = page.getByTestId(
      TestIds.topbar.queueInlineProgressNodeFill
    )
  }

  /**
   * The run progress bar draws inside the actionbar card, so it must hug the
   * card's bottom edge. Anything higher overlaps the Run/Cancel button row and
   * gets painted over by it.
   */
  async expectInlineProgressFlushWithCardBottom() {
    await expect
      .poll(async () => {
        const [card, fill] = await Promise.all([
          boundingBox(this.card),
          boundingBox(this.inlineProgressNodeFill)
        ])
        return Math.abs(card.y + card.height - (fill.y + fill.height))
      })
      .toBeLessThanOrEqual(FLUSH_TOLERANCE_PX)
  }

  async expectInlineProgressClearOfControls() {
    await expect
      .poll(async () => {
        const [controls, fill] = await Promise.all([
          boundingBox(this.root),
          boundingBox(this.inlineProgressNodeFill)
        ])
        return fill.y - (controls.y + controls.height)
      })
      .toBeGreaterThanOrEqual(0)
  }

  async expectInlineProgressFilledFraction(fraction: number) {
    await expect
      .poll(async () => {
        const [track, fill] = await Promise.all([
          boundingBox(this.inlineProgress),
          boundingBox(this.inlineProgressNodeFill)
        ])
        return fill.width / track.width
      })
      .toBeCloseTo(fraction, 2)
  }

  async isDocked() {
    const className = await this.root
      .locator('.actionbar')
      .getAttribute('class')
    return className?.includes('static') ?? false
  }

  /** After the action completes, keeps observing until maxRequests or timeout. */
  async collectPromptRequestsDuring(
    action: () => Promise<void>,
    {
      minRequests,
      maxRequests,
      timeout
    }: {
      minRequests: number
      maxRequests: number
      timeout: number
    }
  ): Promise<Request[]> {
    const requests: Request[] = []
    function onRequest(request: Request) {
      if (isPromptRequest(request)) requests.push(request)
    }

    this.page.on('request', onRequest)
    try {
      await action()

      const deadline = Date.now() + timeout
      while (requests.length < maxRequests) {
        const remaining = deadline - Date.now()
        if (remaining <= 0) break

        try {
          await this.page.waitForRequest(isPromptRequest, {
            timeout: remaining
          })
        } catch (error: unknown) {
          if (!(error instanceof errors.TimeoutError)) throw error
          break
        }
      }

      if (requests.length < minRequests) {
        throw new errors.TimeoutError(
          `Timed out after ${timeout}ms waiting for at least ${minRequests} prompt requests; received ${requests.length}`
        )
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
