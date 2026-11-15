import type { Locator, Page } from '@playwright/test'

export class GraphCanvasMenu {
  public readonly fitViewButton: Locator
  public readonly minimapButton: Locator
  public readonly root: Locator
  public readonly zoomControlsButton: Locator

  constructor(page: Page) {
    this.root = page.getByRole('toolbar', { name: 'Canvas Toolbar' })
    this.fitViewButton = this.root.getByRole('button', { name: /^Fit View/ })
    this.zoomControlsButton = this.root.getByRole('button', {
      name: 'Zoom Controls'
    })
    this.minimapButton = this.root.getByTestId('toggle-minimap-button')
  }
}
