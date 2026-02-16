import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

const SELECTORS = {
  domWidget: '.comfy-multiline-input',
  breadcrumb: '.subgraph-breadcrumb'
} as const

/**
 * Query a SubgraphNode's promoted widget names via its `properties.proxyWidgets`
 * and its synthesized `widgets` array (which reads from the promotion store).
 */
async function getPromotedWidgetNames(
  comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage'],
  subgraphNodeId: string
): Promise<string[]> {
  return comfyPage.page.evaluate((nodeId) => {
    const node = window.app!.canvas.graph!.getNodeById(nodeId)
    if (!node) return []
    // proxyWidgets is [ [interiorNodeId, widgetName], ... ]
    const proxy = (node.properties as Record<string, unknown>).proxyWidgets as
      | [string, string][]
      | undefined
    if (!proxy) return []
    return proxy.map(([, widgetName]) => widgetName)
  }, subgraphNodeId)
}

/**
 * Query widget count on a node via the litegraph graph.
 */
async function getWidgetCount(
  comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage'],
  nodeId: string
): Promise<number> {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    return node?.widgets?.length ?? 0
  }, nodeId)
}

/**
 * Check whether we're currently in a subgraph.
 */
async function isInSubgraph(
  comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage']
): Promise<boolean> {
  return comfyPage.page.evaluate(() => {
    return window.app!.canvas.graph?.constructor?.name === 'Subgraph'
  })
}

