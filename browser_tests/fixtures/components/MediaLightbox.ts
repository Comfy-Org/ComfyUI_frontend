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
}
