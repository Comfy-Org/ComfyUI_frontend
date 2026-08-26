import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

/**
 * The node/group title-editing input. Rendered in three scopes: the canvas
 * overlay (page-wide), the properties panel, and the Vue node itself.
 */
export class TitleEditor {
  public readonly input: Locator

  constructor(scope: Page | Locator) {
    this.input = scope.getByTestId(TestIds.node.titleInput)
  }

  async setTitle(title: string): Promise<void> {
    await this.input.fill(title)
    await this.input.press('Enter')
  }

  async cancel(): Promise<void> {
    await this.input.press('Escape')
  }

  async expectVisible(): Promise<void> {
    await expect(this.input).toBeVisible()
  }

  async expectHidden(): Promise<void> {
    await expect(this.input).toBeHidden()
  }
}
