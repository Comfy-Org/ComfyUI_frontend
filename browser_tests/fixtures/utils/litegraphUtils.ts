import type { Page } from '@playwright/test'

import type { NodeId } from '../../../src/platform/workflow/validation/schemas/workflowSchema'
import { ManageGroupNode } from '../../helpers/manageGroupNode'
import type { ComfyPage } from '../ComfyPage'
import type { Position, Size } from '../types'

export const getMiddlePoint = (pos1: Position, pos2: Position) => {
  return {
    x: (pos1.x + pos2.x) / 2,
    y: (pos1.y + pos2.y) / 2
  }
}

export class SubgraphSlotReference {
  constructor(
    readonly type: 'input' | 'output',
    readonly slotName: string,
    readonly comfyPage: ComfyPage
  ) {}

  async getPosition(): Promise<Position> {
    const pos: [number, number] = await this.comfyPage.page.evaluate(
      ([type, slotName]) => {
        const app = window.app
        if (!app) throw new Error('App not initialized')
        const currentGraph = app.canvas.graph
        if (!currentGraph) throw new Error('No graph available')

        // Check if we're in a subgraph
        if (currentGraph.constructor.name !== 'Subgraph') {
          throw new Error(
            'Not in a subgraph - this method only works inside subgraphs'
          )
        }

        const subgraph = currentGraph as {
          inputs?: Array<{ name: string; pos?: number[] }>
          outputs?: Array<{ name: string; pos?: number[] }>
        }
        const slots = type === 'input' ? subgraph.inputs : subgraph.outputs
        if (!slots || slots.length === 0) {
          throw new Error(`No ${type} slots found in subgraph`)
        }

        // Find the specific slot or use the first one if no name specified
        const slot = slotName
          ? slots.find((s: { name: string }) => s.name === slotName)
          : slots[0]

        if (!slot) {
          throw new Error(`${type} slot '${slotName}' not found`)
        }

        if (!slot.pos) {
          throw new Error(`${type} slot '${slotName}' has no position`)
        }

        // Convert from offset to canvas coordinates
        const canvasPos = app.canvas.ds.convertOffsetToCanvas([
          slot.pos[0],
          slot.pos[1]
        ])
        return canvasPos
      },
      [this.type, this.slotName] as const
    )

    return {
      x: pos[0],
      y: pos[1]
    }
  }

  async getOpenSlotPosition(): Promise<Position> {
    const pos: [number, number] = await this.comfyPage.page.evaluate(
      ([type]) => {
        const app = window.app
        if (!app) throw new Error('App not initialized')
        const currentGraph = app.canvas.graph
        if (!currentGraph) throw new Error('No graph available')

        if (currentGraph.constructor.name !== 'Subgraph') {
          throw new Error(
            'Not in a subgraph - this method only works inside subgraphs'
          )
        }

        const subgraph = currentGraph as {
          inputNode?: { pos: number[]; size: number[] }
          outputNode?: { pos: number[]; size: number[] }
          inputs?: Array<{ pos?: number[] }>
          outputs?: Array<{ pos?: number[] }>
          slotAnchorX?: number
        }
        const node = type === 'input' ? subgraph.inputNode : subgraph.outputNode
        const slots = type === 'input' ? subgraph.inputs : subgraph.outputs

        if (!node) {
          throw new Error(`No ${type} node found in subgraph`)
        }

        // Find last slot position
        const lastSlot = slots?.at(-1)
        let slotX: number
        let slotY: number

        if (lastSlot?.pos) {
          // If there are existing slots, position the new one below the last one
          const gapHeight = 20
          slotX = lastSlot.pos[0]
          slotY = lastSlot.pos[1] + gapHeight
        } else {
          // No existing slots - use slotAnchorX if available, otherwise calculate from node position
          if (subgraph.slotAnchorX !== undefined) {
            // The actual slot X position seems to be slotAnchorX - 10
            slotX = subgraph.slotAnchorX - 10
          } else {
            // Fallback: calculate from node edge
            slotX =
              type === 'input'
                ? node.pos[0] + node.size[0] - 10 // Right edge for input node
                : node.pos[0] + 10 // Left edge for output node
          }
          // For Y position when no slots exist, use middle of node
          slotY = node.pos[1] + node.size[1] / 2
        }

        // Convert from offset to canvas coordinates
        const canvasPos = app.canvas.ds.convertOffsetToCanvas([slotX, slotY])
        return canvasPos
      },
      [this.type] as const
    )

    return {
      x: pos[0],
      y: pos[1]
    }
  }
}

