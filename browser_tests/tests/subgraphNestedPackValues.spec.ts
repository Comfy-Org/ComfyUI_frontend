import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

/**
 * Regression test for PR #10532:
 * Packing all nodes inside a subgraph into a nested subgraph was causing
 * the parent subgraph node's promoted widget values to go blank.
 *
 * Root cause: SubgraphNode had two sets of PromotedWidgetView references —
 * node.widgets (rebuilt from the promotion store) vs input._widget (cached
 * at promotion time). After repointing, input._widget still pointed to
 * removed node IDs, causing missing-node failures and blank values on the
 * next checkState cycle.
 */
test.describe(
  'Nested subgraph pack preserves promoted widget values',
  { tag: ['@subgraph', '@widget'] },
  () => {
    const WORKFLOW = 'subgraphs/nested-pack-promoted-values'
    const HOST_NODE_ID = '57'

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Promoted widget values persist after packing interior nodes into nested subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const nodeLocator = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
      await expect(nodeLocator).toBeVisible()

      // 1. Verify initial promoted widget values via Vue node DOM
      const widthWidget = nodeLocator
        .getByLabel('width', { exact: true })
        .first()
      const heightWidget = nodeLocator
        .getByLabel('height', { exact: true })
        .first()
      const stepsWidget = nodeLocator
        .getByLabel('steps', { exact: true })
        .first()
      const textWidget = nodeLocator.getByRole('textbox', { name: 'prompt' })

      const widthControls =
        comfyPage.vueNodes.getInputNumberControls(widthWidget)
      const heightControls =
        comfyPage.vueNodes.getInputNumberControls(heightWidget)
      const stepsControls =
        comfyPage.vueNodes.getInputNumberControls(stepsWidget)

      await expect(async () => {
        await expect(widthControls.input).toHaveValue('1024')
        await expect(heightControls.input).toHaveValue('1024')
        await expect(stepsControls.input).toHaveValue('8')
        await expect(textWidget).toHaveValue(/Latina female/)
      }).toPass({ timeout: 5000 })

      // 2. Enter the subgraph via Vue node button
      await comfyPage.vueNodes.enterSubgraph(HOST_NODE_ID)
      expect(await comfyPage.subgraph.isInSubgraph()).toBe(true)

      // 3. Disable Vue nodes for canvas operations (select all + convert)
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.nextFrame()

      // 4. Select all interior nodes and convert to nested subgraph
      await comfyPage.canvas.click()
      await comfyPage.canvas.press('Control+a')
      await comfyPage.nextFrame()

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.graph!.convertToSubgraph(canvas.selectedItems)
      })
      await comfyPage.nextFrame()

      // 5. Navigate back to root graph and trigger a checkState cycle
      await comfyPage.subgraph.exitViaBreadcrumb()
      await comfyPage.canvas.click()
      await comfyPage.nextFrame()

      // 6. Re-enable Vue nodes and verify values are preserved
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes()

      const nodeAfter = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
      await expect(nodeAfter).toBeVisible()

      const widthAfter = nodeAfter.getByLabel('width', { exact: true }).first()
      const heightAfter = nodeAfter
        .getByLabel('height', { exact: true })
        .first()
      const stepsAfter = nodeAfter.getByLabel('steps', { exact: true }).first()
      const textAfter = nodeAfter.getByRole('textbox', { name: 'prompt' })

      const widthControlsAfter =
        comfyPage.vueNodes.getInputNumberControls(widthAfter)
      const heightControlsAfter =
        comfyPage.vueNodes.getInputNumberControls(heightAfter)
      const stepsControlsAfter =
        comfyPage.vueNodes.getInputNumberControls(stepsAfter)

      await expect(async () => {
        await expect(widthControlsAfter.input).toHaveValue('1024')
        await expect(heightControlsAfter.input).toHaveValue('1024')
        await expect(stepsControlsAfter.input).toHaveValue('8')
        await expect(textAfter).toHaveValue(/Latina female/)
      }).toPass({ timeout: 5000 })
    })

    test('proxyWidgets entries resolve to valid interior nodes after packing', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      // Verify the host node is visible
      const nodeLocator = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
      await expect(nodeLocator).toBeVisible()

      // Enter the subgraph via Vue node button, then disable for canvas ops
      await comfyPage.vueNodes.enterSubgraph(HOST_NODE_ID)
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.nextFrame()

      await comfyPage.canvas.click()
      await comfyPage.canvas.press('Control+a')
      await comfyPage.nextFrame()

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.graph!.convertToSubgraph(canvas.selectedItems)
      })
      await comfyPage.nextFrame()

      await comfyPage.subgraph.exitViaBreadcrumb()
      await comfyPage.canvas.click()
      await comfyPage.nextFrame()

      // Verify all proxyWidgets entries resolve
      await expect(async () => {
        const result = await comfyPage.page.evaluate((hostId) => {
          const graph = window.app!.graph!
          const hostNode = graph.getNodeById(hostId)
          if (
            !hostNode ||
            typeof hostNode.isSubgraphNode !== 'function' ||
            !hostNode.isSubgraphNode()
          ) {
            return { error: 'Host node not found or not a subgraph node' }
          }

          const proxyWidgets = hostNode.properties?.proxyWidgets ?? []
          const entries = (proxyWidgets as unknown[])
            .filter(
              (e): e is [string, string] =>
                Array.isArray(e) &&
                e.length >= 2 &&
                typeof e[0] === 'string' &&
                typeof e[1] === 'string' &&
                !e[1].startsWith('$$')
            )
            .map(([nodeId, widgetName]) => {
              const interiorNode = hostNode.subgraph.getNodeById(Number(nodeId))
              return {
                nodeId,
                widgetName,
                resolved: interiorNode !== null && interiorNode !== undefined
              }
            })

          return { entries, count: entries.length }
        }, HOST_NODE_ID)

        expect(result).not.toHaveProperty('error')
        const { entries, count } = result as {
          entries: { nodeId: string; widgetName: string; resolved: boolean }[]
          count: number
        }
        expect(count).toBeGreaterThan(0)
        for (const entry of entries) {
          expect(
            entry.resolved,
            `Widget "${entry.widgetName}" (node ${entry.nodeId}) should resolve`
          ).toBe(true)
        }
      }).toPass({ timeout: 5000 })
    })
  }
)