test.describe(
  'Subgraph Widget Promotion',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test.describe('Auto-promotion on Convert to Subgraph', () => {
      test('Recommended widgets are auto-promoted when creating a subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        // Select just the KSampler node (id 3) which has a "seed" widget
        const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
        const subgraphNode = await ksampler.convertToSubgraph()
        await comfyPage.nextFrame()

        // SubgraphNode should exist
        expect(await subgraphNode.exists()).toBe(true)

        // The KSampler has a "seed" widget which is in the recommended list.
        // The promotion store should have at least the seed widget promoted.
        const nodeId = String(subgraphNode.id)
        const promotedNames = await getPromotedWidgetNames(comfyPage, nodeId)
        expect(promotedNames).toContain('seed')

        // SubgraphNode should have widgets (promoted views)
        const widgetCount = await getWidgetCount(comfyPage, nodeId)
        expect(widgetCount).toBeGreaterThan(0)
      })

      test('CLIPTextEncode text widget is auto-promoted', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        // Select the positive CLIPTextEncode node (id 6)
        const clipNode = await comfyPage.nodeOps.getNodeRefById('6')
        const subgraphNode = await clipNode.convertToSubgraph()
        await comfyPage.nextFrame()

        const nodeId = String(subgraphNode.id)
        const promotedNames = await getPromotedWidgetNames(comfyPage, nodeId)
        expect(promotedNames.length).toBeGreaterThan(0)

        // CLIPTextEncode is in the recommendedNodes list, so its text widget
        // should be promoted
        expect(promotedNames).toContain('text')
      })

      test('SaveImage/PreviewImage nodes get pseudo-widget promoted', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        // Select the SaveImage node (id 9 in default workflow)
        const saveNode = await comfyPage.nodeOps.getNodeRefById('9')
        const subgraphNode = await saveNode.convertToSubgraph()
        await comfyPage.nextFrame()

        const promotedNames = await getPromotedWidgetNames(
          comfyPage,
          String(subgraphNode.id)
        )

        // SaveImage is in the recommendedNodes list, so filename_prefix is promoted
        expect(promotedNames).toContain('filename_prefix')
      })
    })

    test.describe('Promoted Widget Visibility in LiteGraph Mode', () => {
      test('Promoted text widget is visible on SubgraphNode', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        // The subgraph node (id 11) should have a text widget promoted
        const textarea = comfyPage.page.locator(SELECTORS.domWidget)
        await expect(textarea).toBeVisible()
        await expect(textarea).toHaveCount(1)
      })

      test('Multiple promoted widgets all render on SubgraphNode', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-multiple-promoted-widgets'
        )
        await comfyPage.nextFrame()

        const textareas = comfyPage.page.locator(SELECTORS.domWidget)
        await expect(textareas.first()).toBeVisible()
        const count = await textareas.count()
        expect(count).toBeGreaterThan(1)
      })
    })

    test.describe('Promoted Widget Visibility in Vue Mode', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('Promoted text widget renders on SubgraphNode in Vue mode', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.vueNodes.waitForNodes()

        // SubgraphNode (id 11) should render with its body
        const subgraphVueNode = comfyPage.vueNodes.getNodeLocator('11')
        await expect(subgraphVueNode).toBeVisible()

        // It should have the Enter Subgraph button
        const enterButton = subgraphVueNode.getByTestId('subgraph-enter-button')
        await expect(enterButton).toBeVisible()

        // The promoted text widget should render inside the node
        const nodeBody = subgraphVueNode.locator('[data-testid="node-body-11"]')
        await expect(nodeBody).toBeVisible()

        // Widgets section should exist and have at least one widget
        const widgets = nodeBody.locator('.lg-node-widgets > div')
        await expect(widgets.first()).toBeVisible()
      })

      test('Enter Subgraph button navigates into subgraph in Vue mode', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.vueNodes.waitForNodes()

        await comfyPage.vueNodes.enterSubgraph('11')
        await comfyPage.nextFrame()

        expect(await isInSubgraph(comfyPage)).toBe(true)
      })

      test('Multiple promoted widgets render on SubgraphNode in Vue mode', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-multiple-promoted-widgets'
        )
        await comfyPage.vueNodes.waitForNodes()

        const subgraphVueNode = comfyPage.vueNodes.getNodeLocator('11')
        await expect(subgraphVueNode).toBeVisible()

        const nodeBody = subgraphVueNode.locator('[data-testid="node-body-11"]')
        const widgets = nodeBody.locator('.lg-node-widgets > div')
        const count = await widgets.count()
        expect(count).toBeGreaterThan(1)
      })
    })

    test.describe('Promoted Widget Reactivity', () => {
      test('Value changes on promoted widget sync to interior widget', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        const testContent = 'promoted-value-sync-test'

        // Type into the promoted textarea on the SubgraphNode
        const textarea = comfyPage.page.locator(SELECTORS.domWidget)
        await textarea.fill(testContent)
        await comfyPage.nextFrame()

        // Navigate into subgraph
        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        // Interior CLIPTextEncode textarea should have the same value
        const interiorTextarea = comfyPage.page.locator(SELECTORS.domWidget)
        await expect(interiorTextarea).toHaveValue(testContent)
      })

      test('Value changes on interior widget sync to promoted widget', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        const testContent = 'interior-value-sync-test'

        // Navigate into subgraph
        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        // Type into the interior CLIPTextEncode textarea
        const interiorTextarea = comfyPage.page.locator(SELECTORS.domWidget)
        await interiorTextarea.fill(testContent)
        await comfyPage.nextFrame()

        // Navigate back to parent graph
        await comfyPage.page.keyboard.press('Escape')
        await comfyPage.nextFrame()

        // Promoted textarea on SubgraphNode should have the same value
        const promotedTextarea = comfyPage.page.locator(SELECTORS.domWidget)
        await expect(promotedTextarea).toHaveValue(testContent)
      })

      test('Value persists through repeated navigation', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        const testContent = 'persistence-through-navigation'

        // Set value on promoted widget
        const textarea = comfyPage.page.locator(SELECTORS.domWidget)
        await textarea.fill(testContent)

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')

        // Navigate in and out multiple times
        for (let i = 0; i < 3; i++) {
          await subgraphNode.navigateIntoSubgraph()
          const interiorTextarea = comfyPage.page.locator(SELECTORS.domWidget)
          await expect(interiorTextarea).toHaveValue(testContent)

          await comfyPage.page.keyboard.press('Escape')
          await comfyPage.nextFrame()

          const promotedTextarea = comfyPage.page.locator(SELECTORS.domWidget)
          await expect(promotedTextarea).toHaveValue(testContent)
        }
      })
    })

    test.describe('Manual Promote/Demote via Context Menu', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      })

      test('Can promote a widget from inside a subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
        await subgraphNode.navigateIntoSubgraph()

        // Get the KSampler node (id 1) inside the subgraph
        const ksampler = await comfyPage.nodeOps.getNodeRefById('1')

        // Right-click on the KSampler's "steps" widget (index 2) to promote it
        const stepsWidget = await ksampler.getWidget(2)
        await stepsWidget.click()
        await comfyPage.nextFrame()

        // Right-click the widget to open context menu
        const widgetPos = await stepsWidget.getPosition()
        await comfyPage.canvas.click({
          position: widgetPos,
          button: 'right',
          force: true
        })
        await comfyPage.nextFrame()

        // Look for the Promote Widget menu entry
        const promoteEntry = comfyPage.page
          .locator('.litemenu-entry')
          .filter({ hasText: /Promote Widget/ })

        if (await promoteEntry.isVisible()) {
          await promoteEntry.click()
          await comfyPage.nextFrame()

          // Navigate back to parent
          await comfyPage.page.keyboard.press('Escape')
          await comfyPage.nextFrame()

          // SubgraphNode should now have the promoted widget
          const widgetCount = await getWidgetCount(comfyPage, '2')
          expect(widgetCount).toBeGreaterThan(0)
        }
      })

      test('Can un-promote a widget from inside a subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )

        // Verify we start with a promoted widget
        const initialWidgetCount = await getWidgetCount(comfyPage, '11')
        expect(initialWidgetCount).toBeGreaterThan(0)

        // Navigate into subgraph
        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        // Right-click on the CLIPTextEncode (id 10) text widget area
        // The text widget should show "Un-Promote Widget" since it's promoted
        const clipNode = await comfyPage.nodeOps.getNodeRefById('10')
        const textWidget = await clipNode.getWidget(0)
        const widgetPos = await textWidget.getPosition()

        await comfyPage.canvas.click({
          position: widgetPos,
          button: 'right',
          force: true
        })
        await comfyPage.nextFrame()

        const unpromoteEntry = comfyPage.page
          .locator('.litemenu-entry')
          .filter({ hasText: /Un-Promote Widget/ })

        if (await unpromoteEntry.isVisible()) {
          await unpromoteEntry.click()
          await comfyPage.nextFrame()

          // Navigate back
          await comfyPage.page.keyboard.press('Escape')
          await comfyPage.nextFrame()

          // SubgraphNode should have fewer widgets
          const finalWidgetCount = await getWidgetCount(comfyPage, '11')
          expect(finalWidgetCount).toBeLessThan(initialWidgetCount)
        }
      })
    })

    test.describe('Pseudo-Widget Promotion', () => {
      test('Promotion store tracks pseudo-widget entries for subgraph with preview node', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-preview-node'
        )
        await comfyPage.nextFrame()

        // The SaveImage node is in the recommendedNodes list, so its
        // filename_prefix widget should be auto-promoted
        const promotedNames = await getPromotedWidgetNames(comfyPage, '5')
        expect(promotedNames.length).toBeGreaterThan(0)
        expect(promotedNames).toContain('filename_prefix')
      })

      test('Converting SaveImage to subgraph promotes its widgets', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        // Select SaveImage (id 9)
        const saveNode = await comfyPage.nodeOps.getNodeRefById('9')
        const subgraphNode = await saveNode.convertToSubgraph()
        await comfyPage.nextFrame()

        // SaveImage is a recommended node, so filename_prefix should be promoted
        const nodeId = String(subgraphNode.id)
        const promotedNames = await getPromotedWidgetNames(comfyPage, nodeId)
        expect(promotedNames.length).toBeGreaterThan(0)

        const widgetCount = await getWidgetCount(comfyPage, nodeId)
        expect(widgetCount).toBeGreaterThan(0)
      })
    })

    test.describe('Vue Mode - Promoted Preview Content', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('SubgraphNode with preview node shows hasCustomContent area in Vue mode', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-preview-node'
        )
        await comfyPage.vueNodes.waitForNodes()

        const subgraphVueNode = comfyPage.vueNodes.getNodeLocator('5')
        await expect(subgraphVueNode).toBeVisible()

        // The node body should exist
        const nodeBody = subgraphVueNode.locator('[data-testid="node-body-5"]')
        await expect(nodeBody).toBeVisible()
      })
    })

    test.describe('Promotion Cleanup', () => {
      test('Removing subgraph node clears promotion store entries', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        // Verify promotions exist
        const namesBefore = await getPromotedWidgetNames(comfyPage, '11')
        expect(namesBefore.length).toBeGreaterThan(0)

        // Delete the subgraph node
        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.click('title')
        await comfyPage.page.keyboard.press('Delete')
        await comfyPage.nextFrame()

        // Node no longer exists, so promoted widgets should be gone
        const nodeExists = await comfyPage.page.evaluate(() => {
          return !!window.app!.canvas.graph!.getNodeById('11')
        })
        expect(nodeExists).toBe(false)
      })

      test('Removing I/O slot removes associated promoted widget', async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')

        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )

        const initialWidgetCount = await getWidgetCount(comfyPage, '11')
        expect(initialWidgetCount).toBeGreaterThan(0)

        // Navigate into subgraph
        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        // Remove the text input slot
        await comfyPage.subgraph.rightClickInputSlot('text')
        await comfyPage.contextMenu.clickLitegraphMenuItem('Remove Slot')
        await comfyPage.nextFrame()

        // Navigate back via breadcrumb
        await comfyPage.page.waitForSelector(SELECTORS.breadcrumb, {
          state: 'visible',
          timeout: 5000
        })
        const homeBreadcrumb = comfyPage.page.getByRole('link', {
          name: 'subgraph-with-promoted-text-widget'
        })
        await homeBreadcrumb.waitFor({ state: 'visible' })
        await homeBreadcrumb.click()
        await comfyPage.nextFrame()

        // Widget count should be reduced
        const finalWidgetCount = await comfyPage.page.evaluate(() => {
          return window.app!.canvas.graph!.nodes[0].widgets?.length || 0
        })
        expect(finalWidgetCount).toBeLessThan(initialWidgetCount)
      })
    })
  }
)
