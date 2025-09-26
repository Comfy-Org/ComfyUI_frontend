/**
 * Vue Node Test Helpers
 */
import type { Locator, Page } from '@playwright/test'

export class VueNodeHelpers {
  constructor(private page: Page) {}

  /**
   * Get locator for all Vue node components in the DOM
   */
  get nodes(): Locator {
    return this.page.locator('[data-node-id]')
  }

  /**
   * Get locator for a Vue node by its NodeId
   */
  getNodeLocator(nodeId: string): Locator {
    return this.page.locator(`[data-node-id="${nodeId}"]`)
  }

  /**
   * Get locator for selected Vue node components (using visual selection indicators)
   */
  get selectedNodes(): Locator {
    return this.page.locator(
      '[data-node-id].outline-black, [data-node-id].outline-white'
    )
  }

  /**
   * Get total count of Vue nodes in the DOM
   */
  async getNodeCount(): Promise<number> {
    return await this.nodes.count()
  }

  /**
   * Get count of selected Vue nodes
   */
  async getSelectedNodeCount(): Promise<number> {
    return await this.selectedNodes.count()
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

  /**
   * Select a specific Vue node by ID
   */
  async selectNode(nodeId: string): Promise<void> {
    await this.page.locator(`[data-node-id="${nodeId}"]`).click()
  }

  /**
   * Select multiple Vue nodes by IDs using Ctrl+click
   */
  async selectNodes(nodeIds: string[]): Promise<void> {
    if (nodeIds.length === 0) return

    // Select first node normally
    await this.selectNode(nodeIds[0])

    // Add additional nodes with Ctrl+click
    for (let i = 1; i < nodeIds.length; i++) {
      await this.page.locator(`[data-node-id="${nodeIds[i]}"]`).click({
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
   * Delete selected Vue nodes using Backspace key
   */
  async deleteSelectedWithBackspace(): Promise<void> {
    await this.page.locator('#graph-canvas').focus()
    await this.page.keyboard.press('Backspace')
  }

  /**
   * Wait for Vue nodes to be rendered
   */
  async waitForNodes(expectedCount?: number): Promise<void> {
    if (expectedCount !== undefined) {
      await this.page.waitForFunction(
        (count) => document.querySelectorAll('[data-node-id]').length >= count,
        expectedCount
      )
    } else {
      await this.page.waitForSelector('[data-node-id]')
    }
  }
}
