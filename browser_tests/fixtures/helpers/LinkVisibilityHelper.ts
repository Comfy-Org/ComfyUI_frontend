import type { Locator } from '@playwright/test'

import { BADGE_GAP } from '@/lib/litegraph/src/canvas/linkBadges'
import type { Point } from '@/lib/litegraph/src/interfaces'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'

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

  async hideLinkBetween(options: {
    sourceTitle: string
    outputName: string
    targetTitle: string
    inputName: string
  }): Promise<void> {
    const handle = await this.comfyPage.page.waitForFunction(
      ({ sourceTitle, outputName, targetTitle, inputName }) => {
        const graph = window.app?.graph
        if (!graph) return null
        const source = graph.nodes.find((node) => node.title === sourceTitle)
        const target = graph.nodes.find((node) => node.title === targetTitle)
        if (!source || !target) return null
        const outputIndex = source.outputs.findIndex(
          (slot) => slot.name === outputName
        )
        const inputIndex = target.inputs.findIndex(
          (slot) => slot.name === inputName
        )
        const link = [...graph.links.values()].find(
          (candidate) =>
            candidate.origin_id === source.id &&
            candidate.origin_slot === outputIndex &&
            candidate.target_id === target.id &&
            candidate.target_slot === inputIndex
        )
        if (!link?.path) return null
        const pos = link._pos
        return [pos[0], pos[1]] satisfies Point
      },
      options
    )
    const point = await handle.jsonValue()
    if (!point) throw new Error('Rendered link midpoint was not found')
    await this.clickMenuAction(point, 'Hide Link')
  }

  async parkPointer(): Promise<void> {
    await this.comfyPage.canvas.hover({
      position: DefaultGraphPositions.emptySpaceClick
    })
    await this.comfyPage.nextFrame()
  }

  async hoverFirstHiddenLink(): Promise<void> {
    const [x, y] = await this.graphPointToClient(await this.firstBadgeCenter())
    await this.comfyPage.page.mouse.move(x, y)
    await this.comfyPage.nextFrame()
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
    await this.parkPointer()
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
