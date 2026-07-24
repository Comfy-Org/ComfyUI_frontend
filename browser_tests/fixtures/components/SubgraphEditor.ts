import type { Locator } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { dragByIndex } from '@e2e/fixtures/utils/dragAndDrop'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

export class SubgraphEditor {
  public readonly root: Locator
  public readonly promotionItems: Locator

  constructor(protected readonly comfyPage: ComfyPage) {
    this.root = this.comfyPage.menu.propertiesPanel.root
    this.promotionItems = this.root.getByTestId(
      TestIds.subgraphEditor.widgetItem
    )
  }

  async ensureOpen(subgraphNode: Locator) {
    await new VueNodeFixture(subgraphNode).select()
    if (await this.root.isVisible()) return
    const menu = await this.comfyPage.contextMenu.openFor(subgraphNode)
    await menu.clickMenuItemExact('Edit Subgraph Widgets')
    await expect(this.root, 'Open Properties Panel').toBeVisible()
  }

  resolveItem(options: {
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
    await this.ensureOpen(subgraphNode)

    const item = this.resolveItem(options)
    await this.togglePromotionOnItem(item, options.toState)
  }
  async dragItem(fromIndex: number, toIndex: number) {
    await dragByIndex(this.promotionItems, fromIndex, toIndex)
    await this.comfyPage.nextFrame()
  }
}
