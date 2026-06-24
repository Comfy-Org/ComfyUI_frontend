import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'
import { getPromotedWidgetNames } from '@e2e/fixtures/utils/promotedWidgets'

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
    .poll(() =>
      comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph
        return !!graph && 'inputNode' in graph
      })
    )
    .toBe(true)
}

test.describe(
  'Subgraph Promotion DOM',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test('Promoted seed widget renders in node body, not header', async ({
      comfyPage
    }) => {
      const subgraphNode =
        await comfyPage.subgraph.convertDefaultKSamplerToSubgraph()

      const subgraphNodeId = String(subgraphNode.id)
      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, subgraphNodeId))
        .toContain('seed')

      const nodeLocator = comfyPage.vueNodes.getNodeLocator(subgraphNodeId)
      await expect(nodeLocator).toBeVisible()

      const seedWidget = nodeLocator.getByLabel('seed', { exact: true }).first()
      await expect(seedWidget).toBeVisible()

      await SubgraphHelper.expectWidgetBelowHeader(nodeLocator, seedWidget)
    })

    test('Promoted textarea materializes once when a node is converted to a subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')

      const clipNode = await comfyPage.nodeOps.getNodeRefById('6')
      await clipNode.click('title')
      const subgraphNode = await clipNode.convertToSubgraph()

      const promotedTextarea = comfyPage.vueNodes
        .getNodeLocator(String(subgraphNode.id))
        .getByRole('textbox', { name: 'text', exact: true })
      await expect(promotedTextarea).toHaveCount(1)
      await expect(promotedTextarea).toBeVisible()
    })

    test.describe(
      'Promoted Text Widget Lifecycle',
      { tag: ['@vue-nodes'] },
      () => {
        test('Promoted text widget preserves content through subgraph enter/exit', async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow(
            'subgraphs/subgraph-with-promoted-text-widget'
          )

          const subgraphNode = comfyPage.vueNodes.getNodeLocator('11')
          const promotedTextarea = subgraphNode.getByRole('textbox', {
            name: 'text'
          })
          await expect(promotedTextarea).toBeVisible()
          await promotedTextarea.fill(TEST_WIDGET_CONTENT)

          await openSubgraphById(comfyPage, '11')

          await comfyPage.keyboard.press('Escape')

          const backToPromoted = comfyPage.vueNodes
            .getNodeLocator('11')
            .getByRole('textbox', { name: 'text' })
          await expect(backToPromoted).toBeVisible()
          await expect(backToPromoted).toHaveValue(TEST_WIDGET_CONTENT)
        })

        test('Promoted text widget is removed when subgraph node is deleted', async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow(
            'subgraphs/subgraph-with-promoted-text-widget'
          )

          const subgraphNode = comfyPage.vueNodes.getNodeLocator('11')
          await expect(
            subgraphNode.getByRole('textbox', { name: 'text' })
          ).toBeVisible()

          const subgraphNodeRef = await comfyPage.nodeOps.getNodeRefById('11')
          await subgraphNodeRef.delete()

          await expect(subgraphNode).toHaveCount(0)
        })

        test('Promoted text widget disappears when widget is disconnected from I/O', async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow(
            'subgraphs/subgraph-with-promoted-text-widget'
          )

          const subgraphNode = comfyPage.vueNodes.getNodeLocator('11')
          await expect(
            subgraphNode.getByRole('textbox', { name: 'text' })
          ).toBeVisible()

          await openSubgraphById(comfyPage, '11')
          await comfyPage.subgraph.removeSlot('input', 'text')
          await comfyPage.subgraph.exitViaBreadcrumb()

          await expect(
            comfyPage.vueNodes
              .getNodeLocator('11')
              .getByRole('textbox', { name: 'text' })
          ).toHaveCount(0)
        })

        test('Multiple promoted widgets are handled correctly', async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow(
            'subgraphs/subgraph-with-multiple-promoted-widgets'
          )

          const subgraphNode = comfyPage.vueNodes.getNodeLocator('11')
          const promotedTextareas = subgraphNode.getByRole('textbox')
          await expect(promotedTextareas).toHaveCount(2)

          await openSubgraphById(comfyPage, '11')

          const interiorTextareas = comfyPage.page
            .locator('[data-node-id]')
            .getByRole('textbox')
          await expect(interiorTextareas).toHaveCount(2)

          await comfyPage.subgraph.exitViaBreadcrumb()

          await expect(
            comfyPage.vueNodes.getNodeLocator('11').getByRole('textbox')
          ).toHaveCount(2)
        })
      }
    )
  }
)