class NodeSlotReference {
  constructor(
    readonly type: 'input' | 'output',
    readonly index: number,
    readonly node: NodeReference
  ) {}
  async getPosition() {
    const pos: [number, number] = await this.node.comfyPage.page.evaluate(
      ([type, id, index]) => {
        const app = window.app
        if (!app?.canvas?.graph) throw new Error('App not initialized')
        const graph = app.canvas.graph
        // Use canvas.graph to get the current graph (works in both main graph and subgraphs)
        const node = graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)

        const rawPos = node.getConnectionPos(type === 'input', index)
        const convertedPos = app.canvas.ds.convertOffsetToCanvas(rawPos)

        return convertedPos
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
        const app = window.app
        if (!app?.canvas?.graph) throw new Error('App not initialized')
        const node = app.canvas.graph.getNodeById(id)
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
        const app = window.app
        if (!app?.canvas?.graph) throw new Error('App not initialized')
        const node = app.canvas.graph.getNodeById(id)
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

class NodeWidgetReference {
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
        const app = window.app
        if (!app?.canvas?.graph) throw new Error('App not initialized')
        const node = app.canvas.graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        if (!node.widgets) throw new Error(`Node ${id} has no widgets.`)
        const widget = node.widgets[index]
        if (!widget) throw new Error(`Widget ${index} not found.`)

        const [x, y, w] = node.getBounding()
        const titleHeight = window.LiteGraph?.NODE_TITLE_HEIGHT ?? 20
        return app.canvasPosToClientPos([
          x + w / 2,
          y + titleHeight + (widget.last_y ?? 0) + 1
        ])
      },
      [this.node.id, this.index] as const
    )
    return {
      x: pos[0],
      y: pos[1]
    }
  }

  /**
   * @returns The position of the widget's associated socket
   */
  async getSocketPosition(): Promise<Position> {
    const pos: [number, number] = await this.node.comfyPage.page.evaluate(
      ([id, index]) => {
        const app = window.app
        if (!app?.canvas?.graph) throw new Error('App not initialized')
        const node = app.canvas.graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        if (!node.widgets) throw new Error(`Node ${id} has no widgets.`)
        const widget = node.widgets[index]
        if (!widget) throw new Error(`Widget ${index} not found.`)

        const slot = node.inputs.find(
          (slot) => slot.widget?.name === widget.name
        )
        if (!slot) throw new Error(`Socket ${widget.name} not found.`)
        if (!slot.pos) throw new Error(`Socket ${widget.name} has no position.`)

        const [x, y] = node.getBounding()
        const titleHeight = window.LiteGraph?.NODE_TITLE_HEIGHT ?? 20
        return app.canvasPosToClientPos([
          x + slot.pos[0],
          y + slot.pos[1] + titleHeight
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
    await this.node.comfyPage.dragAndDrop(
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
        const app = window.app
        if (!app?.canvas?.graph) throw new Error('App not initialized')
        const node = app.canvas.graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        if (!node.widgets) throw new Error(`Node ${id} has no widgets.`)
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
      const app = window.app
      if (!app?.canvas?.graph) return false
      const node = app.canvas.graph.getNodeById(id)
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
    const bounding = await this.comfyPage.page.evaluate((id) => {
      const app = window.app
      if (!app?.canvas?.graph) throw new Error('App not initialized')
      const node = app.canvas.graph.getNodeById(id)
      if (!node) throw new Error('Node not found')
      const b = node.getBounding()
      return [b[0], b[1], b[2], b[3]] as [number, number, number, number]
    }, this.id)
    return {
      x: bounding[0],
      y: bounding[1],
      width: bounding[2],
      height: bounding[3]
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
    return (await this.comfyPage.page.evaluate(
      ([id, prop]) => {
        const app = window.app
        if (!app?.canvas?.graph) throw new Error('App not initialized')
        const node = app.canvas.graph.getNodeById(id)
        if (!node) throw new Error('Node not found')
        return (node as unknown as Record<string, unknown>)[prop]
      },
      [this.id, prop] as const
    )) as T
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
      position: clickPos,
      force: true
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
      await targetWidget.getSocketPosition()
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
  async convertToSubgraph() {
    await this.clickContextMenuOption('Convert to Subgraph')
    await this.comfyPage.nextFrame()
    const nodes = await this.comfyPage.getNodeRefsByTitle('New Subgraph')
    if (nodes.length !== 1) {
      throw new Error(
        `Did not find single subgraph node (found=${nodes.length})`
      )
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
  async navigateIntoSubgraph() {
    const titleHeight = await this.comfyPage.page.evaluate(() => {
      return window.LiteGraph?.NODE_TITLE_HEIGHT ?? 20
    })
    const nodePos = await this.getPosition()
    const nodeSize = await this.getSize()

    // Try multiple positions to avoid DOM widget interference
    const clickPositions = [
      { x: nodePos.x + nodeSize.width / 2, y: nodePos.y + titleHeight + 5 },
      { x: nodePos.x + nodeSize.width / 2, y: nodePos.y + nodeSize.height / 2 },
      { x: nodePos.x + 20, y: nodePos.y + titleHeight + 5 }
    ]

    let isInSubgraph = false
    let attempts = 0
    const maxAttempts = 3

    while (!isInSubgraph && attempts < maxAttempts) {
      attempts++

      for (const position of clickPositions) {
        // Clear any selection first
        await this.comfyPage.canvas.click({
          position: { x: 250, y: 250 },
          force: true
        })
        await this.comfyPage.nextFrame()

        // Double-click to enter subgraph
        await this.comfyPage.canvas.dblclick({ position, force: true })
        await this.comfyPage.nextFrame()

        // Check if we successfully entered the subgraph
        isInSubgraph = await this.comfyPage.page.evaluate(() => {
          const app = window.app
          if (!app) return false
          const graph = app.canvas.graph
          return graph?.constructor?.name === 'Subgraph'
        })

        if (isInSubgraph) break
      }

      if (!isInSubgraph && attempts < maxAttempts) {
        await this.comfyPage.page.waitForTimeout(500)
      }
    }

    if (!isInSubgraph) {
      throw new Error(
        'Failed to navigate into subgraph after ' + attempts + ' attempts'
      )
    }
  }
}
