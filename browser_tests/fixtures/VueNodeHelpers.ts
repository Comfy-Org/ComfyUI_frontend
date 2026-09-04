/**
 * Vue Node Test Helpers
 */
import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'
import { comfyExpect as expect } from '@e2e/fixtures/utils/customMatchers'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { toNodeId } from '@/types/nodeId'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

const GRAPH_SIZE_GROWTH: [number, number] = [90, 100]

export class VueNodeHelpers {
  /**
   * Get locator for all Vue node components in the DOM
   */
  public readonly nodes: Locator
  /**
   * Get locator for selected Vue node components (using visual selection indicators)
   */
  public readonly selectedNodes: Locator

  constructor(private page: Page) {
    this.nodes = page.locator('[data-node-id]')
    this.selectedNodes = page.locator(
      '[data-node-id].outline-node-component-outline'
    )
  }

  /**
   * Get locator for a Vue node by its NodeId
   */
  getNodeLocator(nodeId: string): Locator {
    return this.page.locator(`[data-node-id="${nodeId}"]`)
  }

  /**
   * Get the inner wrapper element of a Vue node.
   */
  getNodeInnerWrapper(nodeId: string): Locator {
    return this.getNodeLocator(nodeId).getByTestId(TestIds.node.innerWrapper)
  }

  getInputSlotRow(nodeId: string, slotIndex: number): Locator {
    return this.getNodeLocator(nodeId)
      .locator('.lg-slot--input')
      .filter({
        has: this.page.locator(
          `[data-slot-key="${getSlotKey(toNodeId(nodeId), slotIndex, true)}"]`
        )
      })
  }

  getInputSlotConnectionDot(nodeId: string, slotIndex: number): Locator {
    return this.getInputSlotRow(nodeId, slotIndex).getByTestId(
      TestIds.node.slotConnectionDot
    )
  }

  getOutputSlotRow(nodeId: string, slotIndex: number): Locator {
    return this.getNodeLocator(nodeId)
      .locator('.lg-slot--output')
      .filter({
        has: this.page.locator(
          `[data-slot-key="${getSlotKey(toNodeId(nodeId), slotIndex, false)}"]`
        )
      })
  }

  getOutputSlotConnectionDot(nodeId: string, slotIndex: number): Locator {
    return this.getOutputSlotRow(nodeId, slotIndex).getByTestId(
      TestIds.node.slotConnectionDot
    )
  }

  /**
   * Get locator for Vue nodes by the node's title (displayed name in the header).
   * Matches against the actual title element, not the full node body.
   * Use `.first()` for unique titles, `.nth(n)` for duplicates.
   */
  getNodeByTitle(title: string | RegExp): Locator {
    return this.page.locator('[data-node-id]').filter({
      has: this.page.getByTestId('node-title').filter({ hasText: title })
    })
  }

  /**
   * Get total count of Vue nodes in the DOM
   */
  async getNodeCount(): Promise<number> {
    return await this.nodes.count()
  }

  /**
   * Get all Vue node IDs currently in the DOM
   */
  async getNodeIds(): Promise<string[]> {
    return await this.nodes.evaluateAll((nodes) =>
      nodes
        .map((n) => n.getAttribute('data-node-id'))
        .filter((id): id is string => id !== null)
    )
  }

