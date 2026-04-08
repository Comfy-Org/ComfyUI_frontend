import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const NEW_SUBGRAPH_TITLE = 'New Subgraph'

test.describe('Subgraph CRUD', { tag: ['@slow', '@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  async function duplicateSubgraphNodeViaAltDrag(
    comfyPage: ComfyPage
  ): Promise<void> {
    const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
    const subgraphPos = await subgraphNode.getPosition()

    await comfyPage.page.mouse.move(subgraphPos.x + 16, subgraphPos.y + 16)
    await comfyPage.page.keyboard.down('Alt')
    try {
      await comfyPage.page.mouse.down()
      await comfyPage.nextFrame()

      await comfyPage.page.mouse.move(subgraphPos.x + 64, subgraphPos.y + 64)
      await comfyPage.page.mouse.up()
    } finally {
      await comfyPage.page.keyboard.up('Alt')
    }
  }

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
          (input) => input.link != null
        ).length

        return { linkCount, linkedInputCount, nodeCount: nodes.length }
      })

      expect(result).not.toHaveProperty('error')
      expect(result.linkCount).toBe(1)
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

      await expect
        .poll(
          async () =>
            (await comfyPage.nodeOps.getNodeRefsByTitle(NEW_SUBGRAPH_TITLE))
              .length
        )
        .toBe(1)
      await expect.poll(() => comfyPage.subgraph.getNodeCount()).toBe(1)
    })

    test('Can delete subgraph node', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      expect(await subgraphNode.exists()).toBe(true)

      const initialNodeCount = await comfyPage.subgraph.getNodeCount()

      await subgraphNode.delete()

      const deletedNode = await comfyPage.nodeOps.getNodeRefById('2')
      await expect
        .poll(() => comfyPage.subgraph.getNodeCount())
        .toBe(initialNodeCount - 1)
      await expect.poll(() => deletedNode.exists()).toBe(false)
    })

    test.describe('Subgraph Copy', () => {
      test('Can duplicate a subgraph node by alt-dragging', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

        await duplicateSubgraphNodeViaAltDrag(comfyPage)

        await expect
          .poll(
            async () =>
              (await comfyPage.nodeOps.getNodeRefsByTitle(NEW_SUBGRAPH_TITLE))
                .length
          )
          .toBe(2)
      })

      test('Alt-dragging a subgraph node creates a new subgraph type', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

        await duplicateSubgraphNodeViaAltDrag(comfyPage)

        await expect
          .poll(
            async () =>
              (await comfyPage.nodeOps.getNodeRefsByTitle(NEW_SUBGRAPH_TITLE))
                .length
          )
          .toBe(2)

        const subgraphNodes =
          await comfyPage.nodeOps.getNodeRefsByTitle(NEW_SUBGRAPH_TITLE)
        const nodeType1 = await subgraphNodes[0].getType()
        const nodeType2 = await subgraphNodes[1].getType()
        expect(nodeType1).not.toBe(nodeType2)
      })
    })
  })
})
