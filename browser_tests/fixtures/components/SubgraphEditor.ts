import type { Locator } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { dragByIndex } from '@e2e/fixtures/utils/dragAndDrop'

export class SubgraphEditor {
  public readonly root: Locator
  public readonly promotionItems: Locator

  constructor(protected readonly comfyPage: ComfyPage) {
    this.root = this.comfyPage.menu.propertiesPanel.root
    this.promotionItems = this.root.getByTestId(
      TestIds.subgraphEditor.widgetItem
    )
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
    const nodeItems =
      options.nodeId !== undefined
        ? this.comfyPage.page.locator(`[data-nodeid="${options.nodeId}"]`)
        : options.nodeName !== undefined
          ? this.promotionItems.filter({
              has: this.comfyPage.page
                .getByTestId(TestIds.subgraphEditor.nodeName)
                .filter({ hasText: options.nodeName })
            })
          : this.promotionItems

    return nodeItems.filter({
      has: this.comfyPage.page
        .getByTestId(TestIds.subgraphEditor.widgetLabel)
        .filter({ hasText: options.widgetName })
    })
  }

  getToggleButton(item: Locator) {
    return item.getByTestId(TestIds.subgraphEditor.widgetToggle)
  }

  async togglePromotionOnItem(item: Locator, toState?: boolean) {
    const toggleIcon = item.getByTestId(TestIds.subgraphEditor.iconEye)
    if (toState !== undefined) {
      const expectedIcon = `icon-[lucide--eye${toState ? '-off' : ''}]`
      await expect(toggleIcon).toContainClass(expectedIcon)
    }
    await toggleIcon.click()
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
  async dragItem(fromIndex: number, toIndex: number) {
    await dragByIndex(this.promotionItems, fromIndex, toIndex)
    await this.comfyPage.nextFrame()
  }
}
