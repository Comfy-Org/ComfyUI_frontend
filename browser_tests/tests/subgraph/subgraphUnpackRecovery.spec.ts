import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe(
  'Subgraph unpack recovery',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test('replaces an unavailable interior node with a placeholder', async ({
      comfyPage
    }) => {
      const missingType = 'test/UnavailableInteriorNode'
      await comfyPage.page.route('**/comfy-nodes/**', (route) =>
        route.fulfill({ status: 404 })
      )
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.page.evaluate((type) => {
        const subgraphNode = window.app!.graph.nodes.find((node) =>
          node.isSubgraphNode()
        )
        if (!subgraphNode?.isSubgraphNode()) {
          throw new Error('Subgraph node not found')
        }
        subgraphNode.subgraph.nodes[0].type = type
      }, missingType)

      await comfyPage.subgraph.unpackViaContextMenu('New Subgraph')

      await expect
        .poll(() =>
          comfyPage.page.evaluate((type) => {
            const placeholder = window.app!.graph.nodes.find(
              (node) => node.type === type
            )
            return {
              hostExists: window.app!.graph.nodes.some((node) =>
                node.isSubgraphNode()
              ),
              placeholderHasErrors: placeholder?.has_errors ?? false,
              placeholderType: placeholder?.last_serialization?.type
            }
          }, missingType)
        )
        .toEqual({
          hostExists: false,
          placeholderHasErrors: true,
          placeholderType: missingType
        })
    })

    test('clears transient previews for the host and interior nodes', async ({
      comfyPage,
      getWebSocket
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-preview-node'
      )
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      execution.latentPreview('preview-job', '5:10')
      execution.latentPreview('unrelated-preview-job', '11')
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() =>
            Object.keys(window.app!.nodePreviewImages)
          )
        )
        .toHaveLength(3)
      const unrelatedPreviews = await comfyPage.page.evaluate(
        () => window.app!.nodePreviewImages['11']
      )
      expect(unrelatedPreviews).toHaveLength(1)

      await comfyPage.subgraph.unpackViaContextMenu('New Subgraph')

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => window.app!.nodePreviewImages)
        )
        .toEqual({ '11': unrelatedPreviews })
    })
  }
)
