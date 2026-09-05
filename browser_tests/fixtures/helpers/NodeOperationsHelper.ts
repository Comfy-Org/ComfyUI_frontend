import type { Locator } from '@playwright/test'

import type {
  GraphAddOptions,
  LGraph,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'
import type { Position, Size } from '@e2e/fixtures/types'
import { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'
import type { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

export class NodeOperationsHelper {
  public readonly promptDialogInput: Locator

  constructor(private comfyPage: ComfyPage) {
    this.promptDialogInput = this.page.getByRole('dialog').getByRole('textbox')
  }

  private get page() {
    return this.comfyPage.page
  }

  async getGraphNodesCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return window.app?.graph.nodes.length || 0
    })
  }

  async getSelectedGraphNodesCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return (
        window.app?.graph.nodes.filter(
          (node: LGraphNode) => node.is_selected === true
        ).length || 0
      )
    })
  }

  async getSelectedNodeIds(): Promise<NodeId[]> {
    const selectedNodeIds = await this.page.evaluate(() => {
      const selected = window.app?.canvas.selected_nodes
      if (!selected) return []
      return Object.keys(selected)
    })
    return selectedNodeIds.map(toNodeId)
  }

  /**
   * Add a node to the graph by type.
   * @param type - The node type (e.g. 'KSampler', 'VAEDecode')
   * @param options - GraphAddOptions (ghost, skipComputeOrder). When ghost is
   *   true and position is provided, a synthetic MouseEvent is created as the
   *   dragEvent.
   * @param position - When ghost is true, client coordinates for the ghost
   *   placement dragEvent. Otherwise, world coordinates assigned to node.pos.
   */
  async addNode(
    type: string,
    options?: Omit<GraphAddOptions, 'dragEvent'>,
    position?: Position
  ): Promise<NodeReference> {
    const id = await this.page.evaluate(
      ([nodeType, opts, pos]) => {
        const node = window.LiteGraph!.createNode(nodeType)!
        const addOpts: Record<string, unknown> = { ...opts }
        if (opts.ghost && pos) {
          addOpts.dragEvent = new MouseEvent('click', {
            clientX: pos.x,
            clientY: pos.y
          })
        } else if (pos) {
          node.pos = [pos.x, pos.y]
        }
        window.app!.graph.add(node, addOpts as GraphAddOptions)
        return node.id
      },
      [type, options ?? {}, position ?? null] as const
    )
    return new NodeReference(id, this.comfyPage)
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

  async waitForGraphNodes(count: number): Promise<void> {
    await this.page.waitForFunction((count) => {
      return window.app?.canvas.graph?.nodes.length === count
    }, count)
  }

  async getFirstNodeRef(): Promise<NodeReference | null> {
    const id = await this.page.evaluate(() => {
      return window.app!.graph.nodes[0]?.id
    })
    if (!id) return null
    return this.getNodeRefById(id)
  }

  async getNodeRefById(id: SerializedNodeId): Promise<NodeReference> {
    return new NodeReference(toNodeId(id), this.comfyPage)
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
      ).map((id: SerializedNodeId) => this.getNodeRefById(id))
    )
  }

  async getNodeRefByType(
    type: string,
    includeSubgraph: boolean = false
  ): Promise<NodeReference> {
    const node = (await this.getNodeRefsByType(type, includeSubgraph)).at(0)
    if (!node) throw new Error(`Node of type "${type}" not found`)
    return node
  }

  async getNodeRefsByTitle(title: string): Promise<NodeReference[]> {
    return Promise.all(
      (
        await this.page.evaluate((title) => {
          return window
            .app!.graph.nodes.filter((n: LGraphNode) => n.title === title)
            .map((n: LGraphNode) => n.id)
        }, title)
      ).map((id: SerializedNodeId) => this.getNodeRefById(id))
    )
  }

  async getNodeRefByTitle(title: string): Promise<NodeReference> {
    const node = (await this.getNodeRefsByTitle(title)).at(0)
    if (!node) throw new Error(`Node titled "${title}" not found`)
    return node
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

  async getSerializedGraph(): Promise<ComfyWorkflowJSON> {
    return this.page.evaluate(
      () => window.app!.graph.serialize() as ComfyWorkflowJSON
    )
  }

  async loadGraph(data: ComfyWorkflowJSON): Promise<void> {
    await this.page.evaluate(
      (d) => window.app!.loadGraphData(d, true, true, null),
      data
    )
  }

  async repositionNodes(
    positions: Record<string, [number, number]>
  ): Promise<void> {
    const data = await this.getSerializedGraph()
    applyNodePositions(data, positions)
    await this.loadGraph(data)
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

  /**
   * Enlarges the node titled `title` by dragging its bottom-right Vue resize
   * handle. The returned size is read from the graph model, not a DOM bounding
   * box, so it stays comparable across zoom and side-panel layout changes.
   */
  async growNodeByDrag(
    title: string,
    delta: { x: number; y: number }
  ): Promise<{ nodeRef: NodeReference; node: VueNodeFixture; size: Size }> {
    const nodeRefs = await this.getNodeRefsByTitle(title)
    if (nodeRefs.length === 0) {
      throw new Error(`No node titled "${title}" on the canvas`)
    }
    const nodeRef = nodeRefs[0]

    // Saved pans can leave the node too low for a downward drag to stay onscreen.
    await nodeRef.centerOnNode()

    const node = await this.comfyPage.vueNodes.getFixtureByTitle(title)
    const sizeBefore = await nodeRef.getSize()
    await node.resizeFromCorner('SE', delta.x, delta.y)
    await this.comfyPage.nextFrame()

    const size = await nodeRef.getSize()
    if (size.width <= sizeBefore.width || size.height <= sizeBefore.height) {
      throw new Error(
        `Resize drag did not enlarge "${title}": ${sizeBefore.width}x${sizeBefore.height} -> ${size.width}x${size.height}`
      )
    }

    return { nodeRef, node, size }
  }

  async fillPromptDialog(value: string): Promise<void> {
    await this.promptDialogInput.fill(value)
    await this.page.keyboard.press('Enter')
    await this.promptDialogInput.waitFor({ state: 'hidden' })
    await this.comfyPage.nextFrame()
  }

  async fillLegacyWidgetDialog(value: string): Promise<void> {
    const dialogInput = this.page.locator('.graphdialog input[type="text"]')
    await dialogInput.click()
    await dialogInput.fill(value)
    await dialogInput.press('Enter')
    await this.comfyPage.nextFrame()
  }

  async panToNode(nodeRef: NodeReference): Promise<void> {
    const nodePos = await nodeRef.getPosition()
    await this.page.evaluate((pos) => {
      const canvas = window.app!.canvas
      canvas.ds.offset[0] = -pos.x + canvas.canvas.width / 2
      canvas.ds.offset[1] = -pos.y + canvas.canvas.height / 2 + 100
      canvas.setDirty(true, true)
    }, nodePos)
    await this.comfyPage.nextFrame()
  }

  async selectNodeWithPan(nodeRef: NodeReference): Promise<void> {
    await this.panToNode(nodeRef)
    await nodeRef.click('title')
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
    await this.fillLegacyWidgetDialog('128')
  }
}

function applyNodePositions(
  data: ComfyWorkflowJSON,
  positions: Record<string, [number, number]>
): void {
  for (const node of data.nodes) {
    const id = String(node.id)
    if (Object.hasOwn(positions, id)) node.pos = positions[id]
  }
}
