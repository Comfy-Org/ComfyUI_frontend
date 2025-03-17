import type { Page } from '@playwright/test'

import type { NodeId } from '../../../src/schemas/comfyWorkflowSchema'
import { ManageGroupNode } from '../../helpers/manageGroupNode'
import type { ComfyPage } from '../ComfyPage'
import type { Position, Size } from '../types'

export const getMiddlePoint = (pos1: Position, pos2: Position) => {
  return {
    x: (pos1.x + pos2.x) / 2,
    y: (pos1.y + pos2.y) / 2
  }
}

export class NodeSlotReference {
  constructor(
    readonly type: 'input' | 'output',
    readonly index: number,
    readonly node: NodeReference
  ) {}
  async getPosition() {
    const pos: [number, number] = await this.node.comfyPage.page.evaluate(
      ([type, id, index]) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        return window['app'].canvas.ds.convertOffsetToCanvas(
          node.getConnectionPos(type === 'input', index)
        )
      },
      [this.type, this.node.id, this.index] as const
    )
    return {
      x: pos[0],
      y: pos[1]
    }
  }
  async getLinkCount() {
    return await this.node.comfyPage.page.evaluate(
      ([type, id, index]) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        if (type === 'input') {
          return node.inputs[index].link == null ? 0 : 1
        }
        return node.outputs[index].links?.length ?? 0
      },
      [this.type, this.node.id, this.index] as const
    )
  }
  async removeLinks() {
    await this.node.comfyPage.page.evaluate(
      ([type, id, index]) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        if (type === 'input') {
          node.disconnectInput(index)
        } else {
          node.disconnectOutput(index)
        }
      },
      [this.type, this.node.id, this.index] as const
    )
  }
}

export class NodeWidgetReference {
  constructor(
    readonly index: number,
    readonly node: NodeReference
  ) {}

