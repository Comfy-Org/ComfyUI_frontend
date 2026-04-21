import type { Locator } from '@playwright/test'

import type { CompassCorners } from '@/lib/litegraph/src/interfaces'

import { TestIds } from '@e2e/fixtures/selectors'

/** DOM-centric helper for a single Vue-rendered node on the canvas. */
export class VueNodeFixture {
  public readonly header: Locator
  public readonly title: Locator
  public readonly titleInput: Locator
  public readonly body: Locator
  public readonly pinIndicator: Locator
  public readonly collapseButton: Locator
  public readonly collapseIcon: Locator
  public readonly root: Locator

  constructor(private readonly locator: Locator) {
    this.header = locator.locator('[data-testid^="node-header-"]')
    this.title = locator.getByTestId('node-title')
    this.titleInput = locator.getByTestId('node-title-input')
    this.body = locator.locator('[data-testid^="node-body-"]')
    this.pinIndicator = locator.getByTestId(TestIds.node.pinIndicator)
    this.collapseButton = locator.getByTestId('node-collapse-button')
    this.collapseIcon = this.collapseButton.locator('i')
    this.root = locator
  }

  async getTitle(): Promise<string> {
    return (await this.title.textContent()) ?? ''
  }

  async setTitle(value: string): Promise<void> {
    await this.header.dblclick()
    const input = this.titleInput
    await input.waitFor({ state: 'visible' })
    await input.fill(value)
    await input.press('Enter')
  }

  async cancelTitleEdit(): Promise<void> {
    await this.header.dblclick()
    const input = this.titleInput
    await input.waitFor({ state: 'visible' })
    await input.press('Escape')
  }

  async toggleCollapse(): Promise<void> {
    await this.collapseButton.click()
  }

  async getCollapseIconClass(): Promise<string> {
    return (await this.collapseIcon.getAttribute('class')) ?? ''
  }

  boundingBox(): ReturnType<Locator['boundingBox']> {
    return this.locator.boundingBox()
  }

  /** Locator for the resize handle at the given corner, scoped to this node. */
  getResizeHandle(corner: CompassCorners): Locator {
    return this.root.locator(`[data-corner="${corner}"]`)
  }

  /**
   * Drag the resize handle at `corner` by (deltaX, deltaY) viewport pixels.
   * Uses `hover()` to land the pointer on the handle with Playwright's
   * actionability checks before starting the mouse sequence, which protects
   * against occluding overlays and subpixel hit-test misses.
   */
  async resizeFromCorner(
    corner: CompassCorners,
    deltaX: number,
    deltaY: number
  ): Promise<void> {
    const handle = this.getResizeHandle(corner)
    await handle.hover()
    const box = await handle.boundingBox()
    if (!box) {
      throw new Error(
        `Resize handle for corner "${corner}" has no bounding box`
      )
    }

    const page = this.locator.page()
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2

    await page.mouse.down()
    await page.mouse.move(centerX + deltaX, centerY + deltaY, {
      steps: 5
    })
    await page.mouse.up()
  }
}
