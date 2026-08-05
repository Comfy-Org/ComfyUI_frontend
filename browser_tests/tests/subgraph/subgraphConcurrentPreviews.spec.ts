import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const SUBGRAPH_NODE_ID = '1'
// Node 3 has no `properties.previewExposures` entry, simulating a KSampler
// added to the subgraph after the one-shot auto-expose already ran.
const FIRST_SAMPLER_ID = '2'
const SECOND_SAMPLER_ID = '3'
const FIRST_SAMPLER_EXECUTION_ID = `${SUBGRAPH_NODE_ID}:${FIRST_SAMPLER_ID}`
const SECOND_SAMPLER_EXECUTION_ID = `${SUBGRAPH_NODE_ID}:${SECOND_SAMPLER_ID}`

test.describe(
  'Subgraph concurrent preview outputs',
  { tag: ['@vue-nodes', '@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-two-live-samplers'
      )
      await comfyPage.vueNodes.waitForNodes(1)
    })

    test('shows live previews from both concurrently-executing interior samplers, not just the exposed one', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const subgraphNode = comfyPage.vueNodes.getNodeLocator(SUBGRAPH_NODE_ID)
      const previewImages = subgraphNode.locator('img[src^="blob:"]')

      await test.step('no preview is present before execution', async () => {
        await expect(previewImages).toHaveCount(0)
      })

      const jobId = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId)

      await test.step('the exposed sampler (node 2) shows its live preview', async () => {
        exec.latentPreview(jobId, FIRST_SAMPLER_EXECUTION_ID)
        await expect(previewImages).toHaveCount(1)
      })

      await test.step('the second, unexposed sampler (node 3) also shows its live preview, appended rather than overwriting the first', async () => {
        exec.latentPreview(jobId, SECOND_SAMPLER_EXECUTION_ID)
        await expect(previewImages).toHaveCount(2)
      })

      await test.step('both previews remain distinct as new frames arrive for each', async () => {
        const firstSrcBefore = await previewImages.nth(0).getAttribute('src')
        const secondSrcBefore = await previewImages.nth(1).getAttribute('src')

        exec.latentPreview(jobId, SECOND_SAMPLER_EXECUTION_ID)
        await expect(previewImages).toHaveCount(2)

        await expect(previewImages.nth(0)).toHaveAttribute(
          'src',
          firstSrcBefore!
        )
        await expect(previewImages.nth(1)).not.toHaveAttribute(
          'src',
          secondSrcBefore!
        )
      })
    })
  }
)
