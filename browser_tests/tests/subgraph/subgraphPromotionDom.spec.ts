import { expect } from '@playwright/test'

import type { ComfyPage } from '../../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { SubgraphHelper } from '../../fixtures/helpers/SubgraphHelper'
import { getPromotedWidgetNames } from '../../helpers/promotedWidgets'

const DOM_WIDGET_SELECTOR = '.comfy-multiline-input'
const VISIBLE_DOM_WIDGET_SELECTOR = `${DOM_WIDGET_SELECTOR}:visible`
const TEST_WIDGET_CONTENT = 'Test content that should persist'

async function openSubgraphById(comfyPage: ComfyPage, nodeId: string) {
  await comfyPage.page.evaluate((targetNodeId) => {
    const node = window.app!.rootGraph.nodes.find(
      (candidate) => String(candidate.id) === targetNodeId
    )
    if (!node || !('subgraph' in node) || !node.subgraph) {
      throw new Error(`Subgraph node ${targetNodeId} not found`)
    }

    window.app!.canvas.openSubgraph(node.subgraph, node)
  }, nodeId)

  await expect
    .poll(
      () =>
        comfyPage.page.evaluate(() => {
          const graph = window.app!.canvas.graph
          return !!graph && 'inputNode' in graph
        }),
      { timeout: 5_000 }
    )
    .toBe(true)
}

test.describe('Subgraph Promotion DOM', { tag: ['@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
  })

  test('Promoted seed widget renders in node body, not header', async ({
    comfyPage
  }) => {
    const subgraphNode =
      await comfyPage.subgraph.convertDefaultKSamplerToSubgraph()

    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

    const subgraphNodeId = String(subgraphNode.id)
    const promotedNames = await getPromotedWidgetNames(
      comfyPage,
      subgraphNodeId
    )
    expect(promotedNames).toContain('seed')

    await comfyPage.vueNodes.waitForNodes()

    const nodeLocator = comfyPage.vueNodes.getNodeLocator(subgraphNodeId)
    await expect(nodeLocator).toBeVisible()

    const seedWidget = nodeLocator.getByLabel('seed', { exact: true }).first()
    await expect(seedWidget).toBeVisible()

    await SubgraphHelper.expectWidgetBelowHeader(nodeLocator, seedWidget)
  })

  test.describe('DOM Widget Promotion', () => {
    test('DOM widget stays visible and preserves content through subgraph navigation', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await comfyPage.nextFrame()

      const parentTextarea = comfyPage.page.locator(DOM_WIDGET_SELECTOR)
      await expect(parentTextarea).toBeVisible()
      await expect(parentTextarea).toHaveCount(1)
      await parentTextarea.fill(TEST_WIDGET_CONTENT)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      expect(await subgraphNode.exists()).toBe(true)

      await openSubgraphById(comfyPage, '11')

      const subgraphTextarea = comfyPage.page.locator(DOM_WIDGET_SELECTOR)
      await expect(subgraphTextarea).toBeVisible()
      await expect(subgraphTextarea).toHaveCount(1)

      await expect(subgraphTextarea).toHaveValue(TEST_WIDGET_CONTENT)

      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      const backToParentTextarea = comfyPage.page.locator(DOM_WIDGET_SELECTOR)
      await expect(backToParentTextarea).toBeVisible()
      await expect(backToParentTextarea).toHaveCount(1)
      await expect(backToParentTextarea).toHaveValue(TEST_WIDGET_CONTENT)
    })

    test('DOM elements are cleaned up when subgraph node is removed', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const initialCount = await comfyPage.page
        .locator(DOM_WIDGET_SELECTOR)
        .count()
      expect(initialCount).toBe(1)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      await subgraphNode.delete()

      await expect(comfyPage.page.locator(DOM_WIDGET_SELECTOR)).toHaveCount(0)
    })

    test('DOM elements are cleaned up when widget is disconnected from I/O', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')

      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      await expect(comfyPage.page.locator(DOM_WIDGET_SELECTOR)).toHaveCount(1)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      expect(await subgraphNode.exists()).toBe(true)

      await openSubgraphById(comfyPage, '11')

      await comfyPage.subgraph.removeSlot('input', 'text')

      await comfyPage.subgraph.exitViaBreadcrumb()

      await expect(
        comfyPage.page.locator(VISIBLE_DOM_WIDGET_SELECTOR)
      ).toHaveCount(0)
    })

    test('Multiple promoted widgets are handled correctly', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-multiple-promoted-widgets'
      )

      const parentCount = await comfyPage.page
        .locator(VISIBLE_DOM_WIDGET_SELECTOR)
        .count()
      expect(parentCount).toBeGreaterThan(1)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      expect(await subgraphNode.exists()).toBe(true)

      await openSubgraphById(comfyPage, '11')

      const subgraphCount = await comfyPage.page
        .locator(VISIBLE_DOM_WIDGET_SELECTOR)
        .count()
      expect(subgraphCount).toBe(parentCount)

      await comfyPage.subgraph.exitViaBreadcrumb()

      const finalCount = await comfyPage.page
        .locator(VISIBLE_DOM_WIDGET_SELECTOR)
        .count()
      expect(finalCount).toBe(parentCount)
    })
  })
})
