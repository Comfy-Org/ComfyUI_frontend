import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import type { CompassCorners } from '@/lib/litegraph/src/interfaces'

import { TitleEditor } from '@e2e/fixtures/components/TitleEditor'
import { TestIds } from '@e2e/fixtures/selectors'

interface BoxOrigin {
  readonly x: number
  readonly y: number
}

/** DOM-centric helper for a single Vue-rendered node on the canvas. */
export class VueNodeFixture {
  public readonly header: Locator
  public readonly title: Locator
  public readonly titleEditor: TitleEditor
  public readonly body: Locator
  public readonly pinIndicator: Locator
  public readonly collapseButton: Locator
  public readonly collapseIcon: Locator
  public readonly root: Locator

  constructor(private readonly locator: Locator) {
    this.header = locator.locator('[data-testid^="node-header-"]')
    this.title = locator.getByTestId('node-title')
    this.titleEditor = new TitleEditor(locator)
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
    await this.titleEditor.expectVisible()
    await this.titleEditor.setTitle(value)
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

  /**
   * Click the node header to select it, then return its bounding box.
   * Throws if the node is not laid out (no bounding box) — resize and other
   * geometry-sensitive tests cannot proceed without coordinates.
   */
  async selectAndGetBox(): Promise<{
    x: number
    y: number
    width: number
    height: number
  }> {
    await this.header.click()
    const box = await this.boundingBox()
    if (!box) {
      throw new Error('Node bounding box not found after select')
    }
    return box
  }

  /**
   * Assert this node's top-left origin stays within `precision` decimal
   * places of `expected`. Wraps the polled bounding-box pattern that drift
   * tests repeat for both axes.
   */
  async expectAnchoredAt(
    expected: BoxOrigin,
    { precision = 1 }: { precision?: number } = {}
  ): Promise<void> {
    await expect
      .poll(async () => (await this.boundingBox())?.x)
      .toBeCloseTo(expected.x, precision)
    await expect
      .poll(async () => (await this.boundingBox())?.y)
      .toBeCloseTo(expected.y, precision)
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
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + deltaX, startY + deltaY, {
      steps: 5
    })
    await page.mouse.up()
  }
}
