import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'
import type { CompassCorners } from '@comfyorg/shared-frontend-utils/geometry'

import { TitleEditor } from '@e2e/fixtures/components/TitleEditor'
import { TestIds } from '@e2e/fixtures/selectors'

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
  public readonly priceBadge: Locator
  public readonly stateOutline: Locator
  public readonly executionOutline: Locator
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
    this.priceBadge = locator.getByTestId('node-badge-group-credits')
    this.stateOutline = locator.getByTestId('node-state-outline-overlay')
    this.executionOutline = this.stateOutline.and(
      locator.page().locator('.border-primary')
    )
    const bottomRight = locator.getByRole('button', { name: 'bottom-right' })
    this.resize = { bottomRight }
  }

  async getTitle(): Promise<string> {
    return (await this.title.textContent()) ?? ''
  }

  async setTitle(value: string): Promise<void> {
    await this.header.dblclick()
    await this.titleEditor.expectVisible()
    await this.titleEditor.setTitle(value)
  }

  async select() {
    await this.header.click()
  }

  async expectNoRootOutline(): Promise<void> {
    await expect(this.root).toHaveCSS('outline-style', 'none')
  }

  async expectFocusOutline(visible: boolean): Promise<void> {
    await expect(this.stateOutline).toHaveCSS(
      'outline-style',
      visible ? 'auto' : 'none'
    )
  }

  async waitForImageLoaded(filename: string): Promise<void> {
    const image = this.imagePreview.getByTestId('main-image')
    await expect
      .poll(() =>
        image.evaluate((img: HTMLImageElement) => ({
          filename: new URL(img.src, document.baseURI).searchParams.get(
            'filename'
          ),
          loaded: img.complete && img.naturalWidth > 0
        }))
      )
      .toEqual({ filename, loaded: true })
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

  getSlot(nameOrLocator: string | Locator) {
    const slotLocators = this.root
      .getByTestId('node-widget')
      .or(this.root.locator('.lg-slot'))
    const filteredLocator =
      typeof nameOrLocator === 'string'
        ? slotLocators
            .filter({
              has: this.root.page().getByText(nameOrLocator, { exact: true })
            })
            .or(
              this.root
                .locator('.lg-slot')
                .and(this.root.getByLabel(nameOrLocator, { exact: true }))
            )
        : slotLocators.filter({ has: nameOrLocator })
    return filteredLocator.getByTestId('slot-connection-dot')
  }

  /** Container of a widget row's input slot, which hides the slot until it is revealed. */
  getWidgetSlotContainer(widgetName: string): Locator {
    return this.root
      .locator(`[data-widget-name="${widgetName}"]`)
      .locator('[data-part="row-slot"]')
  }

  /** Locator for the resize handle at the given corner, scoped to this node. */
  getResizeHandle(corner: CompassCorners): Locator {
    return this.root.locator(`[data-corner="${corner}"]`)
  }

  /** Locator for the widget row whose control is labelled `name`. */
  widgetRow(name: string): Locator {
    return this.root.getByTestId('node-widget').filter({
      has: this.locator.page().getByLabel(name, { exact: true })
    })
  }

  /** Pixels between the height of widget `name`'s textarea and exactly `lines` lines of its text. */
  textareaLineFitError(name: string, lines: number): Promise<number> {
    return this.widgetRow(name)
      .getByRole('textbox')
      .evaluate((textarea, lines) => {
        const style = getComputedStyle(textarea)
        const padding =
          Number.parseFloat(style.paddingTop) +
          Number.parseFloat(style.paddingBottom)
        return Math.abs(
          textarea.clientHeight -
            padding -
            lines * Number.parseFloat(style.lineHeight)
        )
      }, lines)
  }

  /** Locator for the bottom-edge resize handle inside `region`, or this node's only one. */
  growableRegionHandle(region: Locator = this.root): Locator {
    return region.getByTestId('growable-region-handle')
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
    await this.dragHandle(this.getResizeHandle(corner), deltaX, deltaY)
  }

  /** Drag `handle` by (deltaX, deltaY) viewport pixels. */
  async dragHandle(
    handle: Locator,
    deltaX: number,
    deltaY: number
  ): Promise<void> {
    await handle.hover()
    const box = await handle.boundingBox()
    if (!box) {
      throw new Error('Resize handle has no bounding box')
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
