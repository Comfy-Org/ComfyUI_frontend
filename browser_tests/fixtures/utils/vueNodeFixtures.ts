import type { Locator } from '@playwright/test'
import type { CompassCorners } from '@/lib/litegraph/src/interfaces'
import { RESIZE_HANDLE_ARIA_LABELS_EN } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'

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
  public readonly content: Locator

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
    this.content = locator.locator('.lg-node-content')
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
        ? slotLocators.filter({ hasText: nameOrLocator })
        : slotLocators.filter({ has: nameOrLocator })
    return filteredLocator.getByTestId('slot-dot').locator('..')
  }

  getResizeHandle(corner: CompassCorners): Locator {
    return this.root.getByRole('button', {
      name: RESIZE_HANDLE_ARIA_LABELS_EN[corner]
    })
  }

  async resizeFromCorner(
    corner: CompassCorners,
    deltaX: number,
    deltaY: number
  ): Promise<void> {
    const handle = this.getResizeHandle(corner)
    const box = await handle.boundingBox()
    if (!box) {
      throw new Error(
        `Resize handle for corner "${corner}" has no bounding box`
      )
    }

    const page = this.locator.page()
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2

    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX + deltaX, centerY + deltaY, {
      steps: 5
    })
    await page.mouse.up()
  }
}
