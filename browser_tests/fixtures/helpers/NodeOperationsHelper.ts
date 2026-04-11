import type { Locator } from '@playwright/test'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'
import type { Position, Size } from '@e2e/fixtures/types'
import { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

export class NodeOperationsHelper {
  public readonly promptDialogInput: Locator

  constructor(private comfyPage: ComfyPage) {
    this.promptDialogInput = this.page.locator(
      '.p-dialog-content input[type="text"]'
    )
  }

  private get page() {
    return this.comfyPage.page
  }

  async getGraphNodesCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return window.app?.graph?.nodes?.length || 0
    })
  }

  async getSelectedGraphNodesCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return (
        window.app?.graph?.nodes?.filter(
          (node: LGraphNode) => node.is_selected === true
        ).length || 0
      )
    })
  }

  /** Remove all nodes from the graph and clean. */
  async clearGraph() {
    await this.comfyPage.settings.setSetting('Comfy.ConfirmClear', false)
    await this.comfyPage.command.executeCommand('Comfy.ClearWorkflow')
  }

  /** Reads from `window.app.graph` (the root workflow graph). */
  async getNodeCount(): Promise<number> {
    return await this.page.evaluate(() => window.app!.graph.nodes.length)
  }

  async getNodes(): Promise<LGraphNode[]> {
    return await this.page.evaluate(() => {
      return window.app!.graph.nodes
    })
  }

  async waitForGraphNodes(count: number): Promise<void> {
    await this.page.waitForFunction((count) => {
      return window.app?.canvas.graph?.nodes?.length === count
    }, count)
  }

  async getFirstNodeRef(): Promise<NodeReference | null> {
    const id = await this.page.evaluate(() => {
      return window.app!.graph.nodes[0]?.id
    })
    if (!id) return null
    return this.getNodeRefById(id)
  }

  async getNodeRefById(id: NodeId): Promise<NodeReference> {
    return new NodeReference(id, this.comfyPage)
  }

  async getNodeRefsByType(
    type: string,
    includeSubgraph: boolean = false
  ): Promise<NodeReference[]> {
    return Promise.all(
      (
        await this.page.evaluate(
          ({ type, includeSubgraph }) => {
            const graph = (
              includeSubgraph ? window.app!.canvas.graph : window.app!.graph
            ) as LGraph
            const nodes = graph.nodes
            return nodes
              .filter((n: LGraphNode) => n.type === type)
              .map((n: LGraphNode) => n.id)
          },
          { type, includeSubgraph }
        )
      ).map((id: NodeId) => this.getNodeRefById(id))
    )
  }

  async getNodeRefsByTitle(title: string): Promise<NodeReference[]> {
    return Promise.all(
      (
        await this.page.evaluate((title) => {
          return window
            .app!.graph.nodes.filter((n: LGraphNode) => n.title === title)
            .map((n: LGraphNode) => n.id)
        }, title)
      ).map((id: NodeId) => this.getNodeRefById(id))
    )
  }

  async selectNodes(nodeTitles: string[]): Promise<void> {
    await this.page.keyboard.down('Control')
    try {
      for (const nodeTitle of nodeTitles) {
        const nodes = await this.getNodeRefsByTitle(nodeTitle)
        for (const node of nodes) {
          await node.click('title')
        }
      }
    } finally {
      await this.page.keyboard.up('Control')
      await this.comfyPage.nextFrame()
    }
  }

  async resizeNode(
    nodePos: Position,
    nodeSize: Size,
    ratioX: number,
    ratioY: number,
    revertAfter: boolean = false
  ): Promise<void> {
    const bottomRight = {
      x: nodePos.x + nodeSize.width,
      y: nodePos.y + nodeSize.height
    }
    const target = {
      x: nodePos.x + nodeSize.width * ratioX,
      y: nodePos.y + nodeSize.height * ratioY
    }
    // -1 to be inside the node.  -2 because nodes currently get an arbitrary +1 to width.
    await this.comfyPage.canvasOps.dragAndDrop(
      { x: bottomRight.x - 2, y: bottomRight.y - 1 },
      target
    )
    if (revertAfter) {
      await this.comfyPage.canvasOps.dragAndDrop(
        { x: target.x - 2, y: target.y - 1 },
        bottomRight
      )
    }
  }

  async convertAllNodesToGroupNode(groupNodeName: string): Promise<void> {
    await this.comfyPage.canvas.press('Control+a')
    const node = await this.getFirstNodeRef()
    if (!node) {
      throw new Error('No nodes found to convert')
    }
    await node.clickContextMenuOption('Convert to Group Node')
    await this.fillPromptDialog(groupNodeName)
  }

  async fillPromptDialog(value: string): Promise<void> {
    await this.promptDialogInput.fill(value)
    await this.page.keyboard.press('Enter')
    await this.promptDialogInput.waitFor({ state: 'hidden' })
    await this.comfyPage.nextFrame()
  }

  async dragTextEncodeNode2(): Promise<void> {
    await this.comfyPage.canvasOps.dragAndDrop(
      DefaultGraphPositions.textEncodeNode2,
      {
        x: DefaultGraphPositions.textEncodeNode2.x,
        y: 300
      }
    )
  }

  async adjustEmptyLatentWidth(): Promise<void> {
    await this.page.locator('#graph-canvas').click({
      position: DefaultGraphPositions.emptyLatentWidgetClick
    })
    const dialogInput = this.page.locator('.graphdialog input[type="text"]')
    await dialogInput.click()
    await dialogInput.fill('128')
    await dialogInput.press('Enter')
    await this.comfyPage.nextFrame()
  }
}
