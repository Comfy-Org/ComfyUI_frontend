import type { Locator, Page } from '@playwright/test'

/** The floating canvas toolbar anchored to the bottom right of the graph. */
export class GraphCanvasMenu {
  public readonly root: Locator

  constructor(page: Page) {
    this.root = page.getByRole('toolbar', { name: 'Canvas Toolbar' })
  }
}
