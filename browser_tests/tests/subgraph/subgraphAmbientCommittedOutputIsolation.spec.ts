import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const SUBGRAPH_NODE_ID = '1'
const SUBGRAPH_NODE_TITLE = 'Sampler And Preview Subgraph'
// Neither interior node has a `previewExposures` entry: the sampler (2) is
// only ever surfaced by the ambient rollup, and the PreviewImage node (3)
// only ever receives a committed `executed` output, never a streaming
// preview frame.
const SAMPLER_EXECUTION_ID = `${SUBGRAPH_NODE_ID}:2`
const PREVIEW_IMAGE_EXECUTION_ID = `${SUBGRAPH_NODE_ID}:3`

test.describe(
  'Subgraph ambient preview vs. committed output isolation (regression)',
  { tag: ['@vue-nodes', '@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-live-sampler-and-committed-output'
      )
      await comfyPage.vueNodes.waitForNodes(1)
    })

    test('a committed (non-live) interior output never counts as an ambient preview, and does not mask or duplicate the live one', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const subgraphNode =
        comfyPage.vueNodes.getNodeByTitle(SUBGRAPH_NODE_TITLE)
      const previewImages = subgraphNode.locator('img[src^="blob:"]')

      const jobId = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId)

      await test.step('a committed output from the unexposed PreviewImage node does not surface as an ambient preview', async () => {
        exec.executed(jobId, PREVIEW_IMAGE_EXECUTION_ID, {
          images: [{ filename: 'example.png', type: 'input' }]
        })
        await comfyPage.nextFrame()
        await expect(previewImages).toHaveCount(0)
      })

      await test.step('the live sampler preview still surfaces ambiently afterward, unaffected by the earlier committed output', async () => {
        exec.latentPreview(jobId, SAMPLER_EXECUTION_ID)
        await expect(previewImages).toHaveCount(1)
      })
    })
  }
)
