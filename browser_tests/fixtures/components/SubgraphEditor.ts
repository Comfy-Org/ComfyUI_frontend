import type { Locator } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

export class SubgraphEditor {
  public readonly root

  constructor(protected readonly comfyPage: ComfyPage) {
    this.root = this.comfyPage.menu.propertiesPanel.root
  }

  async open(subgraphNode: Locator) {
    await this.comfyPage.vueNodes.selectNodeByLocator(subgraphNode)
    // TODO: don't use commands for this
    await this.comfyPage.command.executeCommand(
      'Comfy.Graph.EditSubgraphWidgets'
    )
    await expect(this.root, 'Open Properties Panel').toBeVisible()
  }

  resolvePromotionItem(options: {
    nodeName?: string
    nodeId?: string
    widgetName: string
  }): Locator {
    const labelLocator = this.comfyPage.page
      .getByTestId(TestIds.subgraphEditor.widgetLabel)
      .filter({ hasText: options.widgetName })

    const named = this.root
      .getByTestId(TestIds.subgraphEditor.widgetItem)
      .filter({ has: labelLocator })
    if (!options.nodeName && !options.nodeId) return named
    if (options.nodeName) {
      const nodeNameLocator = this.comfyPage.page
        .getByTestId(TestIds.subgraphEditor.nodeName)
        .filter({ hasText: options.nodeName })
      return named.filter({ has: nodeNameLocator })
    }

    const idLocator = this.comfyPage.page.locator(
      `[data-nodeid="${options.nodeId}"]`
    )
    return named.filter({ has: idLocator })
  }
  async togglePromotionOnItem(item: Locator, toState?: boolean) {
    const toggleButton = item.getByTestId(TestIds.subgraphEditor.iconEye)
    if (toState !== undefined) {
      const expectedIcon = `icon-[lucide--eye${toState ? '-off' : ''}]`
      await expect(toggleButton).toContainClass(expectedIcon)
    }
    await toggleButton.click()
  }

  async togglePromotion(
    subgraphNode: Locator,
    options: {
      nodeName?: string
      nodeId?: string
      widgetName: string
      toState?: boolean
    }
  ) {
    await this.open(subgraphNode)

    const item = this.resolvePromotionItem(options)
    await this.togglePromotionOnItem(item, options.toState)
  }
}
