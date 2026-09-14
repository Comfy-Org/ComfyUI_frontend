import type { Locator } from '@playwright/test'

import { BADGE_GAP } from '@/lib/litegraph/src/canvas/linkBadges'
import type { Point } from '@/lib/litegraph/src/interfaces'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class LinkVisibilityHelper {
  public readonly promptInput: Locator

  constructor(private readonly comfyPage: ComfyPage) {
    this.promptInput = comfyPage.page
      .locator('.graphdialog')
      .getByRole('textbox')
  }

  async hideFirstLink(): Promise<void> {
    const handle = await this.comfyPage.page.waitForFunction(() => {
      const link = window.app!.graph.links.values().next().value
      if (!link?.path) return null
      const pos = link._pos
      return [pos[0], pos[1]] satisfies Point
    })
    const point = await handle.jsonValue()
    if (!point) throw new Error('Rendered link midpoint was not found')
    await this.clickMenuAction(point, 'Hide Link')
  }

  async showFirstHiddenLink(): Promise<void> {
    await this.clickMenuAction(await this.firstBadgeCenter(), 'Show Link')
  }

  async openRenamePrompt(): Promise<void> {
    const [x, y] = await this.graphPointToClient(await this.firstBadgeCenter())
    await this.comfyPage.page.mouse.dblclick(x, y, { delay: 5 })
    await this.promptInput.waitFor({ state: 'visible' })
  }

  private async clickMenuAction(point: Point, action: string): Promise<void> {
    const [x, y] = await this.graphPointToClient(point)
    await this.comfyPage.page.mouse.click(x, y, { button: 'right' })
    await this.comfyPage.contextMenu.litegraphContextMenu.waitFor({
      state: 'visible'
    })
    await this.comfyPage.contextMenu.clickLitegraphMenuItem(action)
    await this.comfyPage.contextMenu.waitForHidden()
    await this.comfyPage.page.mouse.move(1, 1)
    await this.comfyPage.nextFrame()
  }

  private async graphPointToClient(point: Point): Promise<Point> {
    return this.comfyPage.page.evaluate(
      (point) => window.app!.canvasPosToClientPos(point),
      point
    )
  }

  private async firstBadgeCenter(): Promise<Point> {
    const handle = await this.comfyPage.page.waitForFunction((gap) => {
      const link = window.app!.graph.links.values().next().value
      if (!link) return null
      const origin = window.app!.graph.getNodeById(link.origin_id)
      const socket = origin?.getOutputPos(link.origin_slot)
      return socket ? ([socket[0] + gap + 4, socket[1]] satisfies Point) : null
    }, BADGE_GAP)
    const point = await handle.jsonValue()
    if (!point) throw new Error('Hidden link badge was not found')
    return point
  }
}
