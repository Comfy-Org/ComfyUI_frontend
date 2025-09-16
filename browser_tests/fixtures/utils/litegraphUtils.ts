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
        // Helper functions (duplicated in browser context)
        function pointToTuple(
          point: [x: number, y: number] | Float32Array | Float64Array
        ): [number, number] {
          if (Array.isArray(point)) {
            return [point[0], point[1]]
          }
          return [point[0], point[1]]
        }

        const currentGraph = window['app']?.canvas?.graph
        if (!currentGraph) {
          throw new Error('App canvas or graph not available')
        }

        // Check if we're in a subgraph
        if (currentGraph.constructor.name !== 'Subgraph') {
          throw new Error(
            'Not in a subgraph - this method only works inside subgraphs'
          )
        }

        const slots =
          type === 'input' ? currentGraph.inputs : currentGraph.outputs
        if (!slots || slots.length === 0) {
          throw new Error(`No ${type} slots found in subgraph`)
        }

        // Find the specific slot or use the first one if no name specified
        const slot = slotName
          ? slots.find((s: any) => s.name === slotName)
          : slots[0]

        if (!slot) {
          throw new Error(`${type} slot '${slotName}' not found`)
        }

        if (!slot.pos) {
          throw new Error(`${type} slot '${slotName}' has no position`)
        }

        // Convert from offset to canvas coordinates
        const canvasDs = window['app']?.canvas?.ds
        if (!canvasDs) {
          throw new Error('Canvas ds not available for coordinate conversion')
        }
        const canvasPos = canvasDs.convertOffsetToCanvas([
          slot.pos[0],
          slot.pos[1]
        ])
        return pointToTuple(canvasPos)
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
        // Helper functions (duplicated in browser context)
        function pointToTuple(
          point: [x: number, y: number] | Float32Array | Float64Array
        ): [number, number] {
          if (Array.isArray(point)) {
            return [point[0], point[1]]
          }
          return [point[0], point[1]]
        }

        const currentGraph = window['app']?.canvas?.graph
        if (!currentGraph) {
          throw new Error('App canvas or graph not available')
        }

        if (currentGraph.constructor.name !== 'Subgraph') {
          throw new Error(
            'Not in a subgraph - this method only works inside subgraphs'
          )
        }

        const node =
          type === 'input' ? currentGraph.inputNode : currentGraph.outputNode
        const slots =
          type === 'input' ? currentGraph.inputs : currentGraph.outputs

        if (!node) {
          throw new Error(`No ${type} node found in subgraph`)
        }

        // Find last slot position
        const lastSlot = slots?.at?.(-1)
        let slotX: number
        let slotY: number

        if (lastSlot?.pos) {
          // If there are existing slots, position the new one below the last one
          const gapHeight = 20
          slotX = lastSlot.pos[0]
          slotY = lastSlot.pos[1] + gapHeight
        } else {
          // No existing slots - use slotAnchorX if available, otherwise calculate from node position
          if (currentGraph.slotAnchorX !== undefined) {
            // The actual slot X position seems to be slotAnchorX - 10
            slotX = currentGraph.slotAnchorX - 10
          } else {
            // Fallback: calculate from node edge
            if (!node.pos || !node.size) {
              throw new Error(
                `Node position or size not available for ${type} node`
              )
            }
            slotX =
              type === 'input'
                ? node.pos[0] + node.size[0] - 10 // Right edge for input node
                : node.pos[0] + 10 // Left edge for output node
          }
          // For Y position when no slots exist, use middle of node
          if (!node.pos || !node.size) {
            throw new Error(
              `Node position or size not available for ${type} node`
            )
          }
          slotY = node.pos[1] + node.size[1] / 2
        }

        // Convert from offset to canvas coordinates
        const canvasDs = window['app']?.canvas?.ds
        if (!canvasDs) {
          throw new Error('Canvas ds not available for coordinate conversion')
        }
        const canvasPos = canvasDs.convertOffsetToCanvas([slotX, slotY])
        return pointToTuple(canvasPos)
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
        // Helper functions (duplicated in browser context)
        function pointToTuple(
          point: [x: number, y: number] | Float32Array | Float64Array
        ): [number, number] {
          if (Array.isArray(point)) {
            return [point[0], point[1]]
          }
          return [point[0], point[1]]
        }

        // Use canvas.graph to get the current graph (works in both main graph and subgraphs)
        const currentGraph = window['app']?.canvas?.graph
        if (!currentGraph) {
          throw new Error('App canvas or graph not available')
        }
        const node = currentGraph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)

        if (!node.getConnectionPos) {
          throw new Error(`Node ${id} does not have getConnectionPos method`)
        }
        const rawPos = node.getConnectionPos(type === 'input', index)
        const canvasDs = window['app']?.canvas?.ds
        if (!canvasDs) {
          throw new Error('Canvas ds not available for coordinate conversion')
        }
        const convertedPos = canvasDs.convertOffsetToCanvas(rawPos)
        const convertedPosTuple = pointToTuple(convertedPos)

        // Debug logging - convert Float32Arrays to regular arrays for visibility
        console.log(
          `NodeSlotReference debug for ${type} slot ${index} on node ${id}:`,
          {
            nodePos: node.pos ? [node.pos[0], node.pos[1]] : null,
            nodeSize: node.size ? [node.size[0], node.size[1]] : null,
            rawConnectionPos: pointToTuple(rawPos),
            convertedPos: convertedPosTuple,
            currentGraphType: currentGraph.constructor.name
          }
        )

        return convertedPosTuple
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
        const currentGraph = window['app']?.canvas?.graph
        if (!currentGraph) {
          throw new Error('App canvas or graph not available')
        }
        const node = currentGraph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        if (type === 'input') {
          const input = node.inputs?.[index]
          if (!input) throw new Error(`Input ${index} not found on node ${id}`)
          return input.link == null ? 0 : 1
        }
        const output = node.outputs?.[index]
        if (!output) throw new Error(`Output ${index} not found on node ${id}`)
        return output.links?.length ?? 0
      },
      [this.type, this.node.id, this.index] as const
    )
  }
  async removeLinks() {
    await this.node.comfyPage.page.evaluate(
      ([type, id, index]) => {
        const currentGraph = window['app']?.canvas?.graph
        if (!currentGraph) {
          throw new Error('App canvas or graph not available')
        }
        const node = currentGraph.getNodeById(id)
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
        // Helper functions (duplicated in browser context)
        function pointToTuple(
          point: [x: number, y: number] | Float32Array | Float64Array
        ): [number, number] {
          if (Array.isArray(point)) {
            return [point[0], point[1]]
          }
          return [point[0], point[1]]
        }

        const currentGraph = window['app']?.canvas?.graph
        if (!currentGraph) {
          throw new Error('App canvas or graph not available')
        }
        const node = currentGraph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        const widget = node.widgets?.[index]
        if (!widget) throw new Error(`Widget ${index} not found.`)
        if (typeof widget.last_y !== 'number') {
          throw new Error(`Widget ${index} does not have valid last_y property`)
        }

        if (!node.getBounding) {
          throw new Error(`Node ${id} does not have getBounding method`)
        }
        const [x, y, w] = node.getBounding()
        const app = window['app']
        if (!app?.canvasPosToClientPos) {
          throw new Error('App canvasPosToClientPos not available')
        }
        const nodeTitle = (window as any)['LiteGraph']?.['NODE_TITLE_HEIGHT']
        if (nodeTitle === undefined) {
          throw new Error('LiteGraph NODE_TITLE_HEIGHT not available')
        }
        const clientPos = app.canvasPosToClientPos([
          x + w / 2,
          y + nodeTitle + widget.last_y + 1
        ])
        return pointToTuple(clientPos)
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
        // Helper functions (duplicated in browser context)
        function pointToTuple(
          point: [x: number, y: number] | Float32Array | Float64Array
        ): [number, number] {
          if (Array.isArray(point)) {
            return [point[0], point[1]]
          }
          return [point[0], point[1]]
        }

        const app = window['app']
        if (!app?.graph) {
          throw new Error('App graph not available')
        }
        const node = app.graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        const widget = node.widgets?.[index]
        if (!widget) throw new Error(`Widget ${index} not found.`)

        const slot = node.inputs?.find(
          (slot: any) => slot.widget?.name === widget.name
        )
        if (!slot) throw new Error(`Socket ${widget.name} not found.`)

        if (!node.getBounding) {
          throw new Error(`Node ${id} does not have getBounding method`)
        }
        const [x, y] = node.getBounding()
        if (!app.canvasPosToClientPos) {
          throw new Error('App canvasPosToClientPos not available')
        }
        const nodeTitle = (window as any)['LiteGraph']?.['NODE_TITLE_HEIGHT']
        if (nodeTitle === undefined) {
          throw new Error('LiteGraph NODE_TITLE_HEIGHT not available')
        }
        if (!slot.pos) {
          throw new Error(
            `Slot position not available for widget ${widget.name}`
          )
        }
        const clientPos = app.canvasPosToClientPos([
          x + slot.pos[0],
          y + slot.pos[1] + nodeTitle
        ])
        return pointToTuple(clientPos)
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
    const canvasPos = await canvas.boundingBox()
    if (!canvasPos) {
      throw new Error('Canvas bounding box not available')
    }
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
        const app = window['app']
        if (!app?.graph) {
          throw new Error('App graph not available')
        }
        const node = app.graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        const widget = node.widgets?.[index]
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
      const currentGraph = window['app']?.canvas?.graph
      if (!currentGraph) return false
      const node = currentGraph.getNodeById(id)
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
        const currentGraph = window['app']?.canvas?.graph
        if (!currentGraph) {
          throw new Error('App canvas or graph not available')
        }
        const node = currentGraph.getNodeById(id)
        if (!node) throw new Error('Node not found')
        if (!node.getBounding) {
          throw new Error(`Node ${id} does not have getBounding method`)
        }
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
        const currentGraph = window['app']?.canvas?.graph
        if (!currentGraph) {
          throw new Error('App canvas or graph not available')
        }
        const node = currentGraph.getNodeById(id)
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
    await this.comfyPage.page.waitForTimeout(256)
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
      return (window as any)['LiteGraph']['NODE_TITLE_HEIGHT']
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
          position: { x: 50, y: 50 },
          force: true
        })
        await this.comfyPage.nextFrame()

        // Double-click to enter subgraph
        await this.comfyPage.canvas.dblclick({ position, force: true })
        await this.comfyPage.nextFrame()
        await this.comfyPage.page.waitForTimeout(500)

        // Check if we successfully entered the subgraph
        isInSubgraph = await this.comfyPage.page.evaluate(() => {
          const graph = window['app']?.canvas?.graph
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
