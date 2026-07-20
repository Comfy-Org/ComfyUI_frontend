import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'
import type { CompassCorners } from '@/lib/litegraph/src/interfaces'
import { toNodeId } from '@/types/nodeId'

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
  public readonly widgets: Locator
  public readonly imagePreview: Locator
  public readonly imageGrid: Locator
  public readonly content: Locator
  public readonly resize: { bottomRight: Locator }

  constructor(private readonly locator: Locator) {
    this.header = locator.locator('[data-testid^="node-header-"]')
    this.title = locator.getByTestId('node-title')
    this.titleEditor = new TitleEditor(locator)
    this.body = locator.locator('[data-testid^="node-body-"]')
    this.pinIndicator = locator.getByTestId(TestIds.node.pinIndicator)
    this.collapseButton = locator.getByTestId('node-collapse-button')
    this.collapseIcon = this.collapseButton.locator('i')
    this.root = locator
    this.widgets = this.locator.locator('.lg-node-widget')
    this.imagePreview = locator.locator('.image-preview')
    this.imageGrid = locator.getByTestId(TestIds.node.imageGrid)
    this.content = locator.locator('.lg-node-content')
    const bottomRight = locator.getByRole('button', { name: 'bottom-right' })
    this.resize = { bottomRight }
  }

  async getTitle(): Promise<string> {
    return (await this.title.textContent()) ?? ''
  }
  async getId() {
    const id = await this.locator.getAttribute('data-node-id')
    if (!id) throw new Error('Failed to get id')
    return id
  }

  async setTitle(value: string): Promise<void> {
    await this.header.dblclick()
    await this.titleEditor.expectVisible()
    await this.titleEditor.setTitle(value)
  }

  async select() {
    await this.header.click()
  }

  async toggleCollapse(): Promise<void> {
    await this.collapseButton.click()
  }

  /**
   * Select this node and delete it via the Delete key, waiting for the node
   * element to leave the DOM before resolving.
   */
  async delete(): Promise<void> {
    await this.header.click()
    await this.header.press('Delete')
    await this.locator.waitFor({ state: 'hidden' })
  }

  async getCollapseIconClass(): Promise<string> {
    return (await this.collapseIcon.getAttribute('class')) ?? ''
  }

  boundingBox(): ReturnType<Locator['boundingBox']> {
    return this.locator.boundingBox()
  }

  getSlot(nameOrLocator: string | RegExp | Locator = '') {
    const slotLocators = this.root
      .getByTestId('node-widget')
      .or(this.root.locator('.lg-slot'))
    const filteredLocator =
      typeof nameOrLocator === 'string' || nameOrLocator instanceof RegExp
        ? slotLocators.filter({ hasText: nameOrLocator })
        : slotLocators.filter({ has: nameOrLocator })
    return filteredLocator.getByTestId('slot-dot').locator('..')
  }

  /**
   * Click the node header to select it, then return its bounding box.
   * Throws if the node is not laid out because geometry-sensitive tests
   * cannot proceed without coordinates.
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
    await expect.poll(this.pollLeftEdge).toBeCloseTo(expected.x, precision)
    await expect.poll(this.pollTopEdge).toBeCloseTo(expected.y, precision)
  }

  /** Poll the node's left/x edge for use with `expect.poll`. */
  pollLeftEdge = async (): Promise<number | null> =>
    (await this.boundingBox())?.x ?? null

  /** Poll the node's top/y edge for use with `expect.poll`. */
  pollTopEdge = async (): Promise<number | null> =>
    (await this.boundingBox())?.y ?? null

  /** Poll the node's right edge (x + width) for use with `expect.poll`. */
  pollRightEdge = async (): Promise<number | null> => {
    const b = await this.boundingBox()
    return b ? b.x + b.width : null
  }

  /** Poll the node's bottom edge (y + height) for use with `expect.poll`. */
  pollBottomEdge = async (): Promise<number | null> => {
    const b = await this.boundingBox()
    return b ? b.y + b.height : null
  }

  /** Poll the node's width for use with `expect.poll`. */
  pollWidth = async (): Promise<number | null> =>
    (await this.boundingBox())?.width ?? null

  /** Poll the node's height for use with `expect.poll`. */
  pollHeight = async (): Promise<number | null> =>
    (await this.boundingBox())?.height ?? null

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

  async isConnectedTo(target: VueNodeFixture, atSlotIndex?: number) {
    return await this.locator.page().evaluate(
      ([originId, targetId, slot]) => {
        const graph = app!.canvas.graph!
        const targetNode = graph.getNodeById(targetId)
        if (!targetNode) return false

        const inputs =
          slot !== undefined ? [targetNode.inputs[slot]] : targetNode.inputs
        for (const input of inputs) {
          if (graph.getLink(input.link)?.origin_id == originId) return true
        }
        return false
      },
      [await this.getId(), toNodeId(await target.getId()), atSlotIndex] as const
    )
  }
}
