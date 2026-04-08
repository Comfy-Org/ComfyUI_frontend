import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'
import { getPromotedWidgetNames } from '@e2e/helpers/promotedWidgets'

// Constants
const TEST_WIDGET_CONTENT = 'Test content that should persist'

// Common selectors
const SELECTORS = {
  breadcrumb: '.subgraph-breadcrumb',
  domWidget: '.comfy-multiline-input'
} as const

test.describe(
  'Subgraph Promoted Widget DOM',
  { tag: ['@slow', '@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.settings.setSetting(
        'Comfy.NodeSearchBoxImpl',
        'v1 (legacy)'
      )
    })

    test.describe('DOM Widget Navigation and Persistence', () => {
      test('DOM widget visibility persists through subgraph navigation', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        // Verify promoted widget is visible in parent graph
        const parentTextarea = comfyPage.page.locator(SELECTORS.domWidget)
        await expect(parentTextarea).toBeVisible()
        await expect(parentTextarea).toHaveCount(1)

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        expect(await subgraphNode.exists()).toBe(true)

        await subgraphNode.navigateIntoSubgraph()

        // Verify widget is visible in subgraph
        const subgraphTextarea = comfyPage.page.locator(SELECTORS.domWidget)
        await expect(subgraphTextarea).toBeVisible()
        await expect(subgraphTextarea).toHaveCount(1)

        // Navigate back
        await comfyPage.page.keyboard.press('Escape')
        await comfyPage.nextFrame()

        // Verify widget is still visible
        const backToParentTextarea = comfyPage.page.locator(SELECTORS.domWidget)
        await expect(backToParentTextarea).toBeVisible()
        await expect(backToParentTextarea).toHaveCount(1)
      })

      test('DOM widget content is preserved through navigation', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )

        const textarea = comfyPage.page.locator(SELECTORS.domWidget)
        await textarea.fill(TEST_WIDGET_CONTENT)

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        const subgraphTextarea = comfyPage.page.locator(SELECTORS.domWidget)
        await expect(subgraphTextarea).toHaveValue(TEST_WIDGET_CONTENT)

        await comfyPage.page.keyboard.press('Escape')
        await comfyPage.nextFrame()

        const parentTextarea = comfyPage.page.locator(SELECTORS.domWidget)
        await expect(parentTextarea).toHaveValue(TEST_WIDGET_CONTENT)
      })

      test('Multiple promoted widgets are handled correctly', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-multiple-promoted-widgets'
        )

        const parentCount = await comfyPage.page
          .locator(SELECTORS.domWidget)
          .count()
        expect(parentCount).toBeGreaterThan(1)

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        const subgraphCount = await comfyPage.page
          .locator(SELECTORS.domWidget)
          .count()
        expect(subgraphCount).toBe(parentCount)

        await comfyPage.page.keyboard.press('Escape')
        await comfyPage.nextFrame()

        const finalCount = await comfyPage.page
          .locator(SELECTORS.domWidget)
          .count()
        expect(finalCount).toBe(parentCount)
      })
    })

    test.describe('DOM Cleanup', () => {
      test('DOM elements are cleaned up when subgraph node is removed', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )

        const initialCount = await comfyPage.page
          .locator(SELECTORS.domWidget)
          .count()
        expect(initialCount).toBe(1)

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')

        await subgraphNode.delete()

        const finalCount = await comfyPage.page
          .locator(SELECTORS.domWidget)
          .count()
        expect(finalCount).toBe(0)
      })

      test('DOM elements are cleaned up when widget is disconnected from I/O', async ({
        comfyPage
      }) => {
        // Enable new menu for breadcrumb navigation
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')

        const workflowName = 'subgraphs/subgraph-with-promoted-text-widget'
        await comfyPage.workflow.loadWorkflow(workflowName)

        const textareaCount = await comfyPage.page
          .locator(SELECTORS.domWidget)
          .count()
        expect(textareaCount).toBe(1)

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')

        // Navigate into subgraph (method now handles retries internally)
        await subgraphNode.navigateIntoSubgraph()

        await comfyPage.subgraph.removeSlot('input', 'text')

        // Wait for breadcrumb to be visible
        await comfyPage.page.waitForSelector(SELECTORS.breadcrumb, {
          state: 'visible',
          timeout: 5000
        })

        // Click breadcrumb to navigate back to parent graph
        const homeBreadcrumb = comfyPage.page.locator(
          '.p-breadcrumb-list > :first-child'
        )
        await homeBreadcrumb.waitFor({ state: 'visible' })
        await homeBreadcrumb.click()
        await comfyPage.nextFrame()

        // Check that the subgraph node has no widgets after removing the text slot
        const widgetCount = await comfyPage.page.evaluate(() => {
          return window.app!.canvas.graph!.nodes[0].widgets?.length || 0
        })

        expect(widgetCount).toBe(0)
      })
    })

    test.describe('DOM Positioning', () => {
      test('Promoted seed widget renders in node body, not header', async ({
        comfyPage
      }) => {
        const subgraphNode =
          await comfyPage.subgraph.convertDefaultKSamplerToSubgraph()

        // Enable Vue nodes now that the subgraph has been created
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

        const subgraphNodeId = String(subgraphNode.id)
        await expect(async () => {
          const promotedNames = await getPromotedWidgetNames(
            comfyPage,
            subgraphNodeId
          )
          expect(promotedNames).toContain('seed')
        }).toPass({ timeout: 5000 })

        // Wait for Vue nodes to render
        await comfyPage.vueNodes.waitForNodes()

        const nodeLocator = comfyPage.vueNodes.getNodeLocator(subgraphNodeId)
        await expect(nodeLocator).toBeVisible()

        // The seed widget should be visible inside the node body
        const seedWidget = nodeLocator
          .getByLabel('seed', { exact: true })
          .first()
        await expect(seedWidget).toBeVisible()

        // Verify widget is inside the node body, not the header
        await SubgraphHelper.expectWidgetBelowHeader(nodeLocator, seedWidget)
      })
    })
  }
)
