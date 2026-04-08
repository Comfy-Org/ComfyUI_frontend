import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

// Constants
const NEW_SUBGRAPH_TITLE = 'New Subgraph'

test.describe('Subgraph CRUD', { tag: ['@slow', '@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting(
      'Comfy.NodeSearchBoxImpl',
      'v1 (legacy)'
    )
  })

  test.describe('Subgraph Unpacking', () => {
    test('Unpacking subgraph with duplicate links does not create extra links', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-duplicate-links'
      )

      const result = await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph!
        const subgraphNode = graph.nodes.find((n) => n.isSubgraphNode())
        if (!subgraphNode || !subgraphNode.isSubgraphNode()) {
          return { error: 'No subgraph node found' }
        }

        graph.unpackSubgraph(subgraphNode)

        const linkCount = graph.links.size
        const nodes = graph.nodes
        const ksampler = nodes.find((n) => n.type === 'KSampler')
        if (!ksampler) return { error: 'No KSampler found after unpack' }

        const linkedInputCount = ksampler.inputs.filter(
          (i) => i.link != null
        ).length

        return { linkCount, linkedInputCount, nodeCount: nodes.length }
      })

      expect(result).not.toHaveProperty('error')
      // Should have exactly 1 link (EmptyLatentImage→KSampler)
      // not 4 (with 3 duplicates). The KSampler→output link is dropped
      // because the subgraph output has no downstream connection.
      expect(result.linkCount).toBe(1)
      // KSampler should have exactly 1 linked input (latent_image)
      expect(result.linkedInputCount).toBe(1)
    })
  })

  test.describe('Subgraph Creation and Deletion', () => {
    test('Can create subgraph from selected nodes', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')

      await comfyPage.keyboard.selectAll()
      await comfyPage.nextFrame()

      const node = await comfyPage.nodeOps.getNodeRefById('5')
      await node.convertToSubgraph()
      await comfyPage.nextFrame()

      const subgraphNodes =
        await comfyPage.nodeOps.getNodeRefsByTitle(NEW_SUBGRAPH_TITLE)
      expect(subgraphNodes.length).toBe(1)

      const finalNodeCount = await comfyPage.subgraph.getNodeCount()
      expect(finalNodeCount).toBe(1)
    })

    test('Can delete subgraph node', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      expect(await subgraphNode.exists()).toBe(true)

      const initialNodeCount = await comfyPage.subgraph.getNodeCount()

      await subgraphNode.delete()

      const finalNodeCount = await comfyPage.subgraph.getNodeCount()
      expect(finalNodeCount).toBe(initialNodeCount - 1)

      const deletedNode = await comfyPage.nodeOps.getNodeRefById('2')
      expect(await deletedNode.exists()).toBe(false)
    })

    test.describe('Subgraph copy and paste', () => {
      test('Can copy subgraph node by dragging + alt', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')

        // Get position of subgraph node
        const subgraphPos = await subgraphNode.getPosition()

        // Alt + Click on the subgraph node
        await comfyPage.page.mouse.move(subgraphPos.x + 16, subgraphPos.y + 16)
        await comfyPage.page.keyboard.down('Alt')
        await comfyPage.page.mouse.down()
        await comfyPage.nextFrame()

        // Drag slightly to trigger the copy
        await comfyPage.page.mouse.move(subgraphPos.x + 64, subgraphPos.y + 64)
        await comfyPage.page.mouse.up()
        await comfyPage.page.keyboard.up('Alt')

        // Find all subgraph nodes
        const subgraphNodes =
          await comfyPage.nodeOps.getNodeRefsByTitle(NEW_SUBGRAPH_TITLE)

        // Expect a second subgraph node to be created (2 total)
        expect(subgraphNodes.length).toBe(2)
      })

      test('Copying subgraph node by dragging + alt creates a new subgraph node with unique type', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')

        // Get position of subgraph node
        const subgraphPos = await subgraphNode.getPosition()

        // Alt + Click on the subgraph node
        await comfyPage.page.mouse.move(subgraphPos.x + 16, subgraphPos.y + 16)
        await comfyPage.page.keyboard.down('Alt')
        await comfyPage.page.mouse.down()
        await comfyPage.nextFrame()

        // Drag slightly to trigger the copy
        await comfyPage.page.mouse.move(subgraphPos.x + 64, subgraphPos.y + 64)
        await comfyPage.page.mouse.up()
        await comfyPage.page.keyboard.up('Alt')

        // Find all subgraph nodes and expect all unique IDs
        const subgraphNodes =
          await comfyPage.nodeOps.getNodeRefsByTitle(NEW_SUBGRAPH_TITLE)

        // Expect the second subgraph node to have a unique type
        const nodeType1 = await subgraphNodes[0].getType()
        const nodeType2 = await subgraphNodes[1].getType()
        expect(nodeType1).not.toBe(nodeType2)
      })
    })
  })
})
