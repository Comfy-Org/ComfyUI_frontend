import { expect } from '@playwright/test'
import type { ConsoleMessage, Locator, Page } from '@playwright/test'

import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import type { ComfyPage } from '../ComfyPage'
import { TestIds } from '../selectors'
import type { NodeReference } from '../utils/litegraphUtils'
import { SubgraphSlotReference } from '../utils/litegraphUtils'

export class SubgraphHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  private get page(): Page {
    return this.comfyPage.page
  }

  private async getSlotScreenPositions(
    slotType: 'input' | 'output',
    action: 'rightClick' | 'doubleClick',
    slotName?: string
  ): Promise<{ x: number; y: number; slotName: string }[]> {
    return this.page.evaluate(
      (params) => {
        const { slotType, action, targetSlotName } = params
        const app = window.app!
        const currentGraph = app.canvas!.graph!

        if (!('inputNode' in currentGraph)) {
          throw new Error(
            'Not in a subgraph - this method only works inside subgraphs'
          )
        }

        const subgraph = currentGraph as Subgraph

        const node =
          slotType === 'input' ? subgraph.inputNode : subgraph.outputNode
        const slots = slotType === 'input' ? subgraph.inputs : subgraph.outputs

        if (!node) {
          throw new Error(`No ${slotType} node found in subgraph`)
        }

        if (!slots || slots.length === 0) {
          throw new Error(`No ${slotType} slots found in subgraph`)
        }

        const slotsToTry = targetSlotName
          ? slots.filter((slot) => slot.name === targetSlotName)
          : action === 'rightClick'
            ? slots
            : [slots[0]]

        if (slotsToTry.length === 0) {
          throw new Error(
            targetSlotName
              ? `${slotType} slot '${targetSlotName}' not found`
              : `No ${slotType} slots available to try`
          )
        }

        const results: { x: number; y: number; slotName: string }[] = []

        for (const slot of slotsToTry) {
          let offsetX: number
          let offsetY: number

          if (action === 'rightClick') {
            if (!slot.pos) continue
            offsetX = slot.pos[0]
            offsetY = slot.pos[1]
          } else {
            if (!slot.boundingRect) {
              throw new Error(`${slotType} slot bounding rect not found`)
            }
            const rect = slot.boundingRect
            offsetX = rect[0] + rect[2] / 2
            offsetY = rect[1] + rect[3] / 2
          }

          const [canvasX, canvasY] = app.canvas.ds.convertOffsetToCanvas([
            offsetX,
            offsetY
          ])
          const [clientX, clientY] = app.canvasPosToClientPos([
            canvasX,
            canvasY
          ])
          results.push({ x: clientX, y: clientY, slotName: slot.name })
        }

        return results
      },
      { slotType, action, targetSlotName: slotName }
    )
  }

  private async rightClickSlot(
    slotType: 'input' | 'output',
    slotName?: string
  ): Promise<void> {
    const positions = await this.getSlotScreenPositions(
      slotType,
      'rightClick',
      slotName
    )

    if (positions.length === 0) {
      throw new Error(
        slotName
          ? `Could not open context menu for ${slotType} slot '${slotName}'`
          : `Could not find any ${slotType} slot to open context menu for`
      )
    }

    for (const pos of positions) {
      await this.page.mouse.click(pos.x, pos.y, { button: 'right' })
      await this.comfyPage.nextFrame()

      const menuVisible = await this.page
        .waitForSelector('.litemenu-entry', {
          state: 'visible',
          timeout: 1000
        })
        .then(() => true)
        .catch(() => false)

      if (menuVisible) return
    }

    await this.page.waitForSelector('.litemenu-entry', {
      state: 'visible',
      timeout: 5000
    })
  }

  private async doubleClickSlot(
    slotType: 'input' | 'output',
    slotName?: string
  ): Promise<void> {
    const positions = await this.getSlotScreenPositions(
      slotType,
      'doubleClick',
      slotName
    )

    if (positions.length === 0) {
      throw new Error(
        slotName
          ? `Could not double-click ${slotType} slot '${slotName}'`
          : `Could not find any ${slotType} slot to double-click`
      )
    }

    const pos = positions[0]
    await this.page.mouse.dblclick(pos.x, pos.y)
    await this.comfyPage.nextFrame()
  }

  /**
   * Right-clicks on a subgraph input slot to open the context menu.
   * Must be called when inside a subgraph.
   *
   * This method uses the actual slot positions from the subgraph.inputs array,
   * which contain the correct coordinates for each input slot. These positions
   * are different from the visual node positions and are specifically where
   * the slots are rendered on the input node.
   *
   * @param inputName Optional name of the specific input slot to target (e.g., 'text').
   *                  If not provided, tries all available input slots until one works.
   * @returns Promise that resolves when the context menu appears
   */
  async rightClickInputSlot(inputName?: string): Promise<void> {
    return this.rightClickSlot('input', inputName)
  }

  /**
   * Right-clicks on a subgraph output slot to open the context menu.
   * Must be called when inside a subgraph.
   *
   * Similar to rightClickInputSlot but for output slots.
   *
   * @param outputName Optional name of the specific output slot to target.
   *                   If not provided, tries all available output slots until one works.
   * @returns Promise that resolves when the context menu appears
   */
  async rightClickOutputSlot(outputName?: string): Promise<void> {
    return this.rightClickSlot('output', outputName)
  }

  /**
   * Double-clicks on a subgraph input slot to rename it.
   * Must be called when inside a subgraph.
   *
   * @param inputName Optional name of the specific input slot to target (e.g., 'text').
   *                  If not provided, tries the first available input slot.
   * @returns Promise that resolves when the rename dialog appears
   */
  async doubleClickInputSlot(inputName?: string): Promise<void> {
    return this.doubleClickSlot('input', inputName)
  }

  /**
   * Double-clicks on a subgraph output slot to rename it.
   * Must be called when inside a subgraph.
   *
   * @param outputName Optional name of the specific output slot to target.
   *                   If not provided, tries the first available output slot.
   * @returns Promise that resolves when the rename dialog appears
   */
  async doubleClickOutputSlot(outputName?: string): Promise<void> {
    return this.doubleClickSlot('output', outputName)
  }

  /**
   * Get a reference to a subgraph input slot
   */
  getInputSlot(slotName?: string): SubgraphSlotReference {
    return new SubgraphSlotReference('input', slotName || '', this.comfyPage)
  }

  /**
   * Get a reference to a subgraph output slot
   */
  getOutputSlot(slotName?: string): SubgraphSlotReference {
    return new SubgraphSlotReference('output', slotName || '', this.comfyPage)
  }

  /**
   * Connect a regular node output to a subgraph input.
   * This creates a new input slot on the subgraph if targetInputName is not provided.
   */
  async connectToInput(
    sourceNode: NodeReference,
    sourceSlotIndex: number,
    targetInputName?: string
  ): Promise<void> {
    const sourceSlot = await sourceNode.getOutput(sourceSlotIndex)
    const targetSlot = this.getInputSlot(targetInputName)

    const targetPosition = targetInputName
      ? await targetSlot.getPosition() // Connect to existing slot
      : await targetSlot.getOpenSlotPosition() // Create new slot

    await this.comfyPage.canvasOps.dragAndDrop(
      await sourceSlot.getPosition(),
      targetPosition
    )
    await this.comfyPage.nextFrame()
  }

  /**
   * Connect a subgraph input to a regular node input.
   * This creates a new input slot on the subgraph if sourceInputName is not provided.
   */
  async connectFromInput(
    targetNode: NodeReference,
    targetSlotIndex: number,
    sourceInputName?: string
  ): Promise<void> {
    const sourceSlot = this.getInputSlot(sourceInputName)
    const targetSlot = await targetNode.getInput(targetSlotIndex)

    const sourcePosition = sourceInputName
      ? await sourceSlot.getPosition() // Connect from existing slot
      : await sourceSlot.getOpenSlotPosition() // Create new slot

    const targetPosition = await targetSlot.getPosition()

    await this.comfyPage.canvasOps.dragAndDrop(sourcePosition, targetPosition)
    await this.comfyPage.nextFrame()
  }

  /**
   * Connect a regular node output to a subgraph output.
   * This creates a new output slot on the subgraph if targetOutputName is not provided.
   */
  async connectToOutput(
    sourceNode: NodeReference,
    sourceSlotIndex: number,
    targetOutputName?: string
  ): Promise<void> {
    const sourceSlot = await sourceNode.getOutput(sourceSlotIndex)
    const targetSlot = this.getOutputSlot(targetOutputName)

    const targetPosition = targetOutputName
      ? await targetSlot.getPosition() // Connect to existing slot
      : await targetSlot.getOpenSlotPosition() // Create new slot

    await this.comfyPage.canvasOps.dragAndDrop(
      await sourceSlot.getPosition(),
      targetPosition
    )
    await this.comfyPage.nextFrame()
  }

  /**
   * Connect a subgraph output to a regular node input.
   * This creates a new output slot on the subgraph if sourceOutputName is not provided.
   */
  async connectFromOutput(
    targetNode: NodeReference,
    targetSlotIndex: number,
    sourceOutputName?: string
  ): Promise<void> {
    const sourceSlot = this.getOutputSlot(sourceOutputName)
    const targetSlot = await targetNode.getInput(targetSlotIndex)

    const sourcePosition = sourceOutputName
      ? await sourceSlot.getPosition() // Connect from existing slot
      : await sourceSlot.getOpenSlotPosition() // Create new slot

    await this.comfyPage.canvasOps.dragAndDrop(
      sourcePosition,
      await targetSlot.getPosition()
    )
    await this.comfyPage.nextFrame()
  }

  async isInSubgraph(): Promise<boolean> {
    return this.page.evaluate(() => {
      const graph = window.app!.canvas.graph
      return !!graph && 'inputNode' in graph
    })
  }

  async exitViaBreadcrumb(): Promise<void> {
    const breadcrumb = this.page.getByTestId(TestIds.breadcrumb.subgraph)
    const rootItem = breadcrumb.getByTestId(TestIds.breadcrumb.root)

    if (await rootItem.isVisible().catch(() => false)) {
      await rootItem.click()
    } else {
      await this.page.evaluate(() => {
        const canvas = window.app!.canvas
        const graph = canvas.graph
        if (!graph) return
        canvas.setGraph(graph.rootGraph)
      })
    }

    await this.comfyPage.nextFrame()
    await expect.poll(async () => this.isInSubgraph()).toBe(false)
  }

  async countGraphPseudoPreviewEntries(): Promise<number> {
    return this.page.evaluate(() => {
      const graph = window.app!.graph!
      return graph.nodes.reduce((count, node) => {
        const proxyWidgets = node.properties?.proxyWidgets
        if (!Array.isArray(proxyWidgets)) return count

        return (
          count +
          proxyWidgets.filter(
            (entry) =>
              Array.isArray(entry) &&
              entry.length >= 2 &&
              typeof entry[1] === 'string' &&
              entry[1].startsWith('$$')
          ).length
        )
      }, 0)
    })
  }

  async getHostPromotedTupleSnapshot(): Promise<
    { hostNodeId: string; promotedWidgets: [string, string][] }[]
  > {
    return this.page.evaluate(() => {
      const graph = window.app!.canvas.graph!
      return graph._nodes
        .filter(
          (node) =>
            typeof node.isSubgraphNode === 'function' && node.isSubgraphNode()
        )
        .map((node) => {
          const proxyWidgets = Array.isArray(node.properties?.proxyWidgets)
            ? node.properties.proxyWidgets
            : []
          const promotedWidgets = proxyWidgets
            .filter(
              (entry): entry is [string, string] =>
                Array.isArray(entry) &&
                entry.length >= 2 &&
                typeof entry[0] === 'string' &&
                typeof entry[1] === 'string'
            )
            .map(
              ([interiorNodeId, widgetName]) =>
                [interiorNodeId, widgetName] as [string, string]
            )

          return {
            hostNodeId: String(node.id),
            promotedWidgets
          }
        })
        .sort((a, b) => Number(a.hostNodeId) - Number(b.hostNodeId))
    })
  }

  async getNodeCount(): Promise<number> {
    const domCount = await this.page.locator('[data-node-id]').count()
    if (domCount > 0) return domCount

    return this.page.evaluate(() => {
      return window.app!.canvas.graph!.nodes?.length || 0
    })
  }

  async getSlotCount(type: 'input' | 'output'): Promise<number> {
    return this.page.evaluate((slotType: 'input' | 'output') => {
      const graph = window.app!.canvas.graph
      if (!graph || !('inputNode' in graph)) return 0
      return graph[`${slotType}s`]?.length ?? 0
    }, type)
  }

  async getSlotLabel(
    type: 'input' | 'output',
    index = 0
  ): Promise<string | null> {
    return this.page.evaluate(
      ([slotType, idx]) => {
        const graph = window.app!.canvas.graph
        if (!graph || !('inputNode' in graph)) return null
        const slot = graph[`${slotType}s`]?.[idx]
        return slot?.label ?? slot?.name ?? null
      },
      [type, index] as const
    )
  }

  async removeSlot(type: 'input' | 'output', slotName?: string): Promise<void> {
    if (type === 'input') {
      await this.rightClickInputSlot(slotName)
    } else {
      await this.rightClickOutputSlot(slotName)
    }
    await this.comfyPage.contextMenu.clickLitegraphMenuItem('Remove Slot')
    await this.comfyPage.nextFrame()
  }

  async findSubgraphNodeId(): Promise<string> {
    const enterButton = this.page
      .getByTestId(TestIds.widgets.subgraphEnterButton)
      .first()

    if ((await enterButton.count()) > 0) {
      const nodeEl = enterButton
        .locator('xpath=ancestor::*[@data-node-id]')
        .first()
      const id = await nodeEl.getAttribute('data-node-id')
      if (id) return id
    }

    const id = await this.page.evaluate(() => {
      const graph = window.app!.canvas.graph!
      const node = graph.nodes.find(
        (n) => typeof n.isSubgraphNode === 'function' && n.isSubgraphNode()
      )
      return node ? String(node.id) : null
    })
    if (!id) throw new Error('No subgraph node found in current graph')
    return id
  }

  async serializeAndReload(): Promise<void> {
    const serialized = await this.page.evaluate(() =>
      window.app!.graph!.serialize()
    )
    await this.page.evaluate(
      (workflow: ComfyWorkflowJSON) => window.app!.loadGraphData(workflow),
      serialized as ComfyWorkflowJSON
    )
    await this.comfyPage.nextFrame()
  }

  async loadDefaultAndConvertKSamplerToSubgraph(): Promise<NodeReference> {
    await this.comfyPage.workflow.loadWorkflow('default')
    const ksampler = await this.comfyPage.nodeOps.getNodeRefById('3')
    await ksampler.click('title')
    return ksampler.convertToSubgraph()
  }

  async packAllInteriorNodes(hostNodeId: string): Promise<void> {
    await this.comfyPage.vueNodes.enterSubgraph(hostNodeId)
    await this.comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    await this.comfyPage.nextFrame()
    await this.comfyPage.canvas.click()
    await this.comfyPage.canvas.press('Control+a')
    await this.comfyPage.nextFrame()
    await this.page.evaluate(() => {
      const canvas = window.app!.canvas
      canvas.graph!.convertToSubgraph(canvas.selectedItems)
    })
    await this.comfyPage.nextFrame()
    await this.exitViaBreadcrumb()
    await this.comfyPage.canvas.click()
    await this.comfyPage.nextFrame()
  }

  static getTextSlotPosition(page: Page, nodeId: string) {
    return page.evaluate((id) => {
      const node = window.app!.canvas.graph!.getNodeById(id)
      if (!node) return null

      const titleHeight = window.LiteGraph!.NODE_TITLE_HEIGHT

      for (const input of node.inputs) {
        if (!input.widget || input.type !== 'STRING') continue
        return {
          hasPos: !!input.pos,
          posY: input.pos?.[1] ?? null,
          widgetName: input.widget.name,
          titleHeight
        }
      }
      return null
    }, nodeId)
  }

  static async expectWidgetBelowHeader(
    nodeLocator: Locator,
    widgetLocator: Locator
  ): Promise<void> {
    const headerBox = await nodeLocator
      .locator('[data-testid^="node-header-"]')
      .boundingBox()
    const widgetBox = await widgetLocator.boundingBox()
    if (!headerBox || !widgetBox)
      throw new Error('Header or widget bounding box not found')
    expect(widgetBox.y).toBeGreaterThan(headerBox.y + headerBox.height)
  }

  static collectConsoleWarnings(
    page: Page,
    patterns: string[] = [
      'No link found',
      'Failed to resolve legacy -1',
      'No inner link found'
    ]
  ): { warnings: string[]; dispose: () => void } {
    const warnings: string[] = []
    const handler = (msg: ConsoleMessage) => {
      const text = msg.text()
      if (patterns.some((p) => text.includes(p))) {
        warnings.push(text)
      }
    }
    page.on('console', handler)
    return { warnings, dispose: () => page.off('console', handler) }
  }
}
