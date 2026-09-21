import type { Locator, Page } from '@playwright/test'

export class GraphCanvasMenu {
  public readonly root: Locator

  constructor(page: Page) {
    this.root = page.getByRole('toolbar', { name: 'Canvas Toolbar' })
  }
}
