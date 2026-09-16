import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class WorkflowTabPopover {
  readonly root: Locator
  readonly thumbnail: Locator
  readonly pendingShows: Locator

  constructor(private readonly page: Page) {
    this.root = page
      .getByTestId(TestIds.topbar.workflowTabPopover)
      .filter({ visible: true })
    this.thumbnail = this.root.getByRole('img')
    this.pendingShows = page
      .getByTestId(TestIds.topbar.workflowTabPopoverAnchor)
      .and(page.locator('[data-show-pending="true"]'))
  }

  async readThumbnailDataUrl() {
    await expect(this.thumbnail).toBeVisible()
    const src = await this.thumbnail.getAttribute('src')
    if (!src) throw new Error('Workflow tab thumbnail has no source')

    return this.page.evaluate(async (src) => {
      const blob = await fetch(src).then((response) => response.blob())
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result)
          else reject(new Error('Failed to read workflow tab thumbnail'))
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }, src)
  }

  async dismiss() {
    await this.page.mouse.move(-1, -1)
    await expect(this.pendingShows).toHaveCount(0)
    if ((await this.root.count()) > 0) {
      await this.page.keyboard.press('Escape')
    }
    await expect(this.root).toHaveCount(0)
  }
}