  async expectGraphSizeGrowth(nodeId: string, label: string): Promise<void> {
    const node = this.getNodeLocator(nodeId)
    const before = await node.boundingBox()
    if (!before) throw new Error(`${label}: node is not rendered`)

    const scale = await this.page.evaluate(
      ({ id, growth }) => {
        const node = window.app?.canvas.graph?.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found`)

        node.setSize([
          node.renderingSize[0] + growth[0],
          node.renderingSize[1] + growth[1]
        ])
        return window.app!.canvas.ds.scale
      },
      { id: toNodeId(nodeId), growth: GRAPH_SIZE_GROWTH }
    )

    await expect(node, label).toHaveBounds({
      ...before,
      width: before.width + GRAPH_SIZE_GROWTH[0] * scale,
      height: before.height + GRAPH_SIZE_GROWTH[1] * scale
    })
  }

  /**
   * Select a specific Vue node by ID
   */
  async selectNode(nodeId: string): Promise<void> {
    await this.page
      .locator(`[data-node-id="${nodeId}"] .lg-node-header`)
      .click()
  }

  /**
   * Select multiple Vue nodes by IDs using Ctrl+click
   */
  async selectNodes(nodeIds: string[]): Promise<void> {
    if (nodeIds.length === 0) return

    // Select first node normally
    await this.selectNode(nodeIds[0])

    // Add additional nodes with Ctrl+click on header
    for (let i = 1; i < nodeIds.length; i++) {
      await this.page
        .locator(`[data-node-id="${nodeIds[i]}"] .lg-node-header`)
        .click({
          modifiers: ['Control']
        })
    }
  }

  /**
   * Clear all selections by clicking empty space
   */
  async clearSelection(): Promise<void> {
    await this.page.mouse.click(50, 50)
  }

  /**
   * Delete selected Vue nodes using Delete key
   */
  async deleteSelected(): Promise<void> {
    await this.page.locator('#graph-canvas').focus()
    await this.page.keyboard.press('Delete')
  }

  /**
   * Select a node by ID and delete it.
   */
  async deleteNode(nodeId: string): Promise<void> {
    await this.selectNode(nodeId)
    await this.deleteSelected()
  }

  /**
   * Delete selected Vue nodes using Backspace key
   */
  async deleteSelectedWithBackspace(): Promise<void> {
    await this.page.locator('#graph-canvas').focus()
    await this.page.keyboard.press('Backspace')
  }

  /**
   * Resolve the data-node-id of the first rendered node matching the title.
   */
  async getNodeIdByTitle(title: string | RegExp): Promise<string> {
    const node = this.getNodeByTitle(title).first()
    await node.waitFor({ state: 'visible' })

    const nodeId = await node.evaluate((el) => el.getAttribute('data-node-id'))
    if (!nodeId) {
      throw new Error(
        `Vue node titled "${title}" is missing its data-node-id attribute`
      )
    }

    return nodeId
  }

  /**
   * Return a DOM-focused VueNodeFixture for the first node matching the title.
   * Resolves the node id up front so subsequent interactions survive title changes.
   */
  async getFixtureByTitle(title: string | RegExp): Promise<VueNodeFixture> {
    const nodeId = await this.getNodeIdByTitle(title)
    return new VueNodeFixture(this.getNodeLocator(nodeId))
  }

  /**
   * Wait for Vue nodes to be rendered
   */
  async waitForNodes(expectedCount?: number): Promise<void> {
    try {
      if (expectedCount !== undefined) {
        await this.page.waitForFunction(
          (count) =>
            document.querySelectorAll('[data-node-id]').length >= count,
          expectedCount
        )
      } else {
        await this.page.locator('[data-node-id]').first().waitFor()
      }
    } catch (error) {
      // Below the level-of-detail threshold no `[data-node-id]` is ever
      // created, so this waits out its full timeout and reports only that a
      // locator was not found - which points at the node rather than the zoom,
      // and costs the timeout on every test in the file. Say so instead.
      const belowLod = await this.page.evaluate(() => {
        const canvas = window.app?.canvas
        const minFontSize = canvas?.min_font_size_for_lod ?? 0
        if (!canvas || minFontSize <= 0) return null

        const textSize = window.LiteGraph?.NODE_TEXT_SIZE ?? 14
        const threshold =
          minFontSize / (textSize * Math.sqrt(window.devicePixelRatio || 1))
        return canvas.ds.scale < threshold
          ? { scale: canvas.ds.scale, threshold }
          : null
      })

      if (belowLod) {
        throw new Error(
          `No Vue nodes are addressable: canvas zoom ${belowLod.scale.toFixed(3)} is below the level-of-detail threshold ${belowLod.threshold.toFixed(3)}, so nodes render as canvas boxes with no [data-node-id] element. Call ensureNodesAddressable(comfyPage) after loading, or set a zoom above the threshold.`,
          { cause: error }
        )
      }
      throw error
    }
  }

  /**
   * Get a specific widget by node title and widget name
   */
  getWidgetByName(nodeTitle: string, widgetName: string): Locator {
    return this.getNodeByTitle(nodeTitle).getByLabel(widgetName, {
      exact: true
    })
  }

  getWidgetRowByLabel(nodeTitle: string, widgetName: string): Locator {
    const widgetLabel = this.page
      .getByTestId(TestIds.widgets.layoutFieldLabel)
      .and(this.page.getByText(widgetName, { exact: true }))

    return this.getNodeByTitle(nodeTitle)
      .getByTestId(TestIds.widgets.widget)
      .filter({ has: widgetLabel })
  }

  /**
   * Get the visible widget tooltip text element (PrimeVue tooltip portal).
   */
  getVisibleWidgetTooltip(): Locator {
    return this.page.locator('.p-tooltip-text:visible')
  }

  /**
   * Select an option from a combo widget on a node.
   */
  async selectComboOption(
    nodeTitle: string,
    widgetName: string,
    optionName: string
  ): Promise<void> {
    const node = this.getNodeByTitle(nodeTitle)
    await node.getByRole('combobox', { name: widgetName, exact: true }).click()
    await this.page
      .getByRole('option', { name: optionName, exact: true })
      .click()
  }

  /**
   * Get controls for input number widgets (increment/decrement buttons and input)
   */
  getInputNumberControls(widget: Locator) {
    return {
      input: widget.locator('input'),
      decrementButton: widget.getByTestId(TestIds.widgets.decrement),
      incrementButton: widget.getByTestId(TestIds.widgets.increment),
      valueControl: widget.getByTestId(TestIds.widgets.valueControl)
    }
  }

  /**
   * Locator for the Enter Subgraph footer button.
   */
  getSubgraphEnterButton(nodeId?: string): Locator {
    const root = nodeId ? this.getNodeLocator(nodeId) : this.page
    return root.getByTestId(TestIds.widgets.subgraphEnterButton).first()
  }

  /**
   * Enter the subgraph of a node.
   * @param nodeId - The ID of the node to enter the subgraph of. If not provided, the first matched subgraph will be entered.
   */
  async enterSubgraph(nodeId?: string): Promise<void> {
    const editButton = this.getSubgraphEnterButton(nodeId)

    // The footer tab button extends below the node body (visible area),
    // but its bounding box center overlaps the node body div.
    // Click at the bottom 25% of the button which is the genuinely visible
    // and unobstructed area outside the node body boundary.
    const box = await editButton.boundingBox()
    if (!box) {
      throw new Error(
        'subgraph-enter-button has no bounding box: element may be hidden or not in DOM'
      )
    }
    await editButton.click({
      position: { x: box.width / 2, y: box.height * 0.75 }
    })
  }
  async isSlotConnected(slot: Locator) {
    const key = await slot.getByTestId('slot-dot').getAttribute('data-slot-key')
    if (!key) return false

    const [rawNodeId, type, slotId] = key.split('-')
    const nodeId = toNodeId(rawNodeId)
    return await this.page.evaluate(
      ([nodeId, type, slotId]) => {
        const node = app?.canvas?.graph?.getNodeById(nodeId)
        if (!node) return false

        return type === 'in'
          ? node.inputs[Number(slotId)]?.link !== null
          : !!node.outputs[Number(slotId)]?.links?.length
      },
      [nodeId, type, slotId] as const
    )
  }
}
