import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { SubgraphHelper } from '../../fixtures/helpers/SubgraphHelper'
import { getPromotedWidgetNames } from '../../helpers/promotedWidgets'

const DOM_WIDGET_SELECTOR = '.comfy-multiline-input'
const BREADCRUMB_SELECTOR = '.subgraph-breadcrumb'
const TEST_WIDGET_CONTENT = 'Test content that should persist'

test.describe('Subgraph Promotion DOM', { tag: ['@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
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
    test('DOM widget visibility persists through subgraph navigation', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await comfyPage.nextFrame()

      const parentTextarea = comfyPage.page.locator(DOM_WIDGET_SELECTOR)
      await expect(parentTextarea).toBeVisible()
      await expect(parentTextarea).toHaveCount(1)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      expect(await subgraphNode.exists()).toBe(true)

      await subgraphNode.navigateIntoSubgraph()

      const subgraphTextarea = comfyPage.page.locator(DOM_WIDGET_SELECTOR)
      await expect(subgraphTextarea).toBeVisible()
      await expect(subgraphTextarea).toHaveCount(1)

      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      const backToParentTextarea = comfyPage.page.locator(DOM_WIDGET_SELECTOR)
      await expect(backToParentTextarea).toBeVisible()
      await expect(backToParentTextarea).toHaveCount(1)
    })

    test('DOM widget content is preserved through navigation', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const textarea = comfyPage.page.locator(DOM_WIDGET_SELECTOR)
      await textarea.fill(TEST_WIDGET_CONTENT)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      const subgraphTextarea = comfyPage.page.locator(DOM_WIDGET_SELECTOR)
      await expect(subgraphTextarea).toHaveValue(TEST_WIDGET_CONTENT)

      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      const parentTextarea = comfyPage.page.locator(DOM_WIDGET_SELECTOR)
      await expect(parentTextarea).toHaveValue(TEST_WIDGET_CONTENT)
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

      const finalCount = await comfyPage.page
        .locator(DOM_WIDGET_SELECTOR)
        .count()
      expect(finalCount).toBe(0)
    })

    test('DOM elements are cleaned up when widget is disconnected from I/O', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')

      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const textareaCount = await comfyPage.page
        .locator(DOM_WIDGET_SELECTOR)
        .count()
      expect(textareaCount).toBe(1)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      await comfyPage.subgraph.removeSlot('input', 'text')

      await comfyPage.page.waitForSelector(BREADCRUMB_SELECTOR, {
        state: 'visible',
        timeout: 5_000
      })

      const homeBreadcrumb = comfyPage.page.locator(
        '.p-breadcrumb-list > :first-child'
      )
      await homeBreadcrumb.waitFor({ state: 'visible' })
      await homeBreadcrumb.click()
      await comfyPage.nextFrame()

      const widgetCount = await comfyPage.page.evaluate(() => {
        return window.app!.canvas.graph!.nodes[0].widgets?.length || 0
      })

      expect(widgetCount).toBe(0)
    })

    test('Multiple promoted widgets are handled correctly', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-multiple-promoted-widgets'
      )

      const parentCount = await comfyPage.page
        .locator(DOM_WIDGET_SELECTOR)
        .count()
      expect(parentCount).toBeGreaterThan(1)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      const subgraphCount = await comfyPage.page
        .locator(DOM_WIDGET_SELECTOR)
        .count()
      expect(subgraphCount).toBe(parentCount)

      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      const finalCount = await comfyPage.page
        .locator(DOM_WIDGET_SELECTOR)
        .count()
      expect(finalCount).toBe(parentCount)
    })
  })
})
