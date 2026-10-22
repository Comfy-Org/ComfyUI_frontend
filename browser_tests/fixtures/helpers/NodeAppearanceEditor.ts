import type { Locator, Page } from '@playwright/test'

import { ContextMenu } from '@e2e/fixtures/components/ContextMenu'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * The user's own route to a node's appearance: the selection toolbox for
 * colour and the node context menu for shape. Both write the live node
 * directly, so a spec using this drives the same path a person does.
 */
export class NodeAppearanceEditor {
  private readonly contextMenu: ContextMenu
  private readonly vueNodes: VueNodeHelpers

  constructor(private readonly page: Page) {
    this.contextMenu = new ContextMenu(page)
    this.vueNodes = new VueNodeHelpers(page)
  }

  wrapper(nodeId: number | string): Locator {
    return this.vueNodes.getNodeInnerWrapper(String(nodeId))
  }

  async backgroundColor(nodeId: number | string): Promise<string> {
    return this.wrapper(nodeId).evaluate(
      (element) => getComputedStyle(element).backgroundColor
    )
  }

  async borderRadius(nodeId: number | string): Promise<string> {
    return this.wrapper(nodeId).evaluate(
      (element) => getComputedStyle(element).borderTopLeftRadius
    )
  }

  /**
   * Dispatched rather than clicked: with the agent panel open, the graph-mode
   * overlay covers the selection toolbox and an actionable click never lands.
   */
  async recolourRed(nodeId: number | string): Promise<void> {
    await this.vueNodes.selectNode(String(nodeId))
    await this.page
      .getByTestId(TestIds.selectionToolbox.colorPickerButton)
      .dispatchEvent('click')
    await this.page
      .getByTestId(TestIds.selectionToolbox.colorRed)
      .dispatchEvent('click')
  }

  async reshape(nodeId: number | string, shapeLabel: string): Promise<void> {
    await this.vueNodes.selectNode(String(nodeId))
    await this.vueNodes
      .getNodeLocator(String(nodeId))
      .click({ button: 'right' })
    await this.contextMenu.menuItem('Shape').hover()
    await this.page.getByRole('menuitemradio', { name: shapeLabel }).click()
  }
}
