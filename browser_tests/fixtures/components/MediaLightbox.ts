import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class MediaLightbox {
  public readonly root: Locator
  public readonly closeButton: Locator
  public readonly nextButton: Locator
  public readonly zoomTarget: Locator
  public readonly zoomPercentage: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
    this.closeButton = this.root.getByLabel('Close')
    this.nextButton = this.root.getByLabel('Next')
    this.zoomTarget = this.root.getByTestId(TestIds.mediaLightbox.zoomTarget)
    this.zoomPercentage = this.root.getByTestId(
      TestIds.mediaLightbox.zoomPercentage
    )
  }

  image(name: string): Locator {
    return this.root.getByRole('img', { name })
  }

  async expectImageLoaded(name: string, naturalWidth: number) {
    await expect(this.image(name)).toHaveJSProperty(
      'naturalWidth',
      naturalWidth
    )
  }

  async zoomTargetBox() {
    const box = await this.zoomTarget.boundingBox()
    if (!box) throw new Error('Lightbox zoom target is not visible')
    return box
  }

  async zoomTargetCenter() {
    const box = await this.zoomTargetBox()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  async wheelOverImage(deltaY: number) {
    const center = await this.zoomTargetCenter()
    await this.page.mouse.move(center.x, center.y)
    await this.page.mouse.wheel(0, deltaY)
  }

  /** Drags from the image center to the bottom edge of the viewport. */
  async dragImageToBottomEdge() {
    const viewport = this.page.viewportSize()
    if (!viewport) throw new Error('Viewport size is not set')
    const start = await this.zoomTargetCenter()
    const end = { x: start.x, y: viewport.height - 5 }

    await this.page.mouse.move(start.x, start.y)
    await this.page.mouse.down()
    await this.page.mouse.move(end.x, end.y, { steps: 10 })
    await this.page.mouse.up()
    return { dx: end.x - start.x, dy: end.y - start.y }
  }
}