  /**
   * @returns The position of the widget's center
   */
  async getPosition(): Promise<Position> {
    const pos: [number, number] = await this.node.comfyPage.page.evaluate(
      ([id, index]) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        const widget = node.widgets[index]
        if (!widget) throw new Error(`Widget ${index} not found.`)

        const [x, y, w, h] = node.getBounding()
        return window['app'].canvas.ds.convertOffsetToCanvas([
          x + w / 2,
          y + window['LiteGraph']['NODE_TITLE_HEIGHT'] + widget.last_y + 1
        ])
      },
      [this.node.id, this.index] as const
    )
    return {
      x: pos[0],
      y: pos[1]
    }
  }

  async click() {
    await this.node.comfyPage.canvas.click({
      position: await this.getPosition()
    })
  }

  async dragHorizontal(delta: number) {
    const pos = await this.getPosition()
    const canvas = this.node.comfyPage.canvas
    const canvasPos = (await canvas.boundingBox())!
    this.node.comfyPage.dragAndDrop(
      {
        x: canvasPos.x + pos.x,
        y: canvasPos.y + pos.y
      },
      {
        x: canvasPos.x + pos.x + delta,
        y: canvasPos.y + pos.y
      }
    )
  }

  async getValue() {
    return await this.node.comfyPage.page.evaluate(
      ([id, index]) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        const widget = node.widgets[index]
        if (!widget) throw new Error(`Widget ${index} not found.`)
        return widget.value
      },
      [this.node.id, this.index] as const
    )
  }
}
export class NodeReference {
  constructor(
    readonly id: NodeId,
    readonly comfyPage: ComfyPage
  ) {}
  async exists(): Promise<boolean> {
    return await this.comfyPage.page.evaluate((id) => {
      const node = window['app'].graph.getNodeById(id)
      return !!node
    }, this.id)
  }
  getType(): Promise<string> {
    return this.getProperty('type')
  }
  async getPosition(): Promise<Position> {
    const pos = await this.comfyPage.convertOffsetToCanvas(
      await this.getProperty<[number, number]>('pos')
    )
    return {
      x: pos[0],
      y: pos[1]
    }
  }
  async getBounding(): Promise<Position & Size> {
    const [x, y, width, height]: [number, number, number, number] =
      await this.comfyPage.page.evaluate((id) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error('Node not found')
        return node.getBounding()
      }, this.id)
    return {
      x,
      y,
      width,
      height
    }
  }
  async getSize(): Promise<Size> {
    const size = await this.getProperty<[number, number]>('size')
    return {
      width: size[0],
      height: size[1]
    }
  }
  async getFlags(): Promise<{ collapsed?: boolean; pinned?: boolean }> {
    return await this.getProperty('flags')
  }
  async isPinned() {
    return !!(await this.getFlags()).pinned
  }
  async isCollapsed() {
    return !!(await this.getFlags()).collapsed
  }
  async isBypassed() {
    return (await this.getProperty<number | null | undefined>('mode')) === 4
  }
  async getProperty<T>(prop: string): Promise<T> {
    return await this.comfyPage.page.evaluate(
      ([id, prop]) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error('Node not found')
        return node[prop]
      },
      [this.id, prop] as const
    )
  }
  async getOutput(index: number) {
    return new NodeSlotReference('output', index, this)
  }
  async getInput(index: number) {
    return new NodeSlotReference('input', index, this)
  }
  async getWidget(index: number) {
    return new NodeWidgetReference(index, this)
  }
  async click(
    position: 'title' | 'collapse',
    options?: Parameters<Page['click']>[1] & { moveMouseToEmptyArea?: boolean }
  ) {
    const nodePos = await this.getPosition()
    const nodeSize = await this.getSize()
    let clickPos: Position
    switch (position) {
      case 'title':
        clickPos = { x: nodePos.x + nodeSize.width / 2, y: nodePos.y - 15 }
        break
      case 'collapse':
        clickPos = { x: nodePos.x + 5, y: nodePos.y - 10 }
        break
      default:
        throw new Error(`Invalid click position ${position}`)
    }

    const moveMouseToEmptyArea = options?.moveMouseToEmptyArea
    if (options) {
      delete options.moveMouseToEmptyArea
    }

    await this.comfyPage.canvas.click({
      ...options,
      position: clickPos
    })
    await this.comfyPage.nextFrame()
    if (moveMouseToEmptyArea) {
      await this.comfyPage.moveMouseToEmptyArea()
    }
  }
  async copy() {
    await this.click('title')
    await this.comfyPage.ctrlC()
    await this.comfyPage.nextFrame()
  }
  async connectWidget(
    originSlotIndex: number,
    targetNode: NodeReference,
    targetWidgetIndex: number
  ) {
    const originSlot = await this.getOutput(originSlotIndex)
    const targetWidget = await targetNode.getWidget(targetWidgetIndex)
    await this.comfyPage.dragAndDrop(
      await originSlot.getPosition(),
      await targetWidget.getPosition()
    )
    return originSlot
  }
  async connectOutput(
    originSlotIndex: number,
    targetNode: NodeReference,
    targetSlotIndex: number
  ) {
    const originSlot = await this.getOutput(originSlotIndex)
    const targetSlot = await targetNode.getInput(targetSlotIndex)
    await this.comfyPage.dragAndDrop(
      await originSlot.getPosition(),
      await targetSlot.getPosition()
    )
    return originSlot
  }
  async getContextMenuOptionNames() {
    await this.click('title', { button: 'right' })
    const ctx = this.comfyPage.page.locator('.litecontextmenu')
    return await ctx.locator('.litemenu-entry').allInnerTexts()
  }
  async clickContextMenuOption(optionText: string) {
    await this.click('title', { button: 'right' })
    const ctx = this.comfyPage.page.locator('.litecontextmenu')
    await ctx.getByText(optionText).click()
  }
  async convertToGroupNode(groupNodeName: string = 'GroupNode') {
    await this.clickContextMenuOption('Convert to Group Node')
    await this.comfyPage.fillPromptDialog(groupNodeName)
    await this.comfyPage.nextFrame()
    const nodes = await this.comfyPage.getNodeRefsByType(
      `workflow>${groupNodeName}`
    )
    if (nodes.length !== 1) {
      throw new Error(`Did not find single group node (found=${nodes.length})`)
    }
    return nodes[0]
  }
  async manageGroupNode() {
    await this.clickContextMenuOption('Manage Group Node')
    await this.comfyPage.nextFrame()
    return new ManageGroupNode(
      this.comfyPage.page,
      this.comfyPage.page.locator('.comfy-group-manage')
    )
  }
}
